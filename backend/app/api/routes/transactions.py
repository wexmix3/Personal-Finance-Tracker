"""
Manual transaction management + CSV import routes — all require JWT auth.

  POST   /api/transactions          — Create a single transaction
  DELETE /api/transactions/{id}     — Delete a transaction
  POST   /api/import/csv            — Import transactions from a CSV file
"""
import csv
import io
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api", tags=["transactions"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateTransactionRequest(BaseModel):
    account_id: uuid.UUID
    date: date
    name: str
    amount: float          # positive = expense, negative = income
    merchant_name: Optional[str] = None
    category: Optional[list[str]] = None
    pending: bool = False
    currency: str = "USD"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _assert_account_owned(
    account_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Account:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    return acct


def _parse_amount(raw: str) -> Optional[Decimal]:
    """Parse a dollar amount string, stripping $, commas, parens."""
    raw = raw.strip().replace("$", "").replace(",", "")
    # Parentheses = negative: (123.45) → -123.45
    if raw.startswith("(") and raw.endswith(")"):
        raw = "-" + raw[1:-1]
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


def _parse_date(raw: str) -> Optional[date]:
    """Try common date formats."""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _detect_columns(headers: list[str]) -> dict:
    """
    Return a mapping of role → column-index for the most common bank CSV formats.
    Roles: date, name, amount, debit, credit
    """
    h = [h.strip().lower() for h in headers]

    def find(*candidates) -> Optional[int]:
        for c in candidates:
            if c in h:
                return h.index(c)
        return None

    return {
        "date": find("date", "transaction date", "posted date", "trans. date"),
        "name": find("description", "name", "memo", "transaction description", "details"),
        "amount": find("amount", "transaction amount"),
        "debit": find("debit", "withdrawal", "withdrawals", "charges"),
        "credit": find("credit", "deposit", "deposits", "payments"),
    }


# ---------------------------------------------------------------------------
# POST /api/transactions
# ---------------------------------------------------------------------------
@router.post(
    "/transactions",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_201_CREATED,
    summary="Create a single manual transaction",
)
async def create_transaction(
    body: CreateTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    await _assert_account_owned(body.account_id, current_user.id, db)

    txn = Transaction(
        account_id=body.account_id,
        date=body.date,
        name=body.name.strip(),
        amount=Decimal(str(body.amount)),
        merchant_name=body.merchant_name,
        category=body.category,
        pending=body.pending,
        currency=body.currency.upper(),
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    return ApiResponse.ok({"id": str(txn.id), "created": True})


# ---------------------------------------------------------------------------
# DELETE /api/transactions/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/transactions/{transaction_id}",
    response_model=ApiResponse[dict],
    summary="Delete a transaction",
)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    result = await db.execute(
        select(Transaction, Account.user_id)
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.id == transaction_id,
            Account.user_id == current_user.id,
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn, _ = row
    await db.delete(txn)
    await db.commit()
    return ApiResponse.ok({"deleted": True})


# ---------------------------------------------------------------------------
# POST /api/import/csv
# ---------------------------------------------------------------------------
@router.post(
    "/import/csv",
    response_model=ApiResponse[dict],
    summary="Import transactions from a bank CSV export",
)
async def import_csv(
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    """
    Accepts CSV files exported from most US banks. Supports:
    - Chase, Bank of America, Wells Fargo, Capital One, Citi, Amex
    - Generic: Date, Description, Amount columns
    - Split debit/credit columns

    Amount sign convention: positive = expense, negative = income.
    Banks that export debits as positive values are handled automatically.
    """
    await _assert_account_owned(account_id, current_user.id, db)

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handles Excel BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    # Find the header row (first non-empty row)
    header_idx = 0
    for i, row in enumerate(rows):
        if any(cell.strip() for cell in row):
            header_idx = i
            break

    headers = rows[header_idx]
    cols = _detect_columns(headers)

    if cols["date"] is None or cols["name"] is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect required columns (Date, Description) in the CSV. "
                "Expected headers like: Date, Description, Amount. "
                "Please download a standard transaction CSV from your bank."
            ),
        )

    imported = 0
    skipped = 0

    for row in rows[header_idx + 1:]:
        if not any(cell.strip() for cell in row):
            continue  # skip blank rows
        if len(row) <= max(v for v in cols.values() if v is not None):
            skipped += 1
            continue

        # Parse date
        txn_date = _parse_date(row[cols["date"]])
        if txn_date is None:
            skipped += 1
            continue

        # Parse name
        name = row[cols["name"]].strip()
        if not name:
            skipped += 1
            continue

        # Parse amount
        amount: Optional[Decimal] = None
        if cols["amount"] is not None:
            amount = _parse_amount(row[cols["amount"]])
        elif cols["debit"] is not None and cols["credit"] is not None:
            debit_str = row[cols["debit"]].strip()
            credit_str = row[cols["credit"]].strip()
            if debit_str:
                val = _parse_amount(debit_str)
                if val is not None:
                    amount = abs(val)   # debit = positive (expense)
            elif credit_str:
                val = _parse_amount(credit_str)
                if val is not None:
                    amount = -abs(val)  # credit = negative (income)

        if amount is None:
            skipped += 1
            continue

        txn = Transaction(
            account_id=account_id,
            date=txn_date,
            name=name,
            amount=amount,
            currency="USD",
        )
        db.add(txn)
        imported += 1

    await db.commit()

    return ApiResponse.ok({
        "imported": imported,
        "skipped": skipped,
        "account_id": str(account_id),
    })
