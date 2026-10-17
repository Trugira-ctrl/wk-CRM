"""Isolated MTN sandbox payments; never credits member RWF wallets."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("waka_momo_sandbox_payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("waka_users.id"), nullable=False),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("scenario", sa.String(20), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("credited_minor", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("provider_transaction_id", sa.String(160), unique=True),
        sa.Column("provider_response", sa.Text(), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("amount_minor >= 100 AND amount_minor <= 100000 AND credited_minor IN (0, amount_minor)", name="ck_momo_sandbox_amount"))


def downgrade():
    raise RuntimeError("Preserve payment evidence; use reviewed forward recovery.")
