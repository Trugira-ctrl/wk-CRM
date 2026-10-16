"""Demo-only prepaid gym credit. No MTN calls or real-money confirmations."""
import calendar
import json
import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError
from sqlalchemy import select

from .common import iso, now, today
from .models import (Member, Payment, Plan, SystemEvent, WalletAccount, WalletEntry,
                     WalletOperation, WalletRefundAllocation)


class WalletRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    member_id: int = Field(gt=0)


class NewOperation(WalletRequest):
    idempotency_key: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")


class Topup(NewOperation):
    action: Literal["wallet_topup"]
    amount: int = Field(gt=0, le=10_000_000)


class ConfirmTopup(WalletRequest):
    action: Literal["wallet_confirm_topup"]
    operation_id: str = Field(min_length=36, max_length=36)
    outcome: Literal["SUCCESSFUL", "FAILED"]


class Purchase(NewOperation):
    action: Literal["wallet_purchase"]
    plan_id: int = Field(gt=0)


class RequestRefund(NewOperation):
    action: Literal["wallet_request_refund"]
    amount: int = Field(gt=0, le=10_000_000)
    reason: str = Field(min_length=3, max_length=500)


class ReviewRefund(WalletRequest):
    action: Literal["wallet_review_refund"]
    operation_id: str = Field(min_length=36, max_length=36)
    decision: Literal["APPROVE", "REJECT"]
    category: Literal["VOLUNTARY", "PAYMENT_ERROR"]


class ConfirmRefund(WalletRequest):
    action: Literal["wallet_confirm_refund"]
    operation_id: str = Field(min_length=36, max_length=36)
    outcome: Literal["SUCCESSFUL", "FAILED"]


contract = TypeAdapter(Annotated[Topup | ConfirmTopup | Purchase | RequestRefund | ReviewRefund | ConfirmRefund,
                                  Field(discriminator="action")])


def two_months_after(day: date):
    month = day.month + 2
    year = day.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def authorize(user, member_id):
    if user.role not in {"ADMIN", "MANAGEMENT", "RECEPTION", "MEMBER"}:
        raise HTTPException(403, detail="Not permitted")
    if user.role == "MEMBER" and user.member_id != member_id:
        raise HTTPException(403, detail="Members may only access their own gym credit")


def operation_json(op):
    return {"id": op.id, "kind": op.kind, "status": op.status, "amount": op.amount,
            "remaining": op.remaining, "created_at": iso(op.created_at),
            "details": json.loads(op.details)}


def wallet_view(db, user, member_id):
    authorize(user, member_id)
    if not db.get(Member, member_id):
        raise HTTPException(404, detail="Member not found")
    account = db.get(WalletAccount, member_id)
    balance, reserved = (account.balance, account.reserved) if account else (0, 0)
    blocked = account.topup_blocked_until if account else None
    operations = db.scalars(select(WalletOperation).where(WalletOperation.member_id == member_id)
        .order_by(WalletOperation.created_at.desc(), WalletOperation.id.desc()).limit(100)).all()
    entries = db.scalars(select(WalletEntry).where(WalletEntry.member_id == member_id)
        .order_by(WalletEntry.id.desc()).limit(100)).all()
    return {"member_id": member_id, "currency": "RWF", "simulated": True,
            "balance": balance, "reserved": reserved, "available": balance - reserved,
            "topup_blocked_until": iso(blocked), "can_topup": blocked is None or today() >= blocked,
            "cooldown_months": 2, "direct_purchase_allowed": True,
            "operations": [operation_json(op) for op in operations],
            "entries": [{"id": e.id, "operation_id": e.operation_id, "kind": e.kind,
                         "balance_delta": e.balance_delta, "reserved_delta": e.reserved_delta,
                         "balance_after": e.balance_after, "reserved_after": e.reserved_after,
                         "created_at": iso(e.created_at)} for e in entries]}


def entry(db, account, op, actor, kind, balance_delta=0, reserved_delta=0):
    account.balance += balance_delta
    account.reserved += reserved_delta
    db.add(WalletEntry(member_id=account.member_id, operation_id=op.id, actor_id=actor.id,
        kind=kind, balance_delta=balance_delta, reserved_delta=reserved_delta,
        balance_after=account.balance, reserved_after=account.reserved, created_at=now()))
    db.add(SystemEvent(type="WALLET_" + kind,
        message=json.dumps({"member_id": account.member_id, "operation_id": op.id,
                            "actor_id": actor.id, "amount": op.amount, "simulated": True}), created_at=now()))


def allocate(db, member_id, amount, refund=None):
    """FIFO unused deposits; reserved funds have already left remaining."""
    deposits = db.scalars(select(WalletOperation).where(WalletOperation.member_id == member_id,
        WalletOperation.kind == "TOPUP", WalletOperation.status == "SUCCESSFUL",
        WalletOperation.remaining > 0).order_by(WalletOperation.created_at, WalletOperation.id)).all()
    left = amount
    for deposit in deposits:
        used = min(left, deposit.remaining)
        deposit.remaining -= used
        if refund:
            db.add(WalletRefundAllocation(refund_id=refund.id, deposit_id=deposit.id, amount=used))
        left -= used
        if not left:
            break
    if left:
        raise HTTPException(409, detail="Credit reconciliation required before proceeding")


def release_refund(db, account, op, actor):
    for allocation in db.scalars(select(WalletRefundAllocation).where(WalletRefundAllocation.refund_id == op.id)):
        db.get(WalletOperation, allocation.deposit_id).remaining += allocation.amount
    entry(db, account, op, actor, "REFUND_RELEASED", reserved_delta=-op.amount)


def run_wallet_action(db, user, body):
    from .services import require_simulation
    from .renewals import extend_membership
    require_simulation()
    try:
        data = contract.validate_python(body)
    except ValidationError:
        raise HTTPException(400, detail="Invalid gym credit request")
    authorize(user, data.member_id)
    if isinstance(data, (ReviewRefund, ConfirmRefund)) and user.role != "ADMIN":
        raise HTTPException(403, detail="Administrator review required for refunds")
    # Every wallet writer locks the same parent, including the first deposit.
    member = db.scalar(select(Member).where(Member.id == data.member_id).with_for_update()
                       .execution_options(populate_existing=True))
    if not member:
        raise HTTPException(404, detail="Member not found")
    account = db.get(WalletAccount, member.id, populate_existing=True)
    if not account:
        account = WalletAccount(member_id=member.id, balance=0, reserved=0)
        db.add(account)
        db.flush()

    if isinstance(data, NewOperation):
        fingerprint = json.dumps(data.model_dump(exclude={"idempotency_key"}), sort_keys=True)
        op = db.scalar(select(WalletOperation).where(WalletOperation.member_id == member.id,
                       WalletOperation.idempotency_key == data.idempotency_key))
        if op:
            if op.fingerprint != fingerprint:
                raise HTTPException(409, detail="This request reference was already used for a different operation")
            db.commit()
            return {"ok": True, "message": "Existing operation returned; no duplicate charge", "operation": operation_json(op)}
        kind = "TOPUP" if isinstance(data, Topup) else "PURCHASE" if isinstance(data, Purchase) else "REFUND"
        amount = getattr(data, "amount", 0)
        if isinstance(data, Topup) and account.topup_blocked_until and today() < account.topup_blocked_until:
            raise HTTPException(409, detail=f"Wallet top-ups resume on {account.topup_blocked_until}. Direct membership purchases remain available.")
        if isinstance(data, Purchase):
            plan = db.get(Plan, data.plan_id)
            if not plan or plan.price <= 0 or plan.duration_days <= 0:
                raise HTTPException(400, detail="Invalid membership plan")
            amount = plan.price
        if not isinstance(data, Topup) and amount > account.balance - account.reserved:
            raise HTTPException(409, detail="Not enough available gym credit")
        op = WalletOperation(id=str(uuid.uuid4()), member_id=member.id, actor_id=user.id,
            kind=kind, status="PENDING", amount=amount, remaining=0,
            idempotency_key=data.idempotency_key, fingerprint=fingerprint,
            source_phone=member.phone if isinstance(data, Topup) else None,
            details=json.dumps({"reason": data.reason} if isinstance(data, RequestRefund) else {}),
            created_at=now(), updated_at=now())
        db.add(op)
        db.flush()
        if isinstance(data, Purchase):
            extend_membership(db, member, plan)
            allocate(db, member.id, amount)
            payment = Payment(member_id=member.id, amount=amount, currency="RWF",
                              provider="SIMULATED_WALLET", status="SUCCESS", created_at=now())
            db.add(payment)
            db.flush()
            db.expire(member, ["memberships"])
            op.status = "SUCCESSFUL"
            op.details = json.dumps({"plan_id": plan.id, "payment_id": payment.id})
            entry(db, account, op, user, "PURCHASE", balance_delta=-amount)
        elif isinstance(data, RequestRefund):
            op.status = "REQUESTED"
            allocate(db, member.id, amount, refund=op)
            entry(db, account, op, user, "REFUND_RESERVED", reserved_delta=amount)
        else:
            db.add(SystemEvent(type="WALLET_TOPUP_REQUESTED", message=json.dumps({
                "member_id": member.id, "operation_id": op.id, "actor_id": user.id,
                "amount": amount, "simulated": True}), created_at=now()))
    else:
        op = db.get(WalletOperation, data.operation_id, populate_existing=True)
        if not op or op.member_id != member.id:
            raise HTTPException(404, detail="Operation not found")
        if isinstance(data, ConfirmTopup):
            if op.kind != "TOPUP":
                raise HTTPException(400, detail="Not a deposit")
            if op.status == data.outcome:
                db.commit()
                return {"ok": True, "message": "Confirmation already recorded", "operation": operation_json(op)}
            if op.status != "PENDING":
                raise HTTPException(409, detail="This deposit has already reached a final state")
            op.status = data.outcome
            if op.status == "SUCCESSFUL":
                # A previously requested deposit may settle during a later cooldown.
                op.remaining = op.amount
                entry(db, account, op, user, "TOPUP", balance_delta=op.amount)
            else:
                entry(db, account, op, user, "TOPUP_FAILED")
        elif isinstance(data, ReviewRefund):
            if op.kind != "REFUND":
                raise HTTPException(400, detail="Not a refund")
            target = "APPROVED" if data.decision == "APPROVE" else "REJECTED"
            details = json.loads(op.details)
            if op.status == target and details.get("category") == data.category:
                db.commit()
                return {"ok": True, "message": "Review already recorded", "operation": operation_json(op)}
            if op.status != "REQUESTED":
                raise HTTPException(409, detail="This refund has already been reviewed")
            op.status = target
            op.details = json.dumps({**details, "category": data.category, "reviewer_id": user.id})
            if data.decision == "REJECT":
                release_refund(db, account, op, user)
            else:
                entry(db, account, op, user, "REFUND_APPROVED")
        elif isinstance(data, ConfirmRefund):
            if op.kind != "REFUND":
                raise HTTPException(400, detail="Not a refund")
            if op.status == data.outcome:
                db.commit()
                return {"ok": True, "message": "Refund result already recorded", "operation": operation_json(op)}
            if op.status != "APPROVED":
                raise HTTPException(409, detail="Only approved refunds can be confirmed")
            op.status = data.outcome
            if op.status == "SUCCESSFUL":
                entry(db, account, op, user, "REFUND_PAID", balance_delta=-op.amount, reserved_delta=-op.amount)
                if json.loads(op.details)["category"] == "VOLUNTARY":
                    account.topup_blocked_until = max(account.topup_blocked_until or today(), two_months_after(today()))
            else:
                release_refund(db, account, op, user)
        op.updated_at = now()
    db.commit()
    return {"ok": True, "message": "Simulated gym credit operation recorded", "operation": operation_json(op)}
