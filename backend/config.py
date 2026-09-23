import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DEMO_MODE = os.environ.get("DEMO_MODE", "true").lower() in {"1", "true", "yes", "on"}
ENVIRONMENT = os.environ.get("ENVIRONMENT", os.environ.get("APP_ENV", "development")).lower()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true" if ENVIRONMENT == "production" else "false").lower() in {"1", "true", "yes", "on"}
SESSION_COOKIE = "waka_session"
SESSION_DAYS = 7

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]