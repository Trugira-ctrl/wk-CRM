"""Demo-only historical event ingestion; not a trusted physical-controller API."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError

from .common import now
from .models import AccessEvent, Branch, Config, Member, SystemEvent
from .requests import validated


class OfflineEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str
    member_id: int | None = Field(default=None, gt=0)
    member_name: str = Field(default="Unknown", max_length=160)
    branch_id: Literal[1]
    method: Literal["SPEEDGATE_CARD"]
    decision: Literal["ALLOWED", "DENIED"]
    reason: str = Field(min_length=1, max_length=500)
    occurred_at: str
    offline: bool = True
    sync_status: str = "PENDING"


def store_event(db, raw):
    event = validated(OfflineEvent, raw)
    try:
        event_id = str(uuid.UUID(event.id))
        occurred = datetime.fromisoformat(event.occurred_at.replace("Z", "+00:00"))
        if occurred.tzinfo is None:
            raise ValueError()
        occurred = occurred.astimezone(timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(400, detail="Event needs a UUID and timezone-aware timestamp")
    if not now() - timedelta(days=30) <= occurred <= now() + timedelta(minutes=2):
        raise HTTPException(400, detail="Event timestamp is outside the accepted 30-day window")
    member = db.get(Member, event.member_id) if event.member_id is not None else None
    if event.member_id is not None and not member:
        raise HTTPException(400, detail="Unknown offline member")
    if member is None and event.decision != "DENIED":
        raise HTTPException(400, detail="Unknown credentials must be denied")
    existing = db.get(AccessEvent, event_id)
    if existing:
        at = existing.occurred_at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if not (existing.offline and existing.member_id == event.member_id and
                existing.branch_id == 1 and existing.method == event.method and
                existing.decision == event.decision and existing.reason == event.reason and at == occurred):
            raise HTTPException(409, detail="Event UUID conflicts with a different event")
        return "DUPLICATE"
    db.add(AccessEvent(id=event_id, member_id=event.member_id,
        member_name=member.full_name if member else "Unknown credential", branch_id=1,
        method=event.method, decision=event.decision, reason=event.reason,
        occurred_at=occurred, offline=True, sync_status="SYNCED"))
    db.flush()
    return "SYNCED"


def sync(db, body):
    generation = db.get(Config, "demo_generation")
    if not generation or body.get("generation") != generation.value:
        raise HTTPException(409, detail="Stale demo generation; queued events retained for review")
    events = body.get("events")
    if not isinstance(events, list) or len(events) > 200:
        raise HTTPException(400, detail="events must be an array of at most 200 records")
    results = []
    for raw in events:
        event_id = raw.get("id") if isinstance(raw, dict) and isinstance(raw.get("id"), str) else None
        try:
            # A malformed item rolls back only its savepoint, not valid neighbors.
            with db.begin_nested():
                status = store_event(db, raw)
            results.append({"id": event_id, "status": status})
        except HTTPException as exc:
            results.append({"id": event_id, "status": "REJECTED", "detail": exc.detail})
        except IntegrityError:
            # Concurrent insert won the UUID. Verify exact equality, never assume
            # a conflict is a valid duplicate. Rejected items remain retryable.
            try:
                with db.begin_nested():
                    status = store_event(db, raw)
                results.append({"id": event_id, "status": status})
            except (HTTPException, IntegrityError):
                results.append({"id": event_id, "status": "REJECTED", "detail": "Event conflict; review before retrying"})
    synced = sum(r["status"] == "SYNCED" for r in results)
    rejected = sum(r["status"] == "REJECTED" for r in results)
    branch = db.get(Branch, 1)
    if branch:
        branch.last_sync = now()
    db.add(SystemEvent(type="OFFLINE_SYNC", message=f"Browser simulation: synced={synced}, rejected={rejected}", created_at=now()))
    db.commit()
    return {"ok": rejected == 0, "message": "Some events need review" if rejected else "Offline events synchronized",
            "synced": synced, "results": results}
