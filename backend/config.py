import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ENVIRONMENT = os.environ.get("ENVIRONMENT", os.environ.get("APP_ENV", "development")).lower()
DEMO_MODE = os.environ.get("DEMO_MODE", "false" if ENVIRONMENT == "production" else "true").lower() in {"1", "true", "yes", "on"}
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true" if ENVIRONMENT == "production" else "false").lower() in {"1", "true", "yes", "on"}
ALLOWED_ORIGINS = {v.strip().rstrip("/") for v in os.environ.get("ALLOWED_ORIGINS", "").split(",") if v.strip()}
SESSION_COOKIE = "waka_session"
SESSION_DAYS = 7
AUTOMATION_TOKEN = os.environ.get("AUTOMATION_TOKEN", "")

if ENVIRONMENT == "production":
    if DEMO_MODE or not COOKIE_SECURE:
        raise RuntimeError("Production requires DEMO_MODE=false and COOKIE_SECURE=true")
    if not ALLOWED_ORIGINS or any(not o.startswith("https://") for o in ALLOWED_ORIGINS):
        raise RuntimeError("Production requires explicit HTTPS ALLOWED_ORIGINS")
    if not DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("Production requires PostgreSQL DATABASE_URL")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]
