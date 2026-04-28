"""
Data sync service.

Two public entry points:
  fetch_accounts(item, db)       — pull accounts + today's balance snapshot
  sync_transactions(item, db)    — cursor-based transaction sync (add/modify/remove)

Both are idempotent — safe to call multiple times without creating duplicates.

Cursor persistence:
  Plaid's Transactions Sync API is cursor-based. We persist the cursor in a
  file-backed store keyed by item_id so it survives server restarts.
  Production upgrade path: replace _CursorStore with a Redis-backed version.
"""
import json
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

import sqlalchemy as sa
from plaid.exceptions import ApiException as PlaidApiException
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token
from app.models.account import Account
from app.models.balance import Balance
from app.models.plaid_item import PlaidItem
from app.models.transaction import Transaction
from app.schemas.sync import AccountSyncResult, ItemSyncResult, TransactionSyncResult
from app.services.plaid_client import plaid

# ---------------------------------------------------------------------------
# Cursor store (file-backed, swap for Redis in production)
# ---------------------------------------------------------------------------
_CURSOR_FILE = Path(
    os.getenv(
        "CURSOR_STORE_PATH",
        str(Path.home() / ".finance_dashboard" / "plaid_cursors.json"),
    )
)


class _CursorStore:
    """
    Tiny file-backed key/value store for Plaid transaction cursors.
    Thread-safe enough for a single-process server; use Redis for multi-instance.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._data: dict[str, str] = {}
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text())
            except (json.JSONDecodeError, OSError):
                self._data = {}

    def _save(self) -> None:
        try:
            self._path.write_text(json.dumps(self._data))
        except OSError:
            pass  # Non-fatal — worst case we re-sync from the beginning

    def get(self, item_id: str) -> Optional[str]:
        return self._data.get(item_id)

    def set(self, item_id: str, cursor: str) -> None:
        self._data[item_id] = cursor
        self._save()


_cursor_store = _CursorStore(_CURSOR_FILE)


# ---------------------------------------------------------------------------
# fetch_accounts
# ---------------------------------------------------------------------------
async def fetch_accounts(
    item: PlaidItem,
    db: AsyncSession,
) -> list[AccountSyncResult]:
    """
    Pull the current account list from Plaid and upsert into the accounts table.
    Also writes a balance snapshot row for today.

    Returns a list of AccountSyncResult describing what was created/updated.
    """
    access_token = decrypt_token(item.encrypted_access_token)

    try:
        response = plaid.accounts_get(
            AccountsGetRequest(access_token=access_token)
        )
    except PlaidApiException as exc:
        raise RuntimeError(f"Plaid accounts_get failed: {exc.body}") from exc

    results: list[AccountSyncResult] = []
    today = date.today()

    for acct in response["accounts"]:
        plaid_account_id: str = acct["account_id"]
        bal = acct.get("balances", {})

        # ------------------------------------------------------------------ #
        # Upsert account row                                                   #
        # ------------------------------------------------------------------ #
        existing_result = await db.execute(
            select(Account).where(Account.plaid_account_id == plaid_account_id)
        )
        existing = existing_result.scalar_one_or_none()

        if existing is None:
            account = Account(
                user_id=item.user_id,
                plaid_item_id=item.id,
                plaid_account_id=plaid_account_id,
                name=acct["name"],
                official_name=acct.get("official_name"),
                type=str(acct["type"]),
                subtype=str(acct["subtype"]) if acct.get("subtype") else None,
            )
            db.add(account)
            await db.flush()  # populate account.id before the balance insert
            action = "created"
        else:
            existing.name = acct["name"]
            existing.official_name = acct.get("official_name")
            existing.type = str(acct["type"])
            existing.subtype = str(acct["subtype"]) if acct.get("subtype") else None
            account = existing
            action = "updated"

        # ------------------------------------------------------------------ #
        # Upsert today's balance snapshot                                      #
        # INSERT ... ON CONFLICT DO UPDATE makes this safe to run N times/day  #
        # ------------------------------------------------------------------ #
        bal_stmt = (
            pg_insert(Balance)
            .values(
                id=uuid.uuid4(),
                account_id=account.id,
                current=bal.get("current"),
                available=bal.get("available"),
                limit=bal.get("limit"),
                iso_currency_code=bal.get("iso_currency_code"),
                snapshot_date=today,
                created_at=datetime.now(timezone.utc),
            )
            .on_conflict_do_update(
                constraint="uq_balance_account_date",
                set_={
                    "current":           sa.text("EXCLUDED.current"),
                    "available":         sa.text("EXCLUDED.available"),
                    "limit":             sa.text("EXCLUDED.limit"),
                    "iso_currency_code": sa.text("EXCLUDED.iso_currency_code"),
                },
            )
        )
        await db.execute(bal_stmt)

        results.append(
            AccountSyncResult(
                plaid_account_id=plaid_account_id,
                name=acct["name"],
                type=str(acct["type"]),
                action=action,
            )
        )

    await db.commit()
    return results


# ---------------------------------------------------------------------------
# sync_transactions
# ---------------------------------------------------------------------------
async def sync_transactions(
    item: PlaidItem,
    db: AsyncSession,
) -> TransactionSyncResult:
    """
    Cursor-based transaction sync using Plaid's /transactions/sync endpoint.

    Plaid returns pages of added/modified/removed transactions since the last
    cursor. We page until has_more=False, then persist the cursor.

    Upsert strategy:
      - Added:    INSERT ... ON CONFLICT (plaid_transaction_id) DO UPDATE
      - Modified: same upsert — overwrites the existing row
      - Removed:  DELETE WHERE plaid_transaction_id IN (...)
    """
    access_token = decrypt_token(item.encrypted_access_token)
    cursor = _cursor_store.get(item.item_id)  # None on first sync

    # Pre-load all plaid_account_id → account.id mappings for this item
    # to avoid an N+1 query inside the transaction loop.
    acct_result = await db.execute(
        select(Account.plaid_account_id, Account.id).where(
            Account.plaid_item_id == item.id
        )
    )
    acct_map: dict[str, uuid.UUID] = {row[0]: row[1] for row in acct_result}

    added_count = 0
    modified_count = 0
    removed_count = 0
    next_cursor = cursor

    has_more = True
    while has_more:
        try:
            sync_kwargs: dict = {"access_token": access_token, "count": 500}
            if next_cursor:
                sync_kwargs["cursor"] = next_cursor

            response = plaid.transactions_sync(
                TransactionsSyncRequest(**sync_kwargs)
            )
        except PlaidApiException as exc:
            raise RuntimeError(f"Plaid transactions_sync failed: {exc.body}") from exc

        added: list = response.get("added", [])
        modified: list = response.get("modified", [])
        removed: list = response.get("removed", [])
        has_more = response.get("has_more", False)
        next_cursor = response.get("next_cursor")

        # ------------------------------------------------------------------ #
        # Added + Modified — single upsert handles both                       #
        # ------------------------------------------------------------------ #
        for txn in added + modified:
            account_id = acct_map.get(txn["account_id"])
            if account_id is None:
                # Account not yet in our DB — skip until next fetch_accounts
                continue

            txn_stmt = (
                pg_insert(Transaction)
                .values(
                    id=uuid.uuid4(),
                    account_id=account_id,
                    plaid_transaction_id=txn["transaction_id"],
                    amount=txn["amount"],
                    currency=txn.get("iso_currency_code"),
                    merchant_name=txn.get("merchant_name"),
                    name=txn["name"],
                    category=txn.get("category"),
                    date=txn["date"],
                    authorized_date=txn.get("authorized_date"),
                    pending=txn.get("pending", False),
                    created_at=datetime.now(timezone.utc),
                )
                .on_conflict_do_update(
                    index_elements=["plaid_transaction_id"],
                    set_={
                        "amount":          sa.text("EXCLUDED.amount"),
                        "currency":        sa.text("EXCLUDED.currency"),
                        "merchant_name":   sa.text("EXCLUDED.merchant_name"),
                        "name":            sa.text("EXCLUDED.name"),
                        "category":        sa.text("EXCLUDED.category"),
                        "date":            sa.text("EXCLUDED.date"),
                        "authorized_date": sa.text("EXCLUDED.authorized_date"),
                        "pending":         sa.text("EXCLUDED.pending"),
                    },
                )
            )
            await db.execute(txn_stmt)

        added_count += len(added)
        modified_count += len(modified)

        # ------------------------------------------------------------------ #
        # Removed — batch delete by plaid_transaction_id                      #
        # ------------------------------------------------------------------ #
        if removed:
            removed_ids = [r["transaction_id"] for r in removed]
            await db.execute(
                sa_delete(Transaction).where(
                    Transaction.plaid_transaction_id.in_(removed_ids)
                )
            )
            removed_count += len(removed_ids)

        await db.commit()

    # Persist the cursor only after ALL pages are committed successfully
    if next_cursor:
        _cursor_store.set(item.item_id, next_cursor)

    return TransactionSyncResult(
        added=added_count,
        modified=modified_count,
        removed=removed_count,
    )


# ---------------------------------------------------------------------------
# sync_item — convenience wrapper that runs both steps for one PlaidItem
# ---------------------------------------------------------------------------
async def sync_item(
    item: PlaidItem,
    db: AsyncSession,
) -> ItemSyncResult:
    """Run fetch_accounts then sync_transactions for a single PlaidItem."""
    account_results = await fetch_accounts(item, db)
    txn_result = await sync_transactions(item, db)

    return ItemSyncResult(
        item_id=item.item_id,
        institution_name=item.institution_name,
        accounts=account_results,
        transactions=txn_result,
    )
