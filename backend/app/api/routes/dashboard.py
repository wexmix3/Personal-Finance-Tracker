"""
Dashboard read-only routes — all require JWT auth.

  GET /api/accounts
        → All accounts for the current user, each with their latest
          balance snapshot joined in.

  GET /api/transactions
        → Paginated transactions. Query params:
            limit      int  (default 50, max 200)
            offset     int  (default 0)
            account_id UUID (optional filter)
            pending    bool (optional filter)
            search     str  (optional — matches merchant_name or name)

  GET /api/net-worth
        → Current net worth = sum(asset balances) - sum(liability balances)
          using the most recent balance snapshot per account.

  GET /api/net-worth/history
        → Daily net-worth snapshots for the last N days (default 90).
          One row per day where at least one balance snapshot exists.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload  # noqa: F401 kept for potential future use

from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.models.account import Account
from app.models.balance import Balance
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import ApiResponse, Meta
from app.schemas.dashboard import (
    AccountResponse,
    BalanceSnapshot,
    NetWorthHistoryPoint,
    NetWorthHistoryResponse,
    NetWorthResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/api", tags=["dashboard"])

# Account types Plaid considers liabilities (negative contribution to net worth)
_LIABILITY_TYPES = {"credit", "loan"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _latest_balance_subquery(db: AsyncSession) -> dict[uuid.UUID, Balance]:
    """
    For each account_id return the balance row with the most recent
    snapshot_date. Returns a dict keyed by account.id.
    """
    # Subquery: max snapshot_date per account
    max_date_sq = (
        select(
            Balance.account_id,
            func.max(Balance.snapshot_date).label("max_date"),
        )
        .group_by(Balance.account_id)
        .subquery()
    )

    result = await db.execute(
        select(Balance).join(
            max_date_sq,
            (Balance.account_id == max_date_sq.c.account_id)
            & (Balance.snapshot_date == max_date_sq.c.max_date),
        )
    )
    return {b.account_id: b for b in result.scalars().all()}


# ---------------------------------------------------------------------------
# GET /api/accounts
# ---------------------------------------------------------------------------
@router.get(
    "/accounts",
    response_model=ApiResponse[list[AccountResponse]],
    summary="List all accounts with latest balance",
)
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[list[AccountResponse]]:
    # Fetch accounts for the current user
    result = await db.execute(
        select(Account)
        .where(Account.user_id == current_user.id)
        .order_by(Account.name)
    )
    accounts = result.scalars().all()

    # Fetch latest balance per account (one round-trip for all accounts)
    latest = await _latest_balance_subquery(db)

    response_items: list[AccountResponse] = []
    for acct in accounts:
        bal = latest.get(acct.id)
        response_items.append(
            AccountResponse(
                id=acct.id,
                name=acct.name,
                official_name=acct.official_name,
                type=acct.type,
                subtype=acct.subtype,
                institution_name=acct.institution_name,
                latest_balance=BalanceSnapshot(
                    current=bal.current,
                    available=bal.available,
                    limit=bal.limit,
                    iso_currency_code=bal.iso_currency_code,
                    snapshot_date=bal.snapshot_date,
                )
                if bal
                else None,
            )
        )

    return ApiResponse.ok(response_items, Meta(total=len(response_items)))


# ---------------------------------------------------------------------------
# GET /api/transactions
# ---------------------------------------------------------------------------
@router.get(
    "/transactions",
    response_model=ApiResponse[list[TransactionResponse]],
    summary="Paginated transaction list with optional filters",
)
async def list_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    account_id: Optional[uuid.UUID] = Query(default=None),
    pending: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[list[TransactionResponse]]:
    # Base query — join Account so we can (a) enforce ownership and
    # (b) return account_name without a second query.
    base = (
        select(Transaction, Account.name.label("account_name"))
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.id)
    )

    if account_id is not None:
        base = base.where(Transaction.account_id == account_id)

    if pending is not None:
        base = base.where(Transaction.pending == pending)

    if search:
        term = f"%{search}%"
        base = base.where(
            Transaction.name.ilike(term)
            | Transaction.merchant_name.ilike(term)
        )

    # Count total (for pagination meta) — reuse filters, strip order/limit
    count_result = await db.execute(
        select(func.count()).select_from(base.subquery())
    )
    total: int = count_result.scalar_one()

    # Fetch the page
    page_result = await db.execute(base.limit(limit).offset(offset))
    rows = page_result.all()

    items = [
        TransactionResponse(
            id=txn.id,
            account_id=txn.account_id,
            account_name=account_name,
            amount=txn.amount,
            currency=txn.currency,
            merchant_name=txn.merchant_name,
            name=txn.name,
            category=txn.category,
            date=txn.date,
            authorized_date=txn.authorized_date,
            pending=txn.pending,
        )
        for txn, account_name in rows
    ]

    return ApiResponse.ok(items, Meta(total=total, limit=limit, offset=offset))


# ---------------------------------------------------------------------------
# GET /api/net-worth
# ---------------------------------------------------------------------------
@router.get(
    "/net-worth",
    response_model=ApiResponse[NetWorthResponse],
    summary="Current net worth (assets minus liabilities)",
)
async def get_net_worth(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[NetWorthResponse]:
    # Fetch accounts + their latest balances
    acct_result = await db.execute(
        select(Account).where(Account.user_id == current_user.id)
    )
    accounts = acct_result.scalars().all()

    latest = await _latest_balance_subquery(db)

    total_assets = Decimal("0")
    total_liabilities = Decimal("0")
    as_of = date.today()

    for acct in accounts:
        bal = latest.get(acct.id)
        if bal is None or bal.current is None:
            continue

        current_val = Decimal(str(bal.current))

        if acct.type.lower() in _LIABILITY_TYPES:
            # Plaid returns credit card balances as positive owed amounts
            total_liabilities += current_val
        else:
            total_assets += current_val

        if bal.snapshot_date < as_of:
            as_of = bal.snapshot_date

    return ApiResponse.ok(
        NetWorthResponse(
            net_worth=total_assets - total_liabilities,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            as_of=as_of,
        )
    )


# ---------------------------------------------------------------------------
# GET /api/net-worth/history
# ---------------------------------------------------------------------------
@router.get(
    "/net-worth/history",
    response_model=ApiResponse[NetWorthHistoryResponse],
    summary="Daily net-worth history for charting (last N days)",
)
async def get_net_worth_history(
    days: int = Query(default=90, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[NetWorthHistoryResponse]:
    """
    Strategy:
      1. Find the oldest balance snapshot per account within the window.
      2. For each calendar day in the window, find the most recent snapshot
         for each account that is ≤ that day (carry-forward).
      3. Aggregate into assets vs liabilities per day.

    We implement this in Python (not pure SQL) for clarity and portability,
    since the number of accounts × days is small enough (< 50 accounts × 365
    days = 18 250 rows) that fetching all relevant balances and grouping in
    Python is fast.
    """
    since = date.today() - timedelta(days=days)

    # Fetch all balance snapshots within the window for this user's accounts
    result = await db.execute(
        select(Balance, Account.type)
        .join(Account, Balance.account_id == Account.id)
        .where(
            Account.user_id == current_user.id,
            Balance.snapshot_date >= since,
        )
        .order_by(Balance.account_id, Balance.snapshot_date)
    )
    rows = result.all()

    # Build a map: account_id → sorted list of (snapshot_date, current, type)
    from collections import defaultdict

    acct_snapshots: dict[uuid.UUID, list[tuple[date, Decimal, str]]] = defaultdict(list)
    for bal, acct_type in rows:
        if bal.current is not None:
            acct_snapshots[bal.account_id].append(
                (bal.snapshot_date, Decimal(str(bal.current)), acct_type.lower())
            )

    if not acct_snapshots:
        return ApiResponse.ok(
            NetWorthHistoryResponse(history=[], days=days)
        )

    # For each day in the window, carry-forward the latest known balance
    # per account and sum into assets/liabilities.
    history: list[NetWorthHistoryPoint] = []
    today = date.today()
    day = since

    while day <= today:
        assets = Decimal("0")
        liabs = Decimal("0")

        for snapshots in acct_snapshots.values():
            # Latest snapshot on or before `day`
            value: Optional[Decimal] = None
            acct_type = ""
            for snap_date, snap_val, snap_type in snapshots:
                if snap_date <= day:
                    value = snap_val
                    acct_type = snap_type
                else:
                    break  # sorted, no point continuing

            if value is None:
                continue

            if acct_type in _LIABILITY_TYPES:
                liabs += value
            else:
                assets += value

        history.append(
            NetWorthHistoryPoint(
                snapshot_date=day,
                net_worth=assets - liabs,
                total_assets=assets,
                total_liabilities=liabs,
            )
        )
        day += timedelta(days=1)

    return ApiResponse.ok(
        NetWorthHistoryResponse(history=history, days=days)
    )
