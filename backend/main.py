"""
Finance Dashboard — FastAPI entry point (Plaid-free manual entry edition).
"""
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.api.routes import auth as auth_router
from app.api.routes import dashboard as dashboard_router
from app.api.routes import accounts as accounts_router
from app.api.routes import transactions as transactions_router

configure_logging(level="DEBUG" if not settings.is_production else "INFO")

import logging
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Finance Dashboard API", extra={"environment": settings.ENVIRONMENT})
    yield
    logger.info("Finance Dashboard API shut down")


app = FastAPI(
    title="Finance Dashboard API",
    version="0.2.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": f"{type(exc).__name__}: {exc}"},
    )


_cors_origins = (
    ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
     "http://127.0.0.1:3000", "http://127.0.0.1:3001"]
    if not settings.is_production
    else [settings.FRONTEND_URL]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(accounts_router.router)
app.include_router(transactions_router.router)

_start_time = time.time()


@app.get("/health", tags=["ops"])
async def health(request: Request) -> dict:
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.time() - _start_time),
        "request_id": getattr(request.state, "request_id", None),
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )
