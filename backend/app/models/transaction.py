import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    String,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Boolean,
    ARRAY,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Legacy Plaid identifier — null for manually-entered transactions
    plaid_transaction_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )

    # Positive = money out of the account (expense)
    # Negative = money into the account (income/credit)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)

    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)

    category: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    authorized_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------ #
    # Relationships                                                        #
    # ------------------------------------------------------------------ #
    account: Mapped["Account"] = relationship(
        "Account", back_populates="transactions"
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction id={self.id} name={self.name!r} "
            f"amount={self.amount} date={self.date}>"
        )
