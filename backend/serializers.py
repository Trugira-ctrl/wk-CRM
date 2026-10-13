from datetime import datetime, time, timedelta, timezone
import json

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from .common import KIGALI, iso, today
from .config import DEMO_MODE, ENVIRONMENT
from .models import (AccessEvent, Branch, Config, Credential, Member, Membership,
                     MigrationRecord, NotificationEvent, Payment, Plan, SystemEvent, User)


def user_json(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "member_id": user.member_id}


def plan_json(p: Plan):
    return {"id": p.id, "name": p.name, "price": int(p.price), "duration_days": p.duration_days, "description": p.description}


def day_start(day):
    return datetime.combine(day, time.min, tzinfo=KIGALI).astimezone(timezone.utc)


def branch_checkins_today(db: Session):
    start = day_start(today())
    return dict(db.execute(select(AccessEvent.branch_id, func.count()).where(
        AccessEvent.occurred_at >= start,
        AccessEvent.occurred_at < start + timedelta(days=1),
        AccessEvent.decision.in_(("ALLOWED", "MANUAL_OVERRIDE")),
    ).group_by(AccessEvent.branch_id)).all())


def visit_trend(db: Session, member_id=None):
    """Aggregate only the visible week in SQL, never hydrate the full visit log."""
    days = [today() - timedelta(days=offset) for offset in range(6, -1, -1)]
    starts = [day_start(day) for day in days]
    columns = [func.sum(case((and_(
        AccessEvent.occurred_at >= start,
        AccessEvent.occurred_at < start + timedelta(days=1),
    ), 1), else_=0)) for start in starts]
    query = select(AccessEvent.branch_id, *columns).where(
        AccessEvent.occurred_at >= starts[0],
        AccessEvent.occurred_at < starts[-1] + timedelta(days=1),
        AccessEvent.decision.in_(("ALLOWED", "MANUAL_OVERRIDE")),
    ).group_by(AccessEvent.branch_id)
    if member_id is not None:
        query = query.where(AccessEvent.member_id == member_id)
    counts = {row[0]: row[1:] for row in db.execute(query)}
    return [{"date": day.isoformat(), **{
        f"branch{branch}": int(counts.get(branch, [0] * 7)[i]) for branch in (1, 2, 3)
    }} for i, day in enumerate(days)]


def branch_json(db: Session, b: Branch, counts=None):
    count = (branch_checkins_today(db) if counts is None else counts).get(b.id, 0)
    return {"id": b.id, "name": b.name, "type": b.type, "checkins_today": count,
            "cloud_online": b.cloud_online, "local_online": b.local_online, "last_sync": iso(b.last_sync)}


def credential_json(c: Credential):
    return {"id": c.id, "member_id": c.member_id, "type": c.type, "identifier": c.identifier, "status": c.status}


def current_membership(member: Member):
    if not member.memberships:
        return None
    return max(member.memberships, key=lambda m: (m.end_date, m.id))


def effective_status(ms: Membership):
    if ms is None:
        return "MISSING"
    if ms.status == "ACTIVE" and ms.end_date < today():
        return "EXPIRED"
    if ms.status == "ACTIVE" and ms.start_date > today():
        return "PENDING"
    return ms.status


def member_json(m: Member):
    ms = current_membership(m)
    return {"id": m.id, "full_name": m.full_name, "phone": m.phone, "email": m.email,
            "branch_id": m.branch_id, "plan_id": ms.plan_id if ms else None, "plan_name": ms.plan.name if ms else "No membership",
            "start_date": iso(ms.start_date) if ms else None, "end_date": iso(ms.end_date) if ms else None, "status": effective_status(ms),
            "gender": m.gender, "date_of_birth": iso(m.date_of_birth),
            "emergency_contact": m.emergency_contact, "notes": m.notes,
            "credentials": [credential_json(c) for c in m.credentials], "created_at": iso(m.created_at)}


def event_json(e: AccessEvent):
    return {"id": e.id, "member_id": e.member_id, "member_name": e.member_name,
            "branch_id": e.branch_id, "method": e.method, "decision": "ALLOWED" if e.decision == "MANUAL_OVERRIDE" else e.decision,
            "reason": e.reason, "occurred_at": iso(e.occurred_at), "offline": e.offline,
            "sync_status": e.sync_status}


def payment_json(p: Payment):
    return {"id": p.id, "member_id": p.member_id, "member_name": p.member.full_name,
            "amount": int(p.amount), "currency": p.currency, "provider": p.provider,
            "status": p.status, "created_at": iso(p.created_at)}


def notification_json(n: NotificationEvent, run_id: str):
    return {"id": n.id, "member_id": n.member_id, "member_name": n.member.full_name,
            "channel": n.channel, "status": n.status, "attempt": n.attempt,
            "created_at": iso(n.created_at), "final_status": n.final_status, "run_id": run_id}


def notification_runs(db, notifications):
    """Project immutable historical attempts; never backfill guesses into storage."""
    by_id = {n.id: n for n in notifications}
    assigned, runs = set(), []

    def timestamp(n):
        return n.created_at.replace(tzinfo=timezone.utc) if n.created_at.tzinfo is None else n.created_at

    def add(run_id, attempts, legacy, uncertain=False):
        assigned.update(n.id for n in attempts)
        runs.append({"id": run_id, "member_id": attempts[0].member_id,
                     "member_name": attempts[0].member.full_name,
                     "started_at": iso(min(timestamp(n) for n in attempts)),
                     "final_status": "UNKNOWN LEGACY OUTCOME" if uncertain else attempts[-1].final_status,
                     "legacy": legacy, "uncertain": uncertain,
                     "attempts": [notification_json(n, run_id) for n in attempts]})

    for entry in db.scalars(select(Config).where(Config.key.startswith("notification_run:"))):
        ids = json.loads(entry.value)["event_ids"]
        attempts = sorted((by_id[i] for i in ids if i in by_id), key=lambda n: n.attempt)
        if attempts:
            add(entry.key.split(":", 1)[1], attempts, False)
    # Legacy sequences are inferred only when a complete, uninterrupted known
    # simulator pattern exists for the member. Everything else remains uncertain.
    members = {}
    for n in sorted(notifications, key=lambda n: n.id):
        if n.id not in assigned:
            members.setdefault(n.member_id, []).append(n)
    for attempts in members.values():
        i = 0
        while i < len(attempts):
            first = attempts[i]
            size = 4 if first.final_status == "STAFF FOLLOW-UP REQUIRED" else 3
            candidate = attempts[i:i + size]
            pattern = [("WHATSAPP", "FAILED"), ("WHATSAPP", "FAILED"),
                       ("SMS", "FAILED"), ("EMAIL", "FAILED")] if size == 4 else [
                       ("WHATSAPP", "FAILED"), ("WHATSAPP", "FAILED"), ("SMS", "DELIVERED")]
            complete = (len(candidate) == size and
                        first.final_status in {"CONTACTED", "STAFF FOLLOW-UP REQUIRED"} and
                        all(n.attempt == j + 1 and (n.channel, n.status) == pattern[j] and
                            n.final_status == first.final_status for j, n in enumerate(candidate)) and
                        all(0 <= (timestamp(b) - timestamp(a)).total_seconds() <= 120
                            for a, b in zip(candidate, candidate[1:])))
            add(f"legacy-{first.id}", candidate if complete else [first], True, not complete)
            i += size if complete else 1
    return sorted(runs, key=lambda r: r["started_at"], reverse=True)


def workspace(db: Session, user: User):
    member_filter = Member.id == user.member_id if user.role == "MEMBER" else True
    members = db.scalars(select(Member).where(member_filter).options(
        selectinload(Member.credentials), selectinload(Member.memberships).joinedload(Membership.plan)
    ).order_by(Member.id)).all()
    events_q = select(AccessEvent).order_by(AccessEvent.occurred_at.desc()).limit(200)
    payments_q = select(Payment).options(joinedload(Payment.member)).order_by(Payment.created_at.desc()).limit(200)
    notifications_q = select(NotificationEvent).options(joinedload(NotificationEvent.member)).order_by(NotificationEvent.created_at.desc())
    if user.role == "MEMBER":
        events_q = events_q.where(AccessEvent.member_id == user.member_id)
        payments_q = payments_q.where(Payment.member_id == user.member_id)
        notifications_q = notifications_q.where(NotificationEvent.member_id == user.member_id)
    events = db.scalars(events_q).all()
    payments = db.scalars(payments_q).all()
    notifications = db.scalars(notifications_q).all()
    runs = notification_runs(db, notifications)
    failed_chains = sum(r["final_status"] == "STAFF FOLLOW-UP REQUIRED" for r in runs)
    failed_attempts = sum(n.status == "FAILED" for n in notifications)
    all_members = members
    statuses = [effective_status(current_membership(m)) for m in all_members]
    day = today()
    trend = visit_trend(db, (user.member_id or -1) if user.role == "MEMBER" else None)
    branch_counts = (branch_checkins_today(db) if user.role == "MEMBER" else
                     {branch: trend[-1][f"branch{branch}"] for branch in (1, 2, 3)})
    active = [current_membership(m) for m in all_members if effective_status(current_membership(m)) == "ACTIVE"]
    revenue_query = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.status == "SUCCESS", Payment.currency == "RWF",
        Payment.created_at >= day_start(day),
        Payment.created_at < day_start(day + timedelta(days=1)))
    demo = DEMO_MODE and ENVIRONMENT != "production"
    # With no real provider yet, production totals must be zero, never inferred
    # from arbitrary provider strings or historical simulator rows.
    revenue_query = revenue_query.where(Payment.provider == "SIMULATED" if demo else False)
    if user.role == "MEMBER":
        revenue_query = revenue_query.where(Payment.member_id == user.member_id)
    metrics = {
        "active_members": len(active), "expiring_week": sum(day <= m.end_date <= day + timedelta(days=7) for m in active),
        "expired_members": statuses.count("EXPIRED"),
        "checkins_today": sum(trend[-1][f"branch{branch}"] for branch in (1, 2, 3)),
        "failed_notifications": failed_attempts, "notification_failures": failed_attempts,
        "failed_notification_attempts": failed_attempts, "failed_notification_chains": failed_chains,
        "followup_count": failed_chains,
        "payments_today": int(db.scalar(revenue_query)),
        "followups": failed_chains,
    }
    system = [] if user.role == "MEMBER" else [{"id": x.id, "type": x.type, "message": x.message, "created_at": iso(x.created_at)}
                                                for x in db.scalars(select(SystemEvent).order_by(SystemEvent.created_at.desc()).limit(100)).all()]
    migrations = [] if user.role != "ADMIN" else [{"id": x.id, "source_record_id": x.source_record_id, "waka_member_id": x.waka_member_id,
                                                     "status": x.status, "imported_at": iso(x.imported_at)}
                                                    for x in db.scalars(select(MigrationRecord).order_by(MigrationRecord.id.desc())).all()]
    generation = db.get(Config, "demo_generation")
    return {"user": user_json(user), "members": [member_json(m) for m in members],
            "plans": [plan_json(p) for p in db.scalars(select(Plan).order_by(Plan.id)).all()],
            "branches": [branch_json(db, b, branch_counts) for b in db.scalars(select(Branch).order_by(Branch.id)).all()],
            "access_events": [event_json(e) for e in events], "payments": [payment_json(p) for p in payments],
            "notifications": [n for r in runs for n in r["attempts"]], "notification_runs": runs, "system_events": system,
            "migrations": migrations, "metrics": metrics, "visit_trend": trend,
            "demo_generation": generation.value if generation else "", "demo_mode": demo}