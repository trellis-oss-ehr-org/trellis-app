"""Configuration for the relay service."""
import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project")
REGION = os.getenv("GCP_REGION", "us-central1")
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-live-2.5-flash-native-audio")

# API service URL for relay -> API HTTP calls (scheduling, practice profile)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080")

# Firebase auth — DEV_MODE bypasses JWT verification (same as API service)
DEV_MODE = os.getenv("DEV_MODE", "").lower() in ("1", "true", "yes")


def is_production_like_environment() -> bool:
    return APP_ENV in {"production", "prod", "staging"} or bool(
        os.getenv("K_SERVICE") or os.getenv("GAE_SERVICE")
    )


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_allowed_origins(raw_origins: str | None = None) -> list[str]:
    raw = raw_origins if raw_origins is not None else os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if not origins:
        origins = ["http://localhost:5173"]

    if not is_production_like_environment():
        return origins

    if "*" in origins:
        raise RuntimeError("ALLOWED_ORIGINS cannot include '*' in production-like environments.")

    for origin in origins:
        parsed = urlparse(origin)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https":
            raise RuntimeError(
                "ALLOWED_ORIGINS must use https in production-like environments."
            )
        if host in {"localhost", "127.0.0.1", "::1"}:
            raise RuntimeError(
                "ALLOWED_ORIGINS cannot include localhost in production-like environments."
            )
    return origins


def api_docs_enabled() -> bool:
    return _env_bool("ENABLE_API_DOCS", default=not is_production_like_environment())


if DEV_MODE and is_production_like_environment():
    raise RuntimeError("DEV_MODE cannot be enabled in production-like environments.")

ALLOWED_ORIGINS = parse_allowed_origins()
API_DOCS_ENABLED = api_docs_enabled()
