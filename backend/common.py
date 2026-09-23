import re
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

KIGALI = ZoneInfo("Africa/Kigali")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def now() -> datetime:
    return datetime.now(timezone.utc)


def today() -> date:
    return datetime.now(KIGALI).date()


def normalize_email(value: str) -> str:
    value = (value or "").strip().lower()
    if len(value) > 320 or not EMAIL_RE.match(value):
        raise HTTPException(400, detail="A valid email address is required")
    return value


def required_string(value, label: str, maximum: int = 160) -> str:
    value = str(value or "").strip()
    if not value:
        raise HTTPException(400, detail=f"{label} is required")
    if len(value) > maximum:
        raise HTTPException(400, detail=f"{label} is too long")
    return value


def parse_date(value, label: str, optional: bool = False):
    if value in (None, "") and optional:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise HTTPException(400, detail=f"{label} must be an ISO date (YYYY-MM-DD)")


def iso(value):
    return value.isoformat() if value is not None else None