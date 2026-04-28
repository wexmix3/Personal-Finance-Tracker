"""
Auth routes:
  POST /api/auth/register  — create account, return JWT
  POST /api/auth/login     — verify credentials, return JWT
  GET  /api/auth/me        — return current user (requires JWT)
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_dep
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _make_token_response(user: User) -> TokenResponse:
    """Helper: build a TokenResponse for the given user."""
    token = create_access_token(subject=str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[TokenResponse],
    summary="Create a new account",
)
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[TokenResponse]:
    # Check for duplicate email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()  # populate user.id before commit
    await db.commit()
    await db.refresh(user)

    return ApiResponse.ok(_make_token_response(user))


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    summary="Log in and receive a JWT",
)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db_dep),
) -> ApiResponse[TokenResponse]:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Use a constant-time comparison regardless of whether the user exists
    # to prevent user enumeration via timing attacks.
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return ApiResponse.ok(_make_token_response(user))


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------
@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    summary="Return the currently authenticated user",
)
async def me(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[UserResponse]:
    return ApiResponse.ok(UserResponse.model_validate(current_user))
