"""Only executed by the disposable PostgreSQL harness. Fictional data only."""
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from sqlalchemy import MetaData, func, select, text
from .common import now
from .db import Base, engine, SessionLocal
from .models import Branch, Config, Member, Membership, Payment, Plan, RenewalOperation, User
from .services import create_member, run_action
from .serializers import workspace


def main():
    if os.environ.get("WAKA_ISOLATED_TEST") != "1" or engine.url.host != "127.0.0.1":
        raise SystemExit("Refusing to test outside the explicit disposable local cluster")
    # Recreate the pre-stabilization schema from metadata, excluding new objects.
    # This is an isolated database, not the application database.
    legacy = MetaData()
    for table in Base.metadata.sorted_tables:
        if table.name != "waka_renewal_operations" and not table.name.startswith("waka_wallet_"):
            table.to_metadata(legacy)
    legacy.tables["waka_members"]._columns.remove(legacy.tables["waka_members"].c.version)
    for table in legacy.tables.values():
        table.indexes = {index for index in table.indexes if index.name not in {
            "ix_waka_payments_reporting", "ix_waka_access_branch_time"}}
    legacy.create_all(engine)
    with SessionLocal() as db:
        db.add_all([Branch(id=i, name=f"Test {i}", type="GATED" if i == 1 else "RECEPTION") for i in (1, 2, 3)])
        db.add(Plan(id=1, name="Test plan", price=12345, duration_days=37, description="Fictional"))
        db.add(Config(key="demo_generation", value="test"))
        admin = User(name="Test", email="test@example.test", role="ADMIN", password_hash="unused", created_at=now())
        db.add(admin); db.commit()
        actor_id = admin.id
        db.execute(text("ALTER TABLE waka_members ADD COLUMN version INTEGER NOT NULL DEFAULT 0"))
        member, _ = create_member(db, dict(full_name="Fictional", email="member@example.test",
                                          phone="fictional", branch_id=1, plan_id=1))
        db.commit()
        member_id = member.id
        initial = db.scalar(select(func.max(Membership.end_date)))
        before = {table.name: [tuple(row) for row in db.execute(select(table))]
                  for table in legacy.sorted_tables}
        db.execute(text("ALTER TABLE waka_members DROP COLUMN version"))
        db.commit()
    from .migrate import main as migrate
    migrate()
    migrate()
    with SessionLocal() as db:
        after = {table.name: [tuple(row) for row in db.execute(select(table))]
                 for table in legacy.sorted_tables}
        assert before == after, "Migration changed existing data"
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "0003"
    print("Legacy-schema migration, exact data preservation, repeated upgrade: PASS")
    purchases = 0
    for concurrency in (10, 25, 50, 100):
        for duplicate in (False, True):
            key = str(uuid.uuid4())
            def purchase(i):
                with SessionLocal() as db:
                    actor = db.get(User, actor_id)
                    return run_action(db, actor, dict(action="renew_membership", member_id=member_id,
                        plan_id=1, idempotency_key=key if duplicate else f"{key}-{i}"))
            started = time.perf_counter()
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                results = list(pool.map(purchase, range(concurrency)))
            purchases += 1 if duplicate else concurrency
            with SessionLocal() as db:
                assert db.scalar(select(func.max(Membership.end_date))) == initial + timedelta(days=37 * purchases)
                assert db.scalar(select(func.count()).select_from(Payment)) == purchases + 1
                assert db.scalar(select(func.count()).select_from(RenewalOperation)) == purchases
                assert db.scalar(select(func.sum(Payment.amount))) == (purchases + 1) * 12345
                assert len({r["operation_id"] for r in results}) == (1 if duplicate else concurrency)
            print(f"renewal concurrency={concurrency} duplicate={duplicate}: PASS ({time.perf_counter()-started:.2f}s)")
        def read(_):
            started = time.perf_counter()
            with SessionLocal() as db:
                result = workspace(db, db.get(User, actor_id))
                assert result["members"][0]["id"] == member_id
            return time.perf_counter() - started
        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            times = sorted(pool.map(read, range(concurrency)))
        print(f"workspace concurrency={concurrency} errors=0 avg={sum(times)/len(times):.3f}s "
              f"p95={times[max(0, int(len(times)*.95)-1)]:.3f}s throughput={concurrency/(time.perf_counter()-started):.1f}/s")
        assert engine.pool.checkedout() == 0
    print(f"Final financial verification: {purchases} purchases; {purchases*37} added days; exact payment reconciliation PASS")
    from .http_workload import run
    run(actor_id, member_id)


if __name__ == "__main__":
    main()
