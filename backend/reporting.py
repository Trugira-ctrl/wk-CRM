"""Bounded display queries; financial aggregates are independent of pagination."""
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from .models import Payment
from .serializers import payment_json


def payment_page(db, user, page=1, page_size=50):
    where = Payment.member_id == user.member_id if user.role == "MEMBER" else True
    total = db.scalar(select(func.count()).select_from(Payment).where(where))
    rows = db.scalars(select(Payment).where(where).options(joinedload(Payment.member))
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [payment_json(p) for p in rows], "page": page,
            "page_size": page_size, "total": total}
