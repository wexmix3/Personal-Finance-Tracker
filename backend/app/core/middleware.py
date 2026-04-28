"""
ASGI middleware stack.

SecurityHeadersMiddleware  — adds OWASP-recommended response headers on every reply
RequestIdMiddleware        — stamps a UUID onto every request; surfaces it as
                             X-Request-ID in the response and injects it into
                             log records via a logging Filter so every log line
                             for a request carries the same ID.

Usage in main.py:
    from app.core.middleware import RequestIdMiddleware, SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIdMiddleware)
"""
import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


# ---------------------------------------------------------------------------
# Request-ID filter — injects request_id into log records
# ---------------------------------------------------------------------------

class _RequestIdFilter(logging.Filter):
    """Logging filter that reads request_id from a context carried on the record."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        if not hasattr(record, "request_id"):
            record.request_id = ""  # type: ignore[attr-defined]
        return True


# Install the filter on the root logger once at import time
logging.getLogger().addFilter(_RequestIdFilter())


# ---------------------------------------------------------------------------
# RequestIdMiddleware
# ---------------------------------------------------------------------------

class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Attaches a UUID request ID to every request/response.

    - Reads X-Request-ID from the incoming request (allows upstreams / load
      balancers to propagate an existing ID).
    - Generates a new UUID if no header is present.
    - Stores the ID on request.state.request_id so route handlers can read it.
    - Echoes it back as X-Request-ID on the response.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Inject into log records for this request's context by overriding
        # the root logger's extra — simplest approach that doesn't require
        # contextvars.
        old_factory = logging.getLogRecordFactory()

        def _factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.request_id = request_id  # type: ignore[attr-defined]
            return record

        logging.setLogRecordFactory(_factory)

        try:
            response = await call_next(request)
        finally:
            logging.setLogRecordFactory(old_factory)

        response.headers["X-Request-ID"] = request_id
        return response


# ---------------------------------------------------------------------------
# SecurityHeadersMiddleware
# ---------------------------------------------------------------------------

_SECURITY_HEADERS = {
    # Prevent browsers from MIME-sniffing the content-type
    "X-Content-Type-Options": "nosniff",
    # Block pages from being embedded in iframes (clickjacking)
    "X-Frame-Options": "DENY",
    # Force HTTPS for 1 year (production only — dev may use HTTP)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    # Disable the legacy XSS filter (modern browsers only use CSP)
    "X-XSS-Protection": "0",
    # Restrict what the browser can load (tight policy for an API server)
    "Content-Security-Policy": "default-src 'none'",
    # Don't send the Referer header to third parties
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Disable browser features we don't need
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds OWASP-recommended security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value
        return response
