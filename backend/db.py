import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required")

pool_options = {} if DATABASE_URL.startswith("sqlite") else {
    "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
    "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "10")),
    "pool_timeout": int(os.environ.get("DB_POOL_TIMEOUT", "10")),
    "pool_recycle": 1800,
    "connect_args": {"options": "-c statement_timeout=15000 -c lock_timeout=10000"},
}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, **pool_options)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)