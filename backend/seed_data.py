import uuid
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from .common import now, today
from .models import (AccessEvent, Branch, Config, Credential, Member, Membership,
                     MigrationRecord, NotificationEvent, Payment, Plan, Session as LoginSession,
                     SystemEvent, User, RenewalOperation, WalletAccount, WalletOperation,
                     WalletEntry, WalletRefundAllocation)
from .security import hash_password

DEMO_PASSWORD = "WakaDemo2026!"


def _at(day, hour=9, minute=0):
    return datetime.combine(day, time(hour, minute), tzinfo=timezone(timedelta(hours=2))).astimezone(timezone.utc)


def clear_owned_data(db: Session):
    for model in (WalletEntry, WalletRefundAllocation, WalletOperation, WalletAccount,
                  RenewalOperation, LoginSession, MigrationRecord, NotificationEvent, AccessEvent, Payment,
                  Credential, User, Membership, Member, SystemEvent, Plan, Branch, Config):
        db.execute(delete(model))


def seed(db: Session, reset: bool = False):
    existing = sum((db.scalar(select(func.count()).select_from(model)) or 0)
                   for model in (Config, User, Member, Membership, Credential, Payment,
                                 AccessEvent, NotificationEvent, MigrationRecord,
                                 SystemEvent, LoginSession, Plan, Branch))
    if existing and not reset:
        return False
    if reset:
        clear_owned_data(db)
        db.flush()
    day = today()
    db.add_all([
        Branch(id=1, name="Branch 1", type="GATED", cloud_online=True, local_online=True, last_sync=now()),
        Branch(id=2, name="Branch 2", type="RECEPTION", cloud_online=True, local_online=True, last_sync=now()),
        Branch(id=3, name="Branch 3", type="RECEPTION", cloud_online=True, local_online=True, last_sync=now()),
        Plan(id=1, name="Monthly", price=75000, duration_days=30, description="Illustrative 30-day membership"),
        Plan(id=2, name="Quarterly", price=200000, duration_days=90, description="Illustrative 90-day membership"),
        Plan(id=3, name="Annual", price=720000, duration_days=365, description="Illustrative annual membership"),
        Config(key="demo_generation", value=str(uuid.uuid4())),
    ])
    db.flush()
    member_rows = [
        (1, "Aline Uwase", "aline@waka.demo", "+250788100101", 2, 1, day-23*timedelta(days=1), day+timedelta(days=7), "ACTIVE"),
        (2, "Eric Nshimiyimana", "eric@waka.demo", "+250788100102", 1, 1, day-timedelta(days=38), day-timedelta(days=8), "ACTIVE"),
        (3, "Patrick Habimana", "patrick@waka.demo", "+250788100103", 1, 2, day-timedelta(days=22), day+timedelta(days=68), "ACTIVE"),
        (4, "Alice Mukamana", "alice@waka.demo", "+250788100104", 3, 1, day-timedelta(days=8), day+timedelta(days=22), "ACTIVE"),
        (5, "Kevin Mugabo", "kevin@waka.demo", "+250788100105", 2, 3, day-timedelta(days=100), day+timedelta(days=265), "ACTIVE"),
    ]
    created = _at(day-timedelta(days=100))
    for mid, name, email, phone, branch, plan, start, end, status in member_rows:
        db.add(Member(id=mid, full_name=name, email=email, phone=phone, branch_id=branch,
                      gender=None, date_of_birth=None, emergency_contact=None,
                      notes="Fictional demonstration member", created_at=created))
        db.add(Membership(id=mid, member_id=mid, plan_id=plan, start_date=start, end_date=end,
                          status=status, created_at=created))
    db.flush()
    for cid, mid, ident, status in [
        (1, 2, "04-EC-20-11-02-01", "ACTIVE"), (2, 3, "04-PA-73-19-55-02", "ACTIVE"),
        (3, 4, "04-AL-44-38-90-03", "DISABLED"), (4, 5, "04-KE-82-71-14-04", "ACTIVE")]:
        db.add(Credential(id=cid, member_id=mid, type="CARD", identifier=ident,
                          status=status, created_at=created))
    pwd = hash_password(DEMO_PASSWORD)
    users = [
        (1, "WAKA Admin", "admin@waka.demo", "ADMIN", None),
        (2, "WAKA Management", "management@waka.demo", "MANAGEMENT", None),
        (3, "WAKA Reception", "reception@waka.demo", "RECEPTION", None),
        (4, "Aline Uwase", "aline@waka.demo", "MEMBER", 1),
        (5, "Eric Nshimiyimana", "eric@waka.demo", "MEMBER", 2),
    ]
    db.add_all([User(id=i, name=n, email=e, role=r, member_id=m, password_hash=pwd,
                     is_demo_seed=True, created_at=now()) for i, n, e, r, m in users])
    # Authentic-looking fictional records: deterministic counts derived from persisted events.
    event_no = 0
    for offset in range(6, -1, -1):
        d = day - timedelta(days=offset)
        count = 4 + ((offset * 3) % 4)
        for j in range(count):
            event_no += 1
            mid = [1, 3, 4, 5][(offset + j) % 4]
            branch = [2, 1, 3, 2][(offset + j) % 4]
            method = "SPEEDGATE_CARD" if branch == 1 else ("RECEPTION_QR" if j % 3 == 0 else "RECEPTION_CARD")
            db.add(AccessEvent(id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"waka-demo-{event_no}")),
                member_id=mid, member_name=member_rows[mid-1][1], branch_id=branch, method=method,
                decision="ALLOWED", reason="Membership valid", occurred_at=_at(d, 6+(j*2)%13, (j*11)%60),
                offline=False, sync_status="SYNCED"))
    payment_id = 1
    for offset, mid, plan in [(6,3,2),(4,4,1),(2,5,3),(0,1,1)]:
        db.add(Payment(id=payment_id, member_id=mid, amount=[0,75000,200000,720000][plan],
                       currency="RWF", provider="SIMULATED", status="SUCCESS",
                       created_at=_at(day-timedelta(days=offset), 10)))
        payment_id += 1
    for nid, mid, channel, status, attempt, final, minute in [
        (1,1,"WHATSAPP","FAILED",1,"CONTACTED",0), (2,1,"WHATSAPP","FAILED",2,"CONTACTED",1),
        (3,1,"SMS","DELIVERED",3,"CONTACTED",2),
        (4,5,"WHATSAPP","FAILED",1,"STAFF FOLLOW-UP REQUIRED",3),
        (5,5,"WHATSAPP","FAILED",2,"STAFF FOLLOW-UP REQUIRED",4),
        (6,5,"SMS","FAILED",3,"STAFF FOLLOW-UP REQUIRED",5),
        (7,5,"EMAIL","FAILED",4,"STAFF FOLLOW-UP REQUIRED",6)]:
        db.add(NotificationEvent(id=nid, member_id=mid, channel=channel, status=status,
                                 attempt=attempt, final_status=final,
                                 created_at=_at(day-timedelta(days=1), 11, minute)))
    db.add(SystemEvent(type="DEMO_SEEDED", message="Fictional WAKA demonstration data initialized", created_at=now()))
    db.flush()
    # Explicit demo IDs remain predictable; advance PostgreSQL identity sequences so
    # later user-created records cannot collide with those IDs.
    for table in ("waka_branches", "waka_plans", "waka_members", "waka_memberships",
                  "waka_credentials", "waka_users", "waka_payments",
                  "waka_notification_events", "waka_system_events"):
        db.execute(text(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
            f"(SELECT MAX(id) FROM {table}), true)"
        ))
    db.commit()
    return True
