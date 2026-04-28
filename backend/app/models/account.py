import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Legacy Plaid FK — nullable so manually-created accounts don't need it
    plaid_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plaid_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Legacy Plaid account identifier — nullable for manual accounts
    plaid_account_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    official_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    institution_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # e.g. "depository", "credit", "investment", "loan"
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    # e.g. "checking", "savings", "credit card", "401k"
    subtype: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------ #
    # Relationships                                                        #
    # ------------------------------------------------------------------ #
    user: Mapped["User"] = relationship("User", back_populates="accounts")
    balances: Mapped[list["Balance"]] = relationship(
        "Balance", back_populates="account", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="account", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Account id={self.id} name={self.name!r} type={self.type!r}>"
