"""
Manual account management routes — all require JWT auth.

  POST   /api/accounts          — Create a new account
  PATCH  /api/accounts/{id}     — Update account name/balance
  DELETE /api/accounts/{id}     — Delete account (cascades transactions)
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.models.account import Account
from app.models.balance import Balance
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api", tags=["accounts"])

# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

ACCOUNT_TYPES = {"depository", "credit", "investment", "loan", "other"}
SUBTYPES = {
    "depository": ["checking", "savings", "money market", "cd", "other"],
    "credit": ["credit card", "other"],
    "investment": ["brokerage", "401k", "ira", "roth", "other"],
    "loan": ["mortgage", "student", "auto", "personal", "other"],
    "other": ["other"],
}


class CreateAccountRequest(BaseModel):
    name: str
    institution_name: str | None = None
    type: str          # depository | credit | investment | loan | other
    subtype: str | None = None
    current_balance: float
    currency: str = "USD"


class UpdateAccountRequest(BaseModel):
    name: str | None = None
    institution_name: str | None = None
    current_balance: float | None = None


# ---------------------------------------------------------------------------
# POST /api/accounts
# ---------------------------------------------------------------------------
@router.post(
    "/accounts",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_201_CREATED,
    summary="Create a manual account",
)
async def create_account(
    body: CreateAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    if body.type not in ACCOUNT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"type must be one of: {', '.join(sorted(ACCOUNT_TYPES))}",
        )

    acct = Account(
        user_id=current_user.id,
        name=body.name.strip(),
        institution_name=body.institution_name.strip() if body.institution_name else None,
        type=body.type,
        subtype=body.subtype,
    )
    db.add(acct)
    await db.flush()  # get acct.id

    # Create initial balance snapshot for today
    bal = Balance(
        account_id=acct.id,
        current=Decimal(str(body.current_balance)),
        available=Decimal(str(body.current_balance)) if body.type != "credit" else None,
        iso_currency_code=body.currency.upper(),
        snapshot_date=date.today(),
    )
    db.add(bal)
    await db.commit()
    await db.refresh(acct)

    return ApiResponse.ok({
        "id": str(acct.id),
        "name": acct.name,
        "institution_name": acct.institution_name,
        "type": acct.type,
        "subtype": acct.subtype,
        "current_balance": float(body.current_balance),
    })


# ---------------------------------------------------------------------------
# PATCH /api/accounts/{id}
# ---------------------------------------------------------------------------
@router.patch(
    "/accounts/{account_id}",
    response_model=ApiResponse[dict],
    summary="Update account name or current balance",
)
async def update_account(
    account_id: uuid.UUID,
    body: UpdateAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    if body.name is not None:
        acct.name = body.name.strip()
    if body.institution_name is not None:
        acct.institution_name = body.institution_name.strip()

    if body.current_balance is not None:
        # Upsert a balance snapshot for today
        bal_result = await db.execute(
            select(Balance).where(
                Balance.account_id == acct.id,
                Balance.snapshot_date == date.today(),
            )
        )
        bal = bal_result.scalar_one_or_none()
        if bal:
            bal.current = Decimal(str(body.current_balance))
        else:
            db.add(Balance(
                account_id=acct.id,
                current=Decimal(str(body.current_balance)),
                snapshot_date=date.today(),
            ))

    await db.commit()
    return ApiResponse.ok({"id": str(acct.id), "updated": True})


# ---------------------------------------------------------------------------
# DELETE /api/accounts/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/accounts/{account_id}",
    response_model=ApiResponse[dict],
    summary="Delete an account (cascades to transactions)",
)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id,
        )
    )
    acct = result.scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    await db.delete(acct)
    await db.commit()
    return ApiResponse.ok({"deleted": True})
