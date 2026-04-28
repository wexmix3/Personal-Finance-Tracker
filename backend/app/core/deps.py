"""
FastAPI dependencies shared across route modules.

get_current_user — validates the Bearer JWT and returns the authenticated User.
All protected routes declare: current_user: User = Depends(get_current_user)
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_dep
from app.core.security import decode_access_token
from app.models.user import User

# HTTPBearer extracts the token from "Authorization: Bearer <token>"
_bearer = HTTPBearer(auto_error=True)

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db_dep),
) -> User:
    """
    1. Extracts the JWT from the Authorization header.
    2. Decodes and validates the token (exp, signature).
    3. Looks up the user in the database by the "sub" claim (user UUID).
    4. Returns the User ORM object.
    Raises HTTP 401 on any failure.
    """
    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise _CREDENTIALS_EXCEPTION
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise _CREDENTIALS_EXCEPTION

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise _CREDENTIALS_EXCEPTION

    return user
