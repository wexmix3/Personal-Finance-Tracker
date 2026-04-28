"""
Shared response envelope used by all API endpoints.

Every response is wrapped in:
  { "data": ..., "error": null, "meta": {...} }

This makes it trivial for the frontend to write a single typed fetch wrapper
that always knows where to find data vs. error messages.
"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Meta(BaseModel):
    """Optional pagination / request metadata."""
    total: int | None = None
    limit: int | None = None
    offset: int | None = None


class ApiResponse(BaseModel, Generic[T]):
    data: T | None = None
    error: str | None = None
    meta: Meta | None = None

    @classmethod
    def ok(cls, data: T, meta: Meta | None = None) -> "ApiResponse[T]":
        return cls(data=data, error=None, meta=meta)

    @classmethod
    def err(cls, message: str) -> "ApiResponse[Any]":
        return cls(data=None, error=message, meta=None)
