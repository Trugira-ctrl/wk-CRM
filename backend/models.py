from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "waka_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20))
    member_id: Mapped[int | None] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    is_demo_seed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (Index("uq_waka_users_email_lower", func.lower(email), unique=True),)


class Branch(Base):
    __tablename__ = "waka_branches"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    type: Mapped[str] = mapped_column(String(20))
    cloud_online: Mapped[bool] = mapped_column(Boolean, default=True)
    local_online: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Plan(Base):
    __tablename__ = "waka_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    price: Mapped[int] = mapped_column(Integer)
    duration_days: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)


class Member(Base):
    __tablename__ = "waka_members"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    full_name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("waka_branches.id"))
    gender: Mapped[str | None] = mapped_column(String(40))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    emergency_contact: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    memberships: Mapped[list["Membership"]] = relationship(back_populates="member", cascade="all, delete-orphan")
    credentials: Mapped[list["Credential"]] = relationship(back_populates="member", cascade="all, delete-orphan")
    __table_args__ = (Index("uq_waka_members_email_lower", func.lower(email), unique=True),)


class Membership(Base):
    __tablename__ = "waka_memberships"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("waka_plans.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    member: Mapped[Member] = relationship(back_populates="memberships")
    plan: Mapped[Plan] = relationship()


class Credential(Base):
    __tablename__ = "waka_credentials"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))
    identifier: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    member: Mapped[Member] = relationship(back_populates="credentials")


class Payment(Base):
    __tablename__ = "waka_payments"
    __table_args__ = (Index("ix_waka_payments_reporting", "created_at", "status", "provider"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Numeric(12, 0))
    currency: Mapped[str] = mapped_column(String(3), default="RWF")
    provider: Mapped[str] = mapped_column(String(40), default="SIMULATED")
    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    member: Mapped[Member] = relationship()


class RenewalOperation(Base):
    __tablename__ = "waka_renewal_operations"
    __table_args__ = (UniqueConstraint("member_id", "idempotency_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("waka_users.id"))
    idempotency_key: Mapped[str] = mapped_column(String(100))
    fingerprint: Mapped[str] = mapped_column(Text)
    payment_id: Mapped[int] = mapped_column(ForeignKey("waka_payments.id", ondelete="CASCADE"), unique=True)
    membership_id: Mapped[int | None] = mapped_column(ForeignKey("waka_memberships.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(20))
    result: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WalletAccount(Base):
    __tablename__ = "waka_wallet_accounts"
    __table_args__ = (CheckConstraint("balance >= 0 AND reserved >= 0 AND reserved <= balance", name="ck_wallet_funds"),)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id"), primary_key=True)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    topup_blocked_until: Mapped[date | None] = mapped_column(Date)


class WalletOperation(Base):
    __tablename__ = "waka_wallet_operations"
    __table_args__ = (
        UniqueConstraint("member_id", "idempotency_key", name="uq_wallet_member_key"),
        CheckConstraint("amount > 0 AND remaining >= 0 AND remaining <= amount", name="ck_wallet_operation_amount"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("waka_users.id"))
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer)
    remaining: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(100))
    fingerprint: Mapped[str] = mapped_column(Text)
    source_phone: Mapped[str | None] = mapped_column(String(40))
    details: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WalletRefundAllocation(Base):
    __tablename__ = "waka_wallet_refund_allocations"
    refund_id: Mapped[str] = mapped_column(ForeignKey("waka_wallet_operations.id"), primary_key=True)
    deposit_id: Mapped[str] = mapped_column(ForeignKey("waka_wallet_operations.id"), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer, CheckConstraint("amount > 0"))


class WalletEntry(Base):
    __tablename__ = "waka_wallet_entries"
    __table_args__ = (UniqueConstraint("operation_id", "kind", name="uq_wallet_entry_phase"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id"), index=True)
    operation_id: Mapped[str] = mapped_column(ForeignKey("waka_wallet_operations.id"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("waka_users.id"))
    kind: Mapped[str] = mapped_column(String(30))
    balance_delta: Mapped[int] = mapped_column(Integer)
    reserved_delta: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    reserved_after: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MomoSandboxPayment(Base):
    __tablename__ = "waka_momo_sandbox_payments"
    __table_args__ = (CheckConstraint("amount_minor >= 100 AND amount_minor <= 100000 AND credited_minor IN (0, amount_minor)", name="ck_momo_sandbox_amount"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("waka_users.id"))
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)
    scenario: Mapped[str] = mapped_column(String(20))
    amount_minor: Mapped[int] = mapped_column(Integer)
    credited_minor: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30))
    provider_transaction_id: Mapped[str | None] = mapped_column(String(160), unique=True)
    provider_response: Mapped[str] = mapped_column(Text, default="{}")
    note: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AccessEvent(Base):
    __tablename__ = "waka_access_events"
    __table_args__ = (Index("ix_waka_access_branch_time", "branch_id", "occurred_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("waka_members.id", ondelete="SET NULL"), index=True)
    member_name: Mapped[str] = mapped_column(String(160), default="Unknown")
    branch_id: Mapped[int] = mapped_column(ForeignKey("waka_branches.id"))
    method: Mapped[str] = mapped_column(String(40))
    decision: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    offline: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_status: Mapped[str] = mapped_column(String(20), default="SYNCED")


class NotificationEvent(Base):
    __tablename__ = "waka_notification_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30))
    attempt: Mapped[int] = mapped_column(Integer)
    final_status: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    member: Mapped[Member] = relationship()


class MigrationRecord(Base):
    __tablename__ = "waka_migration_records"
    __table_args__ = (UniqueConstraint("source_record_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    source_record_id: Mapped[str] = mapped_column(String(160))
    source_email: Mapped[str] = mapped_column(String(320))
    waka_member_id: Mapped[int | None] = mapped_column(ForeignKey("waka_members.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(30))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    details: Mapped[str | None] = mapped_column(Text)


class SystemEvent(Base):
    __tablename__ = "waka_system_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(60))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Session(Base):
    __tablename__ = "waka_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("waka_users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    user: Mapped[User] = relationship()


class Config(Base):
    __tablename__ = "waka_config"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
