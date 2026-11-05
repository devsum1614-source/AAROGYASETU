"""
Environment-driven configuration for AAROGYASETU (आरोग्यसेतु) — Milestone 1.
All secrets and paths can be overridden via environment variables or a .env file.
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent


def _load_dotenv_if_present() -> None:
    for env_path in (PROJECT_ROOT / ".env", BASE_DIR / ".env"):
        if env_path.exists():
            for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv_if_present()

SECRET_KEY: str = os.environ.get(
    "AAROGYASETU_SECRET_KEY",
    "aarogyasetu-karavali-hackathon-dev-secret-2026",
)
TOKEN_EXPIRY_SECONDS: int = int(os.environ.get("AAROGYASETU_TOKEN_TTL_SECONDS", str(60 * 60 * 24)))

_db_env = os.environ.get("AAROGYASETU_DB_PATH", "")
if _db_env:
    DB_PATH: Path = Path(_db_env) if Path(_db_env).is_absolute() else (PROJECT_ROOT / _db_env)
else:
    DB_PATH = BASE_DIR / "aarogyasetu_m1.db"

_storage_env = os.environ.get("AAROGYASETU_PRIVATE_STORAGE_DIR", "")
if _storage_env:
    PRIVATE_REPORTS_DIR: Path = (
        Path(_storage_env) if Path(_storage_env).is_absolute() else (PROJECT_ROOT / _storage_env)
    )
else:
    PRIVATE_REPORTS_DIR = BASE_DIR / "private_reports"

MAX_UPLOAD_MB: int = int(os.environ.get("AAROGYASETU_MAX_UPLOAD_MB", "5"))
MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024

# Allowed email domains configuration (Comma-separated, e.g. "kit.edu.in,karavali.edu.in" or "*" to allow any valid email domain)
# If empty or "*", all domains (including gmail.com) are accepted upon valid registration.
ALLOWED_EMAIL_DOMAINS: list[str] = [
    d.strip().lower()
    for d in os.environ.get("AAROGYASETU_ALLOWED_EMAIL_DOMAINS", "*").split(",")
    if d.strip()
]

# Configurable local emergency phone number (Default: "108" for India's rural medical ambulance)
EMERGENCY_PHONE_NUMBER: str = os.environ.get("AAROGYASETU_EMERGENCY_PHONE", "108").strip()

# Optional SMS Provider Credentials (Twilio). If not provided, Demo SMS Outbox is used.
TWILIO_ACCOUNT_SID: str = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN: str = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM_PHONE: str = os.environ.get("TWILIO_FROM_PHONE", "").strip()

# Optional AI Provider Key (OpenAI / Gemini). If not provided, curated rural health guide is used.
AI_API_KEY: str = os.environ.get("AAROGYASETU_AI_API_KEY", "").strip()
AI_PROVIDER: str = os.environ.get("AAROGYASETU_AI_PROVIDER", "curated").strip().lower()

# Failed login attempts rate limiting / temporary lockout parameters
# Max 5 failed attempts per identifier within a 5-minute rolling window before a 10-minute lockout
LOGIN_MAX_FAILED_ATTEMPTS: int = int(os.environ.get("AAROGYASETU_MAX_FAILED_LOGINS", "5"))
LOGIN_LOCKOUT_SECONDS: int = int(os.environ.get("AAROGYASETU_LOGIN_LOCKOUT_SECONDS", str(10 * 60)))

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.environ.get(
        "AAROGYASETU_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if origin.strip()
]

# Ensure private report storage directory exists (never mounted as public static files)
PRIVATE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
