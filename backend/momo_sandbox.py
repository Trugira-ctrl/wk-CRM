"""Admin-only test EUR wallet, isolated from memberships and RWF gym credit."""
import json
import os
import uuid
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .common import iso, now
from .config import DEMO_MODE, ENVIRONMENT
from .models import MomoSandboxPayment
from .momo_client import MomoSandboxClient, ProviderError, TEST_PAYERS
from .requests import validated


class SandboxRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    idempotency_key: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    amount_minor: int = Field(ge=100, le=100000)
    scenario: Literal["SUCCESSFUL", "FAILED", "PENDING"]


def authorize(user):
    if user.role != "ADMIN":
        raise HTTPException(403, detail="Administrator role required")
    if not DEMO_MODE or ENVIRONMENT == "production":
        raise HTTPException(403, detail="Sandbox testing is available only in the demo environment")


def enabled():
    return os.environ.get("MOMO_SANDBOX_ENABLED", "false").lower() == "true"


def payment_json(payment):
    return {"id": payment.id, "amount_minor": payment.amount_minor, "currency": "EUR",
            "scenario": payment.scenario, "status": payment.status, "credited_minor": payment.credited_minor,
            "provider_transaction_id": payment.provider_transaction_id, "note": payment.note,
            "created_at": iso(payment.created_at), "verified_at": iso(payment.verified_at),
            "sandbox": True, "real_money": False}


def overview(db, user):
    authorize(user)
    client = MomoSandboxClient()
    rows = db.scalars(select(MomoSandboxPayment).order_by(MomoSandboxPayment.created_at.desc()).limit(100)).all()
    return {"configured": enabled() and client.configured, "currency": "EUR", "sandbox": True,
            "balance_minor": db.scalar(select(func.coalesce(func.sum(MomoSandboxPayment.credited_minor), 0))),
            "payments": [payment_json(p) for p in rows]}


def start(db, user, body, client=None):
    authorize(user)
    data = validated(SandboxRequest, body)
    client = client or MomoSandboxClient()
    if not enabled() or not client.configured:
        raise HTTPException(503, detail="MTN sandbox credentials are not configured")
    previous = db.scalar(select(MomoSandboxPayment).where(MomoSandboxPayment.idempotency_key == data.idempotency_key))
    if previous:
        if (previous.amount_minor, previous.scenario) != (data.amount_minor, data.scenario):
            raise HTTPException(409, detail="This reference was already used for a different sandbox request")
        return payment_json(previous)
    payment = MomoSandboxPayment(id=str(uuid.uuid4()), actor_id=user.id, idempotency_key=data.idempotency_key,
        amount_minor=data.amount_minor, scenario=data.scenario, status="SUBMITTING", credited_minor=0,
        provider_response="{}", note="Awaiting MTN submission", created_at=now())
    db.add(payment)
    try:
        db.commit()  # Persist the reference before any request leaves WAKA.
    except IntegrityError:
        db.rollback()
        # A competing identical request owns submission; never send another POST.
        if not db.scalar(select(MomoSandboxPayment.id).where(MomoSandboxPayment.idempotency_key == data.idempotency_key)):
            raise
        return start(db, user, body, client)
    reference = payment.id
    db.rollback()  # Do not hold a read transaction across the provider call.
    try:
        client.submit(reference, data.amount_minor, data.scenario)
        status, note = "PENDING", "MTN accepted the request; payment is not yet verified"
    except ProviderError as error:
        status, note = "SUBMISSION_UNKNOWN", str(error)
    payment = db.scalar(select(MomoSandboxPayment).where(MomoSandboxPayment.id == reference).with_for_update()
                        .execution_options(populate_existing=True))
    if payment.status == "SUBMITTING":
        payment.status, payment.note = status, note
    db.commit()
    return payment_json(payment)


def check(db, user, reference, client=None):
    authorize(user)
    client = client or MomoSandboxClient()
    if not enabled() or not client.configured:
        raise HTTPException(503, detail="MTN sandbox credentials are not configured")
    payment = db.get(MomoSandboxPayment, reference)
    if not payment:
        raise HTTPException(404, detail="Sandbox payment not found")
    if payment.status in {"SUCCESSFUL", "FAILED"}:
        return payment_json(payment)
    db.rollback()
    try:
        response = client.status(reference)
    except ProviderError as error:
        # Network/404 responses are uncertainty, not evidence of payment failure.
        raise HTTPException(503, detail=str(error)) from None
    payment = db.scalar(select(MomoSandboxPayment).where(MomoSandboxPayment.id == reference).with_for_update()
                        .execution_options(populate_existing=True))
    if payment.status in {"SUCCESSFUL", "FAILED"}:
        return payment_json(payment)
    # Status comes only from our authenticated GET, never browser/callback input.
    payment.provider_response = json.dumps(response, sort_keys=True)
    payment.verified_at = now()
    state = response.get("status")
    if state not in {"PENDING", "SUCCESSFUL", "FAILED"}:
        payment.status, payment.note = "REVIEW", "MTN returned an unrecognised status"
    elif state == "PENDING":
        payment.status, payment.note = "PENDING", "Payment remains pending at MTN"
    elif state == "FAILED":
        payment.status, payment.note = "FAILED", "MTN confirmed test payment failure; no credit added"
    else:
        try:
            amount = Decimal(str(response.get("amount")))
            matches = amount.is_finite() and amount * 100 == payment.amount_minor
        except (InvalidOperation, ValueError):
            matches = False
        payer = response.get("payer")
        transaction = response.get("financialTransactionId")
        matches = matches and response.get("currency") == "EUR" and response.get("externalId") == reference
        matches = matches and isinstance(payer, dict) and payer.get("partyIdType") == "MSISDN" and payer.get("partyId") == TEST_PAYERS[payment.scenario]
        matches = matches and isinstance(transaction, str) and 0 < len(transaction) <= 160
        if not matches:
            payment.status, payment.note = "REVIEW", "MTN evidence did not match the expected payment; no credit added"
        else:
            payment.provider_transaction_id = transaction
            payment.status, payment.note = "SUCCESSFUL", "MTN verified this sandbox payment; test wallet credited once"
            payment.credited_minor = payment.amount_minor
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        payment = db.scalar(select(MomoSandboxPayment).where(MomoSandboxPayment.id == reference).with_for_update())
        payment.provider_response = json.dumps(response, sort_keys=True)
        payment.verified_at, payment.status = now(), "REVIEW"
        payment.note, payment.credited_minor = "MTN transaction reference was already recorded; no credit added", 0
        db.commit()
    return payment_json(payment)


def receipt(db, user, reference):
    authorize(user)
    payment = db.get(MomoSandboxPayment, reference)
    if not payment:
        raise HTTPException(404, detail="Sandbox payment not found")
    return {"receipt_type": "MTN_SANDBOX_TEST_ONLY", "real_money": False,
            "payment": payment_json(payment), "test_payer": TEST_PAYERS[payment.scenario],
            "verification_method": "authenticated_provider_status_check" if payment.verified_at else None,
            "provider_response": json.loads(payment.provider_response),
            "notice": "Sandbox evidence only. Does not prove receipt of real money or fund a member gym wallet."}
