"""Strict input contracts for entitlement-changing requests."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from fastapi import HTTPException


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    full_name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=8, max_length=256)
    branch_id: int = Field(gt=0)
    plan_id: int = Field(gt=0)
    gender: str | None = None
    date_of_birth: str | None = None
    emergency_contact: str | None = None
    notes: str | None = None
    # Legacy client field never determines payment status.
    record_payment: bool = True


class RenewalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["renew_membership"]
    member_id: int = Field(gt=0)
    plan_id: int = Field(gt=0)
    idempotency_key: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    simulate_failure: bool = False


def validated(model, body):
    try:
        return model.model_validate(body)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise HTTPException(400, detail=f"{'.'.join(map(str, first['loc']))}: {first['msg']}")
