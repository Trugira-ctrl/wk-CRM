"""Atomic simulated purchases. Real provider confirmation is deliberately absent."""
import json
import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select

from .common import now, today
from .models import Member, Membership, Payment, Plan, RenewalOperation, SystemEvent
from .requests import RenewalRequest, validated
from .serializers import current_membership, member_json


def renew(db, user, body):
    data = validated(RenewalRequest, body)
    if user.role == "MEMBER" and user.member_id != data.member_id:
        raise HTTPException(403, detail="Members may only renew their own membership")
    # Lock the stable parent, not a latest-membership row that concurrent inserts
    # can bypass. All entitlement writers must take this same lock.
    member = db.scalar(select(Member).where(Member.id == data.member_id)
                       .with_for_update().execution_options(populate_existing=True))
    if not member:
        raise HTTPException(404, detail="Member not found")
    previous = db.scalar(select(RenewalOperation).where(
        RenewalOperation.member_id == member.id,
        RenewalOperation.idempotency_key == data.idempotency_key))
    fingerprint = json.dumps({"plan_id": data.plan_id, "simulate_failure": data.simulate_failure}, sort_keys=True)
    if previous:
        if previous.fingerprint != fingerprint:
            raise HTTPException(409, detail="Idempotency key was already used for a different purchase")
        result = json.loads(previous.result)
        db.commit()
        return result
    plan = db.get(Plan, data.plan_id)
    if not plan or plan.duration_days <= 0 or plan.price <= 0:
        raise HTTPException(400, detail="Invalid membership plan")
    db.expire(member, ["memberships"])
    old = current_membership(member)
    if old and old.status not in {"ACTIVE", "EXPIRED"}:
        raise HTTPException(409, detail="Membership requires an administrator review before renewal")
    payment = Payment(member_id=member.id, amount=plan.price, currency="RWF",
                      provider="SIMULATED", status="FAILED" if data.simulate_failure else "SUCCESS",
                      created_at=now())
    db.add(payment)
    membership = None
    if not data.simulate_failure:
        # Inclusive local dates: 30 days starting today ends today + 29.
        active = old and old.end_date >= today()
        start = old.start_date if active else today()
        end = (old.end_date if active else today() - timedelta(days=1)) + timedelta(days=plan.duration_days)
        membership = Membership(member_id=member.id, plan_id=plan.id, start_date=start,
                                end_date=end, status="ACTIVE", created_at=now())
        db.add(membership)
    db.flush()
    db.expire(member, ["memberships"])
    operation_id = str(uuid.uuid4())
    result = {"ok": not data.simulate_failure, "operation_id": operation_id,
              "message": "Simulated payment failed; membership unchanged" if data.simulate_failure
              else "Membership renewed with simulated payment",
              "member": member_json(member)}
    db.add(RenewalOperation(id=operation_id, member_id=member.id, actor_id=user.id,
        idempotency_key=data.idempotency_key, fingerprint=fingerprint, payment_id=payment.id,
        membership_id=membership.id if membership else None, status=payment.status,
        result=json.dumps(result), created_at=now()))
    db.add(SystemEvent(type="PAYMENT_FAILED" if data.simulate_failure else "MEMBERSHIP_RENEWED",
        message=json.dumps({"actor_id": user.id, "member_id": member.id, "payment_id": payment.id,
                            "operation_id": operation_id, "result": payment.status}),
        created_at=now()))
    db.commit()
    return result
