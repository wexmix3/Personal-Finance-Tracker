"""
Security helpers:
  - Fernet symmetric encryption  → encrypt/decrypt Plaid access tokens at rest
  - bcrypt password hashing      → hash and verify user passwords
  - JWT creation + validation    → sign and decode access tokens
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the given plaintext password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* password."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Fernet encryption (for Plaid access tokens)
# ---------------------------------------------------------------------------
# Fernet uses AES-128-CBC + HMAC-SHA256 under the hood.
# The key is the FERNET_KEY env var — a URL-safe base64-encoded 32-byte key.
_fernet = Fernet(settings.FERNET_KEY.encode())


def encrypt_token(plaintext: str) -> str:
    """Encrypt a Plaid access token. Returns a URL-safe base64 ciphertext."""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """
    Decrypt a previously encrypted Plaid access token.
    Raises ValueError on tampered or corrupt ciphertext.
    """
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Token decryption failed — ciphertext is invalid or corrupt") from exc


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------
def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """
    Create a signed JWT.

    Args:
        subject: The user's UUID as a string — stored in the "sub" claim.
        extra_claims: Optional dict of additional claims to embed.

    Returns:
        Signed JWT string.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.

    Returns the full payload dict.
    Raises jose.JWTError (or subclass) if the token is expired, tampered,
    or otherwise invalid — callers convert this to a 401 response.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
