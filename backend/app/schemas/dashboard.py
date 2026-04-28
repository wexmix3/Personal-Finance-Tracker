"""
Pydantic schemas for dashboard API responses.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
class BalanceSnapshot(BaseModel):
    current: Optional[Decimal]
    available: Optional[Decimal]
    limit: Optional[Decimal]
    iso_currency_code: Optional[str]
    snapshot_date: date

    model_config = {"from_attributes": True}


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    official_name: Optional[str]
    type: str
    subtype: Optional[str]
    institution_name: Optional[str]
    latest_balance: Optional[BalanceSnapshot]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
class TransactionResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_name: str
    amount: Decimal
    currency: Optional[str]
    merchant_name: Optional[str]
    name: str
    category: Optional[list[str]]
    date: date
    authorized_date: Optional[date]
    pending: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Net worth
# ---------------------------------------------------------------------------
class NetWorthResponse(BaseModel):
    net_worth: Decimal
    total_assets: Decimal
    total_liabilities: Decimal
    as_of: date


class NetWorthHistoryPoint(BaseModel):
    snapshot_date: date
    net_worth: Decimal
    total_assets: Decimal
    total_liabilities: Decimal


class NetWorthHistoryResponse(BaseModel):
    history: list[NetWorthHistoryPoint]
    days: int
