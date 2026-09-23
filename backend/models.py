from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
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
    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("waka_members.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Numeric(12, 0))
    currency: Mapped[str] = mapped_column(String(3), default="RWF")
    provider: Mapped[str] = mapped_column(String(40), default="SIMULATED")
    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    member: Mapped[Member] = relationship()


class AccessEvent(Base):
    __tablename__ = "waka_access_events"
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