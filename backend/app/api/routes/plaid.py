"""
Plaid routes — all require JWT auth.

  POST /api/plaid/create-link-token
        → Returns a link_token the frontend passes to react-plaid-link.

  POST /api/plaid/exchange-token
        → Receives the public_token from Plaid Link, exchanges it for a
          durable access_token, encrypts it, and stores it in plaid_items.

  GET  /api/plaid/items
        → List all linked institutions for the current user.

  DELETE /api/plaid/items/{item_id}
        → Remove a linked institution (calls Plaid item/remove first).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from plaid.exceptions import ApiException as PlaidApiException
from plaid.model.item_public_token_exchange_request import (
    ItemPublicTokenExchangeRequest,
)
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.core.security import decrypt_token, encrypt_token
from app.models.plaid_item import PlaidItem
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.plaid import (
    CreateLinkTokenRequest,
    ExchangeTokenRequest,
    LinkTokenResponse,
    PlaidItemResponse,
)
from app.services.plaid_client import get_country_codes, get_products, plaid

router = APIRouter(prefix="/api/plaid", tags=["plaid"])


# ---------------------------------------------------------------------------
# POST /api/plaid/create-link-token
# ---------------------------------------------------------------------------
@router.post(
    "/create-link-token",
    response_model=ApiResponse[LinkTokenResponse],
    summary="Create a Plaid Link token to initialize the Link UI",
)
async def create_link_token(
    body: CreateLinkTokenRequest = CreateLinkTokenRequest(),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[LinkTokenResponse]:
    """
    Creates a short-lived link_token tied to the authenticated user.
    The frontend passes this token to <PlaidLink> to open the bank-linking UI.
    """
    try:
        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(
                client_user_id=str(current_user.id),
            ),
            client_name="Finance Dashboard",
            products=get_products(),
            country_codes=get_country_codes(),
            language="en",
            **({"webhook": body.webhook} if body.webhook else {}),
        )
        response = plaid.link_token_create(request)
    except PlaidApiException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Plaid error: {exc.body}",
        ) from exc

    return ApiResponse.ok(
        LinkTokenResponse(
            link_token=response["link_token"],
            expiration=str(response["expiration"]),
            request_id=response["request_id"],
        )
    )


# ---------------------------------------------------------------------------
# POST /api/plaid/exchange-token
# ---------------------------------------------------------------------------
@router.post(
    "/exchange-token",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[PlaidItemResponse],
    summary="Exchange Plaid public_token for an access_token and store it",
)
async def exchange_token(
    body: ExchangeTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[PlaidItemResponse]:
    """
    Called immediately after the user completes Plaid Link on the frontend.

    Flow:
      1. Call Plaid /item/public_token/exchange to get a durable access_token.
      2. Fernet-encrypt the access_token before storing.
      3. Upsert into plaid_items (handles duplicate webhooks from Plaid).
      4. Return a safe PlaidItemResponse (no access_token in the response).
    """
    # Step 1 — Exchange the short-lived public token
    try:
        exchange_response = plaid.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=body.public_token)
        )
    except PlaidApiException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Plaid error during token exchange: {exc.body}",
        ) from exc

    access_token: str = exchange_response["access_token"]
    plaid_item_id: str = exchange_response["item_id"]

    # Step 2 — Check for existing item (idempotency — Plaid may re-deliver)
    existing = await db.execute(
        select(PlaidItem).where(PlaidItem.item_id == plaid_item_id)
    )
    item = existing.scalar_one_or_none()

    if item is not None:
        # Update the stored token in case it was rotated
        item.encrypted_access_token = encrypt_token(access_token)
        if body.institution_name:
            item.institution_name = body.institution_name
    else:
        # Step 3 — Create new PlaidItem
        item = PlaidItem(
            user_id=current_user.id,
            encrypted_access_token=encrypt_token(access_token),
            item_id=plaid_item_id,
            institution_name=body.institution_name,
        )
        db.add(item)

    await db.commit()
    await db.refresh(item)

    return ApiResponse.ok(
        PlaidItemResponse(
            id=str(item.id),
            institution_name=item.institution_name,
            item_id=item.item_id,
        )
    )


# ---------------------------------------------------------------------------
# GET /api/plaid/items
# ---------------------------------------------------------------------------
@router.get(
    "/items",
    response_model=ApiResponse[list[PlaidItemResponse]],
    summary="List all linked institutions for the current user",
)
async def list_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[list[PlaidItemResponse]]:
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.user_id == current_user.id)
    )
    items = result.scalars().all()
    return ApiResponse.ok(
        [
            PlaidItemResponse(
                id=str(i.id),
                institution_name=i.institution_name,
                item_id=i.item_id,
            )
            for i in items
        ]
    )


# ---------------------------------------------------------------------------
# DELETE /api/plaid/items/{item_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/items/{item_id}",
    response_model=ApiResponse[dict],
    summary="Unlink an institution (removes item from Plaid and our DB)",
)
async def remove_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[dict]:
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == item_id,
            PlaidItem.user_id == current_user.id,  # ownership check
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    # Notify Plaid that we're removing the item (best-effort — don't fail
    # the local delete if Plaid returns an error, e.g. item already removed)
    try:
        from plaid.model.item_remove_request import ItemRemoveRequest

        access_token = decrypt_token(item.encrypted_access_token)
        plaid.item_remove(ItemRemoveRequest(access_token=access_token))
    except Exception:
        pass  # Log in Phase 9; don't block the local delete

    await db.delete(item)
    await db.commit()

    return ApiResponse.ok({"removed": True})
