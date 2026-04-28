"""
Pydantic schemas for sync request/response.
"""
import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel


class SyncRequest(BaseModel):
    """
    Optional body for POST /api/sync/run.
    If item_id is provided, only that institution is synced.
    If omitted, all of the user's linked institutions are synced.
    """
    item_id: Optional[uuid.UUID] = None


class AccountSyncResult(BaseModel):
    plaid_account_id: str
    name: str
    type: str
    action: str   # "created" | "updated"


class TransactionSyncResult(BaseModel):
    added: int
    modified: int
    removed: int


class ItemSyncResult(BaseModel):
    item_id: str
    institution_name: Optional[str]
    accounts: list[AccountSyncResult]
    transactions: TransactionSyncResult


class SyncResponse(BaseModel):
    items_synced: int
    results: list[ItemSyncResult]
