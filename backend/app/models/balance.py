import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Balance(Base):
    """
    One row per account per day — a historical snapshot.
    The sync service upserts into this table using (account_id, snapshot_date)
    as the natural key.
    """

    __tablename__ = "balances"

    # Composite unique constraint so re-running the daily snapshot job is idempotent
    __table_args__ = (
        UniqueConstraint("account_id", "snapshot_date", name="uq_balance_account_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Plaid returns these as floats; we store as Numeric(18,2) for precision
    current: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    available: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    limit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)

    iso_currency_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------ #
    # Relationships                                                        #
    # ------------------------------------------------------------------ #
    account: Mapped["Account"] = relationship("Account", back_populates="balances")

    def __repr__(self) -> str:
        return (
            f"<Balance account_id={self.account_id} "
            f"date={self.snapshot_date} current={self.current}>"
        )
