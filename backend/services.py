import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .common import normalize_email, now, parse_date, required_string, today
from .config import DEMO_MODE
from .models import (AccessEvent, Branch, Config, Credential, Member, Membership,
                     MigrationRecord, NotificationEvent, Payment, Plan, SystemEvent, User)
from .security import create_session, hash_password
from .seed_data import seed
from .serializers import current_membership, effective_status, event_json, member_json, plan_json

STAFF = {"ADMIN", "MANAGEMENT", "RECEPTION"}
METHODS = {1: {"SPEEDGATE_CARD"}, 2: {"RECEPTION_CARD", "RECEPTION_QR", "MANUAL_RECEPTION"},
           3: {"RECEPTION_CARD", "RECEPTION_QR", "MANUAL_RECEPTION"}}


def require(condition, status, detail):
    if not condition:
        raise HTTPException(status, detail=detail)


def get_member(db, member_id):
    member = db.scalar(select(Member).where(Member.id == member_id).options(
        selectinload(Member.credentials), selectinload(Member.memberships).selectinload(Membership.plan)))
    require(member, 404, "Member not found")
    return member


def validate_member_input(db: Session, data: dict, existing: Member | None = None):
    require(isinstance(data, dict), 400, "member is required")
    full_name = required_string(data.get("full_name"), "Full name")
    email = normalize_email(data.get("email"))
    phone = required_string(data.get("phone"), "Phone", 40)
    try:
        branch_id, plan_id = int(data.get("branch_id")), int(data.get("plan_id"))
    except (TypeError, ValueError):
        raise HTTPException(400, detail="Valid branch_id and plan_id are required")
    branch, plan = db.get(Branch, branch_id), db.get(Plan, plan_id)
    require(branch, 400, "Unknown branch")
    require(plan, 400, "Unknown plan")
    duplicate = db.scalar(select(Member).where(func.lower(Member.email) == email))
    require(not duplicate or (existing and duplicate.id == existing.id), 409, "A member with this email already exists")
    start = parse_date(data.get("start_date"), "start_date", True) or (current_membership(existing).start_date if existing else today())
    end = parse_date(data.get("end_date"), "end_date", True) or (current_membership(existing).end_date if existing else start + timedelta(days=plan.duration_days))
    require(end >= start, 400, "end_date must be on or after start_date")
    dob = parse_date(data.get("date_of_birth"), "date_of_birth", True)
    require(not dob or dob < today(), 400, "date_of_birth must be in the past")
    password = data.get("password")
    if password is not None:
        require(isinstance(password, str) and len(password) >= 8, 400, "Password must contain at least 8 characters")
    return {"full_name": full_name, "email": email, "phone": phone, "branch_id": branch_id,
            "plan": plan, "start": start, "end": end, "dob": dob, "password": password,
            "gender": str(data.get("gender") or "").strip() or None,
            "emergency_contact": str(data.get("emergency_contact") or "").strip() or None,
            "notes": str(data.get("notes") or "").strip() or None}


def create_member(db: Session, data: dict, record_default=True, create_login=False):
    v = validate_member_input(db, data)
    m = Member(full_name=v["full_name"], email=v["email"], phone=v["phone"], branch_id=v["branch_id"],
               gender=v["gender"], date_of_birth=v["dob"], emergency_contact=v["emergency_contact"],
               notes=v["notes"], created_at=now())
    db.add(m)
    db.flush()
    ms = Membership(member_id=m.id, plan_id=v["plan"].id, start_date=v["start"], end_date=v["end"],
                    status="ACTIVE", created_at=now())
    db.add(ms)
    if bool(data.get("record_payment", record_default)):
        db.add(Payment(member_id=m.id, amount=v["plan"].price, currency="RWF",
                       provider="SIMULATED", status="SUCCESS", created_at=now()))
    user = None
    if create_login or v["password"]:
        require(v["password"], 400, "Password is required")
        require(not db.scalar(select(User).where(func.lower(User.email) == v["email"])), 409, "A login with this email already exists")
        user = User(name=m.full_name, email=m.email, role="MEMBER", member_id=m.id,
                    password_hash=hash_password(v["password"]), is_demo_seed=False, created_at=now())
        db.add(user)
    db.flush()
    db.refresh(m)
    return m, user


def audit(db, kind, message):
    db.add(SystemEvent(type=kind, message=message, created_at=now()))


def parse_migration(db: Session, raw: str):
    require(isinstance(raw, str), 400, "csv text is required")
    require(len(raw.encode("utf-8")) <= 1_000_000, 400, "CSV exceeds 1 MB")
    try:
        reader = csv.DictReader(io.StringIO(raw))
        require(reader.fieldnames is not None, 400, "CSV header is required")
        required = {"source_record_id", "full_name", "email", "phone", "plan", "start_date", "end_date", "branch_id"}
        require(required.issubset({x.strip() for x in reader.fieldnames}), 400, "CSV header must include: " + ", ".join(sorted(required)))
        records = list(reader)
    except csv.Error as exc:
        raise HTTPException(400, detail=f"Invalid CSV: {exc}")
    require(len(records) <= 500, 400, "CSV is limited to 500 rows")
    seen_ids, seen_emails = set(), set()
    db_ids = set(db.scalars(select(MigrationRecord.source_record_id)).all())
    db_emails = set(db.scalars(select(Member.email)).all()) | set(db.scalars(select(MigrationRecord.source_email)).all())
    plans = {p.name.lower(): p for p in db.scalars(select(Plan)).all()}
    branches = set(db.scalars(select(Branch.id)).all())
    result = []
    for source in records:
        row = {k: str(source.get(k) or "").strip() for k in required}
        issues = []
        sid, email = row["source_record_id"], row["email"].lower()
        if not sid: issues.append("Missing source record ID")
        if not row["full_name"]: issues.append("Missing full name")
        if not row["phone"]: issues.append("Missing phone")
        try: email = normalize_email(email)
        except HTTPException: issues.append("Invalid email")
        if sid in seen_ids: issues.append("Duplicate source record ID in file")
        if email in seen_emails: issues.append("Duplicate email in file")
        if sid in db_ids: issues.append("Source record already processed")
        if email in db_emails: issues.append("Email already exists")
        if row["plan"].lower() not in plans: issues.append("Unknown plan")
        try:
            branch_id = int(row["branch_id"])
            if branch_id not in branches: issues.append("Unknown branch")
        except ValueError:
            branch_id = 0; issues.append("Invalid branch")
        try:
            start, end = parse_date(row["start_date"], "start_date"), parse_date(row["end_date"], "end_date")
            if end < start: issues.append("End date precedes start date")
        except HTTPException:
            issues.append("Invalid membership dates")
        seen_ids.add(sid); seen_emails.add(email)
        result.append({**row, "email": email, "branch_id": branch_id, "issues": issues, "skip": False})
    return result


def run_action(db: Session, user: User, body: dict):
    action = body.get("action")
    require(action, 400, "action is required")
    if action in {"preview_migration", "import_migration", "reset_demo", "update_plan"}:
        require(user.role == "ADMIN", 403, "Administrator role required")
    elif action == "renew_membership":
        require(user.role in STAFF or user.role == "MEMBER", 403, "Not permitted")
    else:
        require(user.role in STAFF, 403, "Staff role required")

    if action == "register_member":
        m, _ = create_member(db, body.get("member"), record_default=True)
        audit(db, "MEMBER_REGISTERED", f"{m.full_name} registered by {user.email}")
        db.commit(); return {"ok": True, "message": "Member registered", "member": member_json(get_member(db, m.id))}
    if action == "update_member":
        m = get_member(db, body.get("member_id"))
        v = validate_member_input(db, body.get("member"), m)
        for field in ("full_name", "email", "phone", "branch_id", "gender", "emergency_contact", "notes"):
            setattr(m, field, v[field])
        m.date_of_birth = v["dob"]
        ms = current_membership(m); ms.plan_id = v["plan"].id; ms.start_date = v["start"]; ms.end_date = v["end"]
        linked = db.scalar(select(User).where(User.member_id == m.id))
        if linked: linked.name, linked.email = m.full_name, m.email
        audit(db, "MEMBER_UPDATED", f"{m.full_name} updated by {user.email}")
        db.commit(); return {"ok": True, "message": "Member updated", "member": member_json(get_member(db, m.id))}
    if action == "assign_card":
        m = get_member(db, body.get("member_id"))
        identifier = required_string(body.get("identifier"), "Identifier").upper()
        typ = body.get("credential_type", "CARD")
        require(typ in {"CARD", "QR"}, 400, "credential_type must be CARD or QR")
        require(not db.scalar(select(Credential).where(Credential.identifier == identifier)), 409, "Credential identifier is already assigned")
        db.add(Credential(member_id=m.id, type=typ, identifier=identifier, status="ACTIVE", created_at=now()))
        audit(db, "CREDENTIAL_ASSIGNED", f"{typ} assigned to {m.full_name}")
        db.commit(); return {"ok": True, "message": f"{typ} assigned", "member": member_json(get_member(db, m.id))}
    if action == "disable_card":
        c = db.get(Credential, body.get("credential_id"))
        require(c, 404, "Credential not found")
        c.status = "DISABLED"; audit(db, "CREDENTIAL_DISABLED", f"Credential {c.identifier} disabled")
        db.commit(); return {"ok": True, "message": "Credential disabled"}
    if action == "renew_membership":
        m = get_member(db, body.get("member_id"))
        require(user.role != "MEMBER" or user.member_id == m.id, 403, "Members may only renew their own membership")
        plan = db.get(Plan, body.get("plan_id")); require(plan, 404, "Plan not found")
        old = current_membership(m); start = max(today(), old.end_date)
        db.add(Membership(member_id=m.id, plan_id=plan.id, start_date=start,
                          end_date=start + timedelta(days=plan.duration_days), status="ACTIVE", created_at=now()))
        db.add(Payment(member_id=m.id, amount=plan.price, currency="RWF", provider="SIMULATED", status="SUCCESS", created_at=now()))
        audit(db, "MEMBERSHIP_RENEWED", f"{m.full_name} renewed {plan.name}")
        db.commit(); return {"ok": True, "message": "Membership renewed with simulated payment", "member": member_json(get_member(db, m.id))}
    if action == "checkin":
        return checkin(db, user, body)
    if action == "run_reminders":
        return reminders(db, body)
    if action == "controller_status":
        require(body.get("online") in (True, False), 400, "online boolean is required")
        branch = db.get(Branch, 1); branch.local_online = body["online"]; branch.last_sync = now() if body["online"] else branch.last_sync
        audit(db, "CONTROLLER_RESTORED" if body["online"] else "CONTROLLER_OUTAGE",
              "Branch 1 controller restored" if body["online"] else "Branch 1 controller offline; browser simulator cache may be stale")
        db.commit(); return {"ok": True, "message": "Controller status updated"}
    if action == "sync_offline":
        return sync_offline(db, body)
    if action == "preview_migration":
        rows = parse_migration(db, body.get("csv", ""))
        return {"ok": True, "message": f"Previewed {len(rows)} rows", "rows": rows}
    if action == "import_migration":
        return import_migration(db, body.get("rows"))
    if action == "update_plan":
        data = body.get("plan") or {}
        plan = db.get(Plan, data.get("id")); require(plan, 404, "Plan not found")
        name = required_string(data.get("name"), "Plan name", 80)
        try: price, duration = int(data.get("price")), int(data.get("duration_days"))
        except (TypeError, ValueError): raise HTTPException(400, detail="Price and duration must be integers")
        require(price > 0 and duration > 0, 400, "Price and duration must be positive")
        other = db.scalar(select(Plan).where(func.lower(Plan.name) == name.lower(), Plan.id != plan.id))
        require(not other, 409, "Plan name already exists")
        plan.name, plan.price, plan.duration_days = name, price, duration
        plan.description = required_string(data.get("description"), "Description", 500)
        audit(db, "PLAN_UPDATED", f"Plan {plan.name} updated")
        db.commit(); return {"ok": True, "message": "Plan updated"}
    if action == "reset_demo":
        require(DEMO_MODE, 403, "Demo reset is disabled")
        require(body.get("confirmation") == "RESET", 400, 'confirmation must be "RESET"')
        email = user.email
        seed(db, reset=True)
        replacement = db.scalar(select(User).where(User.email == email)) or db.scalar(select(User).where(User.email == "admin@waka.demo"))
        token = create_session(db, replacement); db.commit()
        return {"ok": True, "message": "Demo data reset; browser offline cache must be cleared", "_session_token": token}
    raise HTTPException(400, detail="Unsupported action")


def checkin(db: Session, user: User, body: dict):
    try: branch_id = int(body.get("branch_id"))
    except (TypeError, ValueError): raise HTTPException(400, detail="Valid branch_id is required")
    branch = db.get(Branch, branch_id); require(branch, 404, "Branch not found")
    method = body.get("method")
    require(method in METHODS[branch_id], 400, f"Method is not supported at {branch.name}")
    member, credential, reason, decision = None, None, "", "DENIED"
    if method == "MANUAL_RECEPTION":
        member = db.get(Member, body.get("member_id"))
        if not member: reason = "Unknown member"
    else:
        ident = str(body.get("identifier") or "").strip().upper()
        if ident:
            credential = db.scalar(select(Credential).where(Credential.identifier == ident))
        if not credential:
            reason = "Unknown credential"
        else:
            member = db.get(Member, credential.member_id)
            expected = "CARD" if method in {"SPEEDGATE_CARD", "RECEPTION_CARD"} else "QR"
            if credential.type != expected: reason = f"{expected} credential required"
            elif credential.status != "ACTIVE": reason = f"Credential is {credential.status.lower()}"
    if member and not reason:
        member = get_member(db, member.id)
        ms = current_membership(member)
        status = effective_status(ms)
        if status != "ACTIVE":
            reason = f"Membership is {status.lower()}"
        elif not (ms.start_date <= today() <= ms.end_date):
            reason = "Membership is outside its valid dates"
        else:
            decision, reason = ("MANUAL_OVERRIDE" if method == "MANUAL_RECEPTION" else "ALLOWED"), "Membership valid"
    event = AccessEvent(id=str(uuid.uuid4()), member_id=member.id if member else None,
                        member_name=member.full_name if member else "Unknown",
                        branch_id=branch_id, method=method, decision=decision, reason=reason,
                        occurred_at=now(), offline=False, sync_status="SYNCED")
    db.add(event)
    audit(db, "ACCESS_" + decision, f"{event.member_name}: {reason} at {branch.name}")
    db.commit()
    return {"ok": True, "message": "Access allowed" if decision != "DENIED" else "Access denied", "event": event_json(event)}


def reminders(db: Session, body: dict):
    member_id = body.get("member_id")
    if member_id is None:
        aline = db.scalar(select(Member).where(Member.email == "aline@waka.demo"))
        require(aline, 404, "Default reminder member is unavailable")
        member_id = aline.id
    member = db.get(Member, member_id); require(member, 404, "Member not found")
    fail = bool(body.get("all_fail", False))
    final = "STAFF FOLLOW-UP REQUIRED" if fail else "CONTACTED"
    sequence = [("WHATSAPP", "FAILED"), ("WHATSAPP", "FAILED"),
                ("SMS", "FAILED" if fail else "DELIVERED")]
    if fail: sequence.append(("EMAIL", "FAILED"))
    base = now()
    for index, (channel, status) in enumerate(sequence, 1):
        db.add(NotificationEvent(member_id=member.id, channel=channel, status=status,
                                 attempt=index, final_status=final,
                                 created_at=base + timedelta(seconds=index)))
    audit(db, "REMINDER_COMPLETE", f"{member.full_name}: {final}")
    db.commit()
    return {"ok": True, "message": final}


def sync_offline(db: Session, body: dict):
    generation = db.get(Config, "demo_generation")
    require(generation and body.get("generation") == generation.value, 409, "Stale demo generation; discard the browser simulator queue")
    events = body.get("events")
    require(isinstance(events, list), 400, "events array is required")
    require(len(events) <= 200, 400, "Offline sync is limited to 200 events")
    synced = 0
    for raw in events:
        require(isinstance(raw, dict), 400, "Each offline event must be an object")
        try: event_id = str(uuid.UUID(str(raw.get("id"))))
        except (ValueError, TypeError, AttributeError): raise HTTPException(400, detail="Offline event id must be a UUID")
        require(raw.get("branch_id") == 1 and raw.get("method") == "SPEEDGATE_CARD", 400,
                "Offline events must use Branch 1 SPEEDGATE_CARD")
        require(raw.get("decision") in {"ALLOWED", "DENIED"}, 400, "Invalid offline decision")
        try:
            occurred = datetime.fromisoformat(str(raw.get("occurred_at")).replace("Z", "+00:00"))
            require(occurred.tzinfo is not None, 400, "occurred_at must include a timezone")
            occurred = occurred.astimezone(timezone.utc)
        except (ValueError, TypeError):
            raise HTTPException(400, detail="Invalid occurred_at")
        require(occurred <= now() + timedelta(minutes=2), 400, "Offline event cannot occur in the future")
        require(occurred >= now() - timedelta(days=30), 400, "Offline event is too old")
        try: member_id = int(raw.get("member_id"))
        except (TypeError, ValueError): raise HTTPException(400, detail="Offline member_id is required")
        member = db.get(Member, member_id); require(member, 400, "Unknown offline member")
        # Historical queued events intentionally do not re-check current membership/card state:
        # the trusted browser simulator represents the frozen controller cache at occurrence time.
        reason = required_string(raw.get("reason"), "Offline decision reason", 500)
        existing = db.get(AccessEvent, event_id)
        if existing:
            require(existing.offline and existing.member_id == member_id and
                    existing.branch_id == 1 and existing.method == "SPEEDGATE_CARD" and
                    existing.decision == raw["decision"] and existing.occurred_at == occurred,
                    409, "Offline event UUID conflicts with a different event")
            continue
        db.add(AccessEvent(id=event_id, member_id=member.id, member_name=member.full_name,
                           branch_id=1, method="SPEEDGATE_CARD", decision=raw["decision"],
                           reason=reason, occurred_at=occurred, offline=True, sync_status="SYNCED"))
        synced += 1
    audit(db, "OFFLINE_SYNC", f"Synced {synced} browser-simulated cached events; decisions reflect frozen cache")
    branch = db.get(Branch, 1); branch.last_sync = now()
    db.commit()
    return {"ok": True, "message": "Offline events synchronized", "synced": synced}


def import_migration(db: Session, rows):
    require(isinstance(rows, list), 400, "rows array is required")
    require(len(rows) <= 500, 400, "Import is limited to 500 rows")
    # Convert edited UI rows back through the exact CSV parser so every value is revalidated.
    output = io.StringIO()
    fields = ["source_record_id", "full_name", "email", "phone", "plan", "start_date", "end_date", "branch_id"]
    writer = csv.DictWriter(output, fieldnames=fields); writer.writeheader()
    for row in rows:
        require(isinstance(row, dict), 400, "Each migration row must be an object")
        writer.writerow({k: row.get(k, "") for k in fields})
    checked = parse_migration(db, output.getvalue())
    imported = skipped = 0
    plans = {p.name.lower(): p for p in db.scalars(select(Plan)).all()}
    for raw, valid in zip(rows, checked):
        sid = valid["source_record_id"]
        replay = db.scalar(select(MigrationRecord).where(
            (MigrationRecord.source_record_id == sid) |
            (func.lower(MigrationRecord.source_email) == valid["email"].lower())))
        if replay:
            skipped += 1
            continue
        if raw.get("skip"):
            db.add(MigrationRecord(source_record_id=sid, source_email=valid["email"],
                                   waka_member_id=None, status="SKIPPED", imported_at=now(),
                                   details=("; ".join(valid["issues"]) or "Skipped by administrator")))
            skipped += 1
            continue
        require(not valid["issues"], 400, f"Row {sid or '(missing ID)'}: " + "; ".join(valid["issues"]))
        plan = plans[valid["plan"].lower()]
        member = Member(full_name=valid["full_name"], email=valid["email"], phone=valid["phone"],
                        branch_id=valid["branch_id"], gender=None, date_of_birth=None,
                        emergency_contact=None, notes="Imported from FitBase CSV", created_at=now())
        db.add(member); db.flush()
        db.add(Membership(member_id=member.id, plan_id=plan.id,
                          start_date=parse_date(valid["start_date"], "start_date"),
                          end_date=parse_date(valid["end_date"], "end_date"),
                          status="ACTIVE", created_at=now()))
        db.add(MigrationRecord(source_record_id=sid, source_email=valid["email"],
                               waka_member_id=member.id, status="IMPORTED", imported_at=now(),
                               details="Imported without payment"))
        imported += 1
    audit(db, "MIGRATION_IMPORTED", f"Imported {imported}; skipped {skipped}")
    db.commit()
    return {"ok": True, "message": "Migration import completed", "imported": imported, "skipped": skipped}