"""Add simulated gym credit and protect profile saves from stale purchases."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("waka_members", sa.Column("version", sa.Integer(), nullable=False, server_default="0"))
    op.create_table("waka_wallet_accounts",
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("waka_members.id"), primary_key=True),
        sa.Column("balance", sa.Integer(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False),
        sa.Column("topup_blocked_until", sa.Date()),
        sa.CheckConstraint("balance >= 0 AND reserved >= 0 AND reserved <= balance", name="ck_wallet_funds"))
    op.create_table("waka_wallet_operations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("waka_members.id"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("waka_users.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("remaining", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(100), nullable=False),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("source_phone", sa.String(40)),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("member_id", "idempotency_key", name="uq_wallet_member_key"),
        sa.CheckConstraint("amount > 0 AND remaining >= 0 AND remaining <= amount", name="ck_wallet_operation_amount"))
    op.create_index("ix_waka_wallet_operations_member_id", "waka_wallet_operations", ["member_id"])
    op.create_table("waka_wallet_refund_allocations",
        sa.Column("refund_id", sa.String(36), sa.ForeignKey("waka_wallet_operations.id"), primary_key=True),
        sa.Column("deposit_id", sa.String(36), sa.ForeignKey("waka_wallet_operations.id"), primary_key=True),
        sa.Column("amount", sa.Integer(), nullable=False), sa.CheckConstraint("amount > 0"))
    op.create_table("waka_wallet_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("waka_members.id"), nullable=False),
        sa.Column("operation_id", sa.String(36), sa.ForeignKey("waka_wallet_operations.id"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("waka_users.id"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        *[sa.Column(name, sa.Integer(), nullable=False) for name in
          ("balance_delta", "reserved_delta", "balance_after", "reserved_after")],
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("operation_id", "kind", name="uq_wallet_entry_phase"))
    op.create_index("ix_waka_wallet_entries_member_id", "waka_wallet_entries", ["member_id"])


def downgrade():
    raise RuntimeError("Financial history must be preserved. Use reviewed forward recovery.")
