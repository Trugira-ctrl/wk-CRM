from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .common import KIGALI, iso, today
from .models import (AccessEvent, Branch, Config, Credential, Member, Membership,
                     MigrationRecord, NotificationEvent, Payment, Plan, SystemEvent, User)


def user_json(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "member_id": user.member_id}


def plan_json(p: Plan):
    return {"id": p.id, "name": p.name, "price": int(p.price), "duration_days": p.duration_days, "description": p.description}


def branch_json(db: Session, b: Branch):
    count = sum(e.occurred_at.astimezone(KIGALI).date() == today() and
                e.decision in ("ALLOWED", "MANUAL_OVERRIDE")
                for e in db.scalars(select(AccessEvent).where(AccessEvent.branch_id == b.id)).all())
    return {"id": b.id, "name": b.name, "type": b.type, "checkins_today": count,
            "cloud_online": b.cloud_online, "local_online": b.local_online, "last_sync": iso(b.last_sync)}


def credential_json(c: Credential):
    return {"id": c.id, "member_id": c.member_id, "type": c.type, "identifier": c.identifier, "status": c.status}


def current_membership(member: Member):
    if not member.memberships:
        return None
    return max(member.memberships, key=lambda m: (m.end_date, m.id))


def effective_status(ms: Membership):
    if ms.status == "ACTIVE" and ms.end_date < today():
        return "EXPIRED"
    if ms.status == "ACTIVE" and ms.start_date > today():
        return "PENDING"
    return ms.status


def member_json(m: Member):
    ms = current_membership(m)
    return {"id": m.id, "full_name": m.full_name, "phone": m.phone, "email": m.email,
            "branch_id": m.branch_id, "plan_id": ms.plan_id, "plan_name": ms.plan.name,
            "start_date": iso(ms.start_date), "end_date": iso(ms.end_date), "status": effective_status(ms),
            "gender": m.gender, "date_of_birth": iso(m.date_of_birth),
            "emergency_contact": m.emergency_contact, "notes": m.notes,
            "credentials": [credential_json(c) for c in m.credentials], "created_at": iso(m.created_at)}


def event_json(e: AccessEvent):
    return {"id": e.id, "member_id": e.member_id, "member_name": e.member_name,
            "branch_id": e.branch_id, "method": e.method, "decision": e.decision,
            "reason": e.reason, "occurred_at": iso(e.occurred_at), "offline": e.offline,
            "sync_status": e.sync_status}


def payment_json(p: Payment):
    return {"id": p.id, "member_id": p.member_id, "member_name": p.member.full_name,
            "amount": int(p.amount), "currency": p.currency, "provider": p.provider,
            "status": p.status, "created_at": iso(p.created_at)}


def notification_json(n: NotificationEvent):
    return {"id": n.id, "member_id": n.member_id, "member_name": n.member.full_name,
            "channel": n.channel, "status": n.status, "attempt": n.attempt,
            "created_at": iso(n.created_at), "final_status": n.final_status}


def workspace(db: Session, user: User):
    member_filter = Member.id == user.member_id if user.role == "MEMBER" else True
    members = db.scalars(select(Member).where(member_filter).options(
        selectinload(Member.credentials), selectinload(Member.memberships).selectinload(Membership.plan)
    ).order_by(Member.id)).all()
    ids = [m.id for m in members]
    events_q = select(AccessEvent).order_by(AccessEvent.occurred_at.desc()).limit(200)
    payments_q = select(Payment).options(selectinload(Payment.member)).order_by(Payment.created_at.desc()).limit(200)
    notifications_q = select(NotificationEvent).options(selectinload(NotificationEvent.member)).order_by(NotificationEvent.created_at.desc()).limit(200)
    if user.role == "MEMBER":
        events_q = events_q.where(AccessEvent.member_id == user.member_id)
        payments_q = payments_q.where(Payment.member_id == user.member_id)
        notifications_q = notifications_q.where(NotificationEvent.member_id == user.member_id)
    events = db.scalars(events_q).all()
    payments = db.scalars(payments_q).all()
    notifications = db.scalars(notifications_q).all()
    all_members = (members if user.role == "MEMBER" else
                   db.scalars(select(Member).options(
                       selectinload(Member.memberships).selectinload(Membership.plan))).all())
    statuses = [effective_status(current_membership(m)) for m in all_members]
    day = today()
    active = [current_membership(m) for m in all_members if effective_status(current_membership(m)) == "ACTIVE"]
    metrics = {
        "active_members": len(active), "expiring_week": sum(day <= m.end_date <= day + timedelta(days=7) for m in active),
        "expired_members": statuses.count("EXPIRED"),
        "checkins_today": sum(e.occurred_at.astimezone(KIGALI).date() == day and e.decision in ("ALLOWED", "MANUAL_OVERRIDE") for e in events),
        "failed_notifications": sum(n.status == "FAILED" for n in notifications),
        "payments_today": sum(int(p.amount) for p in payments if p.created_at.astimezone(KIGALI).date() == day),
        "followups": sum(n.final_status == "STAFF FOLLOW-UP REQUIRED" for n in notifications),
    }
    trend = []
    all_events = events if user.role == "MEMBER" else db.scalars(select(AccessEvent)).all()
    for offset in range(6, -1, -1):
        d = day - timedelta(days=offset)
        row = {"date": d.isoformat(), "branch1": 0, "branch2": 0, "branch3": 0}
        for e in all_events:
            if e.occurred_at.astimezone(KIGALI).date() == d and e.decision in ("ALLOWED", "MANUAL_OVERRIDE"):
                row[f"branch{e.branch_id}"] += 1
        trend.append(row)
    system = [] if user.role == "MEMBER" else [{"id": x.id, "type": x.type, "message": x.message, "created_at": iso(x.created_at)}
                                                for x in db.scalars(select(SystemEvent).order_by(SystemEvent.created_at.desc()).limit(100)).all()]
    migrations = [] if user.role == "MEMBER" else [{"id": x.id, "source_record_id": x.source_record_id, "waka_member_id": x.waka_member_id,
                                                     "status": x.status, "imported_at": iso(x.imported_at)}
                                                    for x in db.scalars(select(MigrationRecord).order_by(MigrationRecord.id.desc()).limit(100)).all()]
    generation = db.get(Config, "demo_generation")
    return {"user": user_json(user), "members": [member_json(m) for m in members],
            "plans": [plan_json(p) for p in db.scalars(select(Plan).order_by(Plan.id)).all()],
            "branches": [branch_json(db, b) for b in db.scalars(select(Branch).order_by(Branch.id)).all()],
            "access_events": [event_json(e) for e in events], "payments": [payment_json(p) for p in payments],
            "notifications": [notification_json(n) for n in notifications], "system_events": system,
            "migrations": migrations, "metrics": metrics, "visit_trend": trend,
            "demo_generation": generation.value if generation else ""}