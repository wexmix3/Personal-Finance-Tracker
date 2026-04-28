"""
Sync routes — all require JWT auth.

  POST /api/sync/run
        → Triggers a manual sync for the current user's linked institutions.
          Optionally scoped to a single item_id.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.models.plaid_item import PlaidItem
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.sync import SyncRequest, SyncResponse
from app.services.sync import sync_item

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post(
    "/run",
    response_model=ApiResponse[SyncResponse],
    summary="Manually trigger a data sync for linked institutions",
)
async def run_sync(
    body: SyncRequest = SyncRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[SyncResponse]:
    """
    Fetches accounts and syncs transactions for all (or one) of the
    current user's linked Plaid items.

    This is the same logic run by the background scheduler — calling it
    manually is useful for development, troubleshooting, and post-link
    initial population.
    """
    # Build the query for which items to sync
    query = select(PlaidItem).where(PlaidItem.user_id == current_user.id)
    if body.item_id is not None:
        query = query.where(PlaidItem.id == body.item_id)

    result = await db.execute(query)
    items = result.scalars().all()

    if not items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No linked institution found"
                if body.item_id
                else "No linked institutions. Connect a bank account first."
            ),
        )

    item_results = []
    errors: list[str] = []

    for item in items:
        try:
            item_result = await sync_item(item, db)
            item_results.append(item_result)
        except RuntimeError as exc:
            # One item failing should not abort the sync for other items
            errors.append(f"{item.institution_name or item.item_id}: {exc}")

    if errors and not item_results:
        # Every item failed — surface as a 502
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="; ".join(errors),
        )

    return ApiResponse.ok(
        SyncResponse(
            items_synced=len(item_results),
            results=item_results,
        )
    )
