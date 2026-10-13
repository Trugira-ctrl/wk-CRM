"""Frozen PostgreSQL baseline; adopts the existing POC tables without data writes."""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Deliberately frozen here rather than importing changing application models.
TABLES = {
    "waka_branches": """id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE,
        type VARCHAR(20) NOT NULL, cloud_online BOOLEAN NOT NULL,
        local_online BOOLEAN NOT NULL, last_sync TIMESTAMPTZ""",
    "waka_plans": """id SERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE,
        price INTEGER NOT NULL, duration_days INTEGER NOT NULL, description TEXT NOT NULL""",
    "waka_members": """id SERIAL PRIMARY KEY, full_name VARCHAR(160) NOT NULL,
        phone VARCHAR(40) NOT NULL, email VARCHAR(320) NOT NULL UNIQUE,
        branch_id INTEGER NOT NULL REFERENCES waka_branches(id), gender VARCHAR(40),
        date_of_birth DATE, emergency_contact VARCHAR(160), notes TEXT, created_at TIMESTAMPTZ NOT NULL""",
    "waka_users": """id SERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL,
        email VARCHAR(320) NOT NULL UNIQUE, role VARCHAR(20) NOT NULL,
        member_id INTEGER UNIQUE REFERENCES waka_members(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL, is_demo_seed BOOLEAN NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_memberships": """id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES waka_members(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES waka_plans(id), start_date DATE NOT NULL,
        end_date DATE NOT NULL, status VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_credentials": """id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES waka_members(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL, identifier VARCHAR(160) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_payments": """id SERIAL PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES waka_members(id) ON DELETE CASCADE,
        amount NUMERIC(12,0) NOT NULL, currency VARCHAR(3) NOT NULL, provider VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_access_events": """id VARCHAR(36) PRIMARY KEY, member_id INTEGER REFERENCES waka_members(id) ON DELETE SET NULL,
        member_name VARCHAR(160) NOT NULL, branch_id INTEGER NOT NULL REFERENCES waka_branches(id),
        method VARCHAR(40) NOT NULL, decision VARCHAR(30) NOT NULL, reason TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL, offline BOOLEAN NOT NULL, sync_status VARCHAR(20) NOT NULL""",
    "waka_notification_events": """id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES waka_members(id) ON DELETE CASCADE,
        channel VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL, attempt INTEGER NOT NULL,
        final_status VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_migration_records": """id SERIAL PRIMARY KEY, source_record_id VARCHAR(160) NOT NULL UNIQUE,
        source_email VARCHAR(320) NOT NULL, waka_member_id INTEGER REFERENCES waka_members(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL, imported_at TIMESTAMPTZ NOT NULL, details TEXT""",
    "waka_system_events": """id SERIAL PRIMARY KEY, type VARCHAR(60) NOT NULL,
        message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_sessions": """id SERIAL PRIMARY KEY, token_hash VARCHAR(64) NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES waka_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL""",
    "waka_config": "key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL",
}


def upgrade():
    for table, columns in TABLES.items():
        op.execute(f"CREATE TABLE IF NOT EXISTS {table} ({columns})")
    for table in ("members", "users"):
        op.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS uq_waka_{table}_email_lower ON waka_{table} (lower(email))")
    for table, column in (
        ("members", "email"), ("users", "email"), ("memberships", "member_id"),
        ("credentials", "member_id"), ("credentials", "identifier"), ("payments", "member_id"),
        ("access_events", "member_id"), ("access_events", "occurred_at"),
        ("notification_events", "member_id"), ("system_events", "created_at"), ("sessions", "token_hash"),
    ):
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_waka_{table}_{column} ON waka_{table} ({column})")


def downgrade():
    raise RuntimeError("Destructive baseline downgrade disabled. Restore a verified backup instead.")
