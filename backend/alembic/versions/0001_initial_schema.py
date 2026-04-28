"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-13 00:00:00.000000

Creates all five core tables:
  users, plaid_items, accounts, balances, transactions
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # users                                                                #
    # ------------------------------------------------------------------ #
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ------------------------------------------------------------------ #
    # plaid_items                                                          #
    # ------------------------------------------------------------------ #
    op.create_table(
        "plaid_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("encrypted_access_token", sa.Text, nullable=False),
        sa.Column("item_id", sa.String(255), nullable=False),
        sa.Column("institution_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_plaid_items_user_id", "plaid_items", ["user_id"])
    op.create_index("ix_plaid_items_item_id", "plaid_items", ["item_id"], unique=True)

    # ------------------------------------------------------------------ #
    # accounts                                                             #
    # ------------------------------------------------------------------ #
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plaid_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plaid_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plaid_account_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("official_name", sa.String(255), nullable=True),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("subtype", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_index("ix_accounts_plaid_item_id", "accounts", ["plaid_item_id"])
    op.create_index(
        "ix_accounts_plaid_account_id", "accounts", ["plaid_account_id"], unique=True
    )

    # ------------------------------------------------------------------ #
    # balances                                                             #
    # ------------------------------------------------------------------ #
    op.create_table(
        "balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("current", sa.Numeric(18, 2), nullable=True),
        sa.Column("available", sa.Numeric(18, 2), nullable=True),
        sa.Column("limit", sa.Numeric(18, 2), nullable=True),
        sa.Column("iso_currency_code", sa.String(10), nullable=True),
        sa.Column("snapshot_date", sa.Date, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("account_id", "snapshot_date", name="uq_balance_account_date"),
    )
    op.create_index("ix_balances_account_id", "balances", ["account_id"])
    op.create_index("ix_balances_snapshot_date", "balances", ["snapshot_date"])

    # ------------------------------------------------------------------ #
    # transactions                                                         #
    # ------------------------------------------------------------------ #
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plaid_transaction_id", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("merchant_name", sa.String(255), nullable=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("category", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("authorized_date", sa.Date, nullable=True),
        sa.Column("pending", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"])
    op.create_index(
        "ix_transactions_plaid_transaction_id",
        "transactions",
        ["plaid_transaction_id"],
        unique=True,
    )
    op.create_index("ix_transactions_date", "transactions", ["date"])


def downgrade() -> None:
    op.drop_table("transactions")
    op.drop_table("balances")
    op.drop_table("accounts")
    op.drop_table("plaid_items")
    op.drop_table("users")
