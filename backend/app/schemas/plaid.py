"""
Pydantic schemas for Plaid-related request bodies and responses.
"""
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
class CreateLinkTokenRequest(BaseModel):
    """
    Optional body for link token creation.
    Most fields are derived from the authenticated user on the server side.
    The client can optionally pass a webhook URL to override the default.
    """
    webhook: str | None = None


class ExchangeTokenRequest(BaseModel):
    """
    Body sent by the frontend after Plaid Link completes successfully.
    Contains the short-lived public_token that must be exchanged for a
    durable access_token server-side.
    """
    public_token: str
    institution_id: str | None = None
    institution_name: str | None = None


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str      # ISO-8601 datetime string from Plaid
    request_id: str


class PlaidItemResponse(BaseModel):
    """
    Safe representation of a PlaidItem — never includes the access token.
    """
    id: str
    institution_name: str | None
    item_id: str

    model_config = {"from_attributes": True}
