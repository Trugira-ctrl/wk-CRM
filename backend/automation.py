"""Limited n8n integration: read summaries and store internal reports only."""
import hmac
import json
from datetime import date, timedelta
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .common import now, today
from .config import AUTOMATION_TOKEN, DEMO_MODE, ENVIRONMENT
from .models import Config, Member, Membership, Payment, WalletOperation
from .requests import validated
from .serializers import branch_checkins_today, day_start


def service_auth(authorization):
    if len(AUTOMATION_TOKEN) < 32:
        raise HTTPException(503, detail="Automation service connection is not configured")
    supplied = authorization or ""
    expected = "Bearer " + AUTOMATION_TOKEN
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(403, detail="Automation authentication required")


def snapshot(db):
    day = today()
    ranked = select(Membership.member_id, Membership.start_date, Membership.end_date,
        Membership.status, func.row_number().over(partition_by=Membership.member_id,
        order_by=(Membership.end_date.desc(), Membership.id.desc())).label("position")).subquery()
    current = select(ranked).where(ranked.c.position == 1).subquery()
    active = (current.c.status == "ACTIVE", current.c.start_date <= day, current.c.end_date >= day)
    expiring = select(Member.id, Member.full_name, Member.branch_id, current.c.end_date).join(
        current, current.c.member_id == Member.id).where(*active, current.c.end_date <= day + timedelta(days=7))
    expiring_count = db.scalar(select(func.count()).select_from(expiring.subquery()))
    # Bound the internal report size even when names contain multi-byte text.
    rows = db.execute(expiring.order_by(current.c.end_date, Member.id).limit(50)).all()
    start = day_start(day)
    demo = DEMO_MODE and ENVIRONMENT != "production"
    sales = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "SUCCESS",
        Payment.currency == "RWF", Payment.created_at >= start,
        Payment.created_at < start + timedelta(days=1),
        Payment.provider.in_(("SIMULATED", "SIMULATED_WALLET")) if demo else False)
    return {"day": day.isoformat(), "generated_at": now().isoformat(), "demo_mode": demo,
        "metrics": {
            "members_total": db.scalar(select(func.count()).select_from(Member)),
            "active_members": db.scalar(select(func.count()).select_from(current).where(*active)),
            "expired_members": db.scalar(select(func.count()).select_from(current).where(
                current.c.status == "ACTIVE", current.c.end_date < day)),
            "checkins_today": sum(branch_checkins_today(db).values()),
            "simulated_payments_today_rwf": int(db.scalar(sales)),
            "wallet_refunds_pending": db.scalar(select(func.count()).select_from(WalletOperation).where(
                WalletOperation.kind == "REFUND", WalletOperation.status.in_(("REQUESTED", "APPROVED")))),
            "expiring_members": expiring_count,
        },
        "expiring_members": [{"id": row.id, "name": row.full_name, "branch_id": row.branch_id,
            "end_date": row.end_date.isoformat(), "days_remaining": (row.end_date - day).days} for row in rows],
        "expiring_list_truncated": expiring_count > len(rows)}


class AutomationReport(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    workflow: Literal["health-check", "membership-expiry", "daily-summary"]
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: Literal["HEALTHY", "UNHEALTHY", "DRAFT", "READY"]
    summary: str = Field(min_length=1, max_length=1000)
    payload: dict


def record_report(db, body):
    report = validated(AutomationReport, body)
    try:
        report_day = date.fromisoformat(report.day)
    except ValueError:
        raise HTTPException(400, detail="Invalid report date")
    if report_day != today():
        raise HTTPException(409, detail="Report date must match the current Kigali date")
    statuses = {"health-check": {"HEALTHY", "UNHEALTHY"}, "membership-expiry": {"DRAFT"}, "daily-summary": {"READY"}}
    if report.status not in statuses[report.workflow]:
        raise HTTPException(400, detail="Invalid status for this workflow")
    value = {**report.model_dump(), "recorded_at": now().isoformat(), "external_messages_sent": False}
    encoded = json.dumps(value, sort_keys=True)
    if len(encoded.encode()) > 65536:
        raise HTTPException(400, detail="Automation report is too large")
    key = f"automation:{report.day}:{report.workflow}"
    # A scheduled retry replaces the same daily report rather than duplicating it.
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    db.execute(insert(Config).values(key=key, value=encoded).on_conflict_do_update(
        index_elements=[Config.key], set_={"value": encoded}))
    cutoff = f"automation:{(today() - timedelta(days=30)).isoformat()}:"
    db.execute(delete(Config).where(Config.key.like("automation:%"), Config.key < cutoff))
    db.commit()
    return {"ok": True, "message": "Internal automation report recorded", "report_key": key}


def reports(db, user):
    if user.role not in {"ADMIN", "MANAGEMENT", "RECEPTION"}:
        raise HTTPException(403, detail="Staff role required")
    entries = db.scalars(select(Config).where(Config.key.like("automation:%"))
                         .order_by(Config.key.desc()).limit(100)).all()
    items = [json.loads(item.value) for item in entries]
    items.sort(key=lambda item: item["recorded_at"], reverse=True)
    return {"reports": items, "timezone": "Africa/Kigali", "external_messages_enabled": False}
