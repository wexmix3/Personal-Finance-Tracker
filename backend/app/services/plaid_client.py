"""
Plaid API client singleton.

Wraps plaid-python's PlaidApi so the rest of the codebase never has to
deal with environment mapping, header construction, or client initialization.

Usage:
    from app.services.plaid_client import plaid

    response = plaid.link_token_create(request)
"""
from plaid.api import plaid_api
from plaid.api_client import ApiClient
from plaid.configuration import Configuration
from plaid.model.country_code import CountryCode
from plaid.model.products import Products

from app.core.config import settings

# ---------------------------------------------------------------------------
# Environment → Plaid host URL mapping
# ---------------------------------------------------------------------------
_ENV_MAP = {
    "sandbox":     "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production":  "https://production.plaid.com",
}


def _build_client() -> plaid_api.PlaidApi:
    host = _ENV_MAP.get(settings.PLAID_ENV.lower())
    if host is None:
        raise ValueError(
            f"Invalid PLAID_ENV '{settings.PLAID_ENV}'. "
            f"Must be one of: {list(_ENV_MAP.keys())}"
        )

    configuration = Configuration(
        host=host,
        api_key={
            "clientId": settings.PLAID_CLIENT_ID,
            "secret":   settings.PLAID_SECRET,
        },
    )
    api_client = ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


# Module-level singleton — instantiated once at import time.
# All services import this object directly.
plaid: plaid_api.PlaidApi = _build_client()


# ---------------------------------------------------------------------------
# Helpers to parse settings into Plaid SDK enum lists
# ---------------------------------------------------------------------------
def get_products() -> list[Products]:
    return [Products(p) for p in settings.plaid_products_list]


def get_country_codes() -> list[CountryCode]:
    return [CountryCode(c) for c in settings.plaid_country_codes_list]
