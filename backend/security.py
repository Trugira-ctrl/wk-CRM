import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from .config import SESSION_DAYS, DEMO_MODE, ENVIRONMENT
from .models import Session, User


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    rounds = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: DBSession, user: User) -> str:
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    db.add(Session(token_hash=token_digest(token), user_id=user.id, created_at=now,
                   expires_at=now + timedelta(days=SESSION_DAYS)))
    db.flush()
    return token


def session_user(db: DBSession, token: str | None) -> User | None:
    if not token:
        return None
    row = db.scalar(select(Session).where(Session.token_hash == token_digest(token)))
    expiry = (row.expires_at.replace(tzinfo=timezone.utc) if row and row.expires_at.tzinfo is None
              else row.expires_at if row else None)
    if not row or expiry <= datetime.now(timezone.utc):
        if row:
            db.delete(row)
        return None
    user = row.user
    if user.role not in {"ADMIN", "MANAGEMENT", "RECEPTION", "MEMBER"}:
        return None
    if user.is_demo_seed and (not DEMO_MODE or ENVIRONMENT == "production"):
        return None
    return user