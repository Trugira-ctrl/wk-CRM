"""Durable purchase identities and reporting indexes. Additive; no data rewrite."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("waka_renewal_operations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("member_id", sa.Integer(), sa.ForeignKey("waka_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("waka_users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(100), nullable=False),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("waka_payments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("membership_id", sa.Integer(), sa.ForeignKey("waka_memberships.id", ondelete="CASCADE"), unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("result", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("member_id", "idempotency_key", name="uq_renewal_member_key"))
    op.create_index("ix_waka_payments_reporting", "waka_payments", ["created_at", "status", "provider"])
    op.create_index("ix_waka_access_branch_time", "waka_access_events", ["branch_id", "occurred_at"])


def downgrade():
    raise RuntimeError("Purchase history must not be deleted. Use reviewed forward recovery or restore.")
