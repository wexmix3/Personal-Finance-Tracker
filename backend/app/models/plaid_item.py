import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PlaidItem(Base):
    """
    One PlaidItem == one institution linked via Plaid Link.
    A user can have multiple items (e.g., Chase + Fidelity).
    The access token is stored encrypted at rest via Fernet.
    """

    __tablename__ = "plaid_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # NEVER expose this column in API responses
    encrypted_access_token: Mapped[str] = mapped_column(Text, nullable=False)

    item_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    institution_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------ #
    # Relationships                                                        #
    # ------------------------------------------------------------------ #
    user: Mapped["User"] = relationship("User", back_populates="plaid_items")

    def __repr__(self) -> str:
        return f"<PlaidItem id={self.id} institution={self.institution_name!r}>"
