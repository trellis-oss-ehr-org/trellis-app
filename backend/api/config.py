"""Environment-based configuration for the API service."""
import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project")
REGION = os.getenv("GCP_REGION", "us-central1")
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()


def is_production_like_environment(
    app_env: str | None = None,
    cloud_run_service: str | None = None,
    gae_service: str | None = None,
) -> bool:
    env = (app_env if app_env is not None else APP_ENV).strip().lower()
    cloud_run = cloud_run_service if cloud_run_service is not None else os.getenv("K_SERVICE", "")
    gae = gae_service if gae_service is not None else os.getenv("GAE_SERVICE", "")
    return env in {"production", "prod", "staging"} or bool(cloud_run or gae)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_allowed_origins(
    raw_origins: str | None = None,
    *,
    app_env: str | None = None,
    cloud_run_service: str | None = None,
    gae_service: str | None = None,
) -> list[str]:
    """Parse and validate CORS origins.

    Credentialed CORS is used by the API, so production-like deployments must
    fail closed instead of accepting wildcards, localhost, or cleartext HTTP.
    """
    raw = raw_origins if raw_origins is not None else os.getenv("ALLOWED_ORIGINS", "")
    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    prod_like = is_production_like_environment(
        app_env=app_env,
        cloud_run_service=cloud_run_service,
        gae_service=gae_service,
    )

    if not origins:
        origins = ["http://localhost:5173"]

    if not prod_like:
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
    """Expose Swagger/OpenAPI only when explicitly safe to do so."""
    return _env_bool("ENABLE_API_DOCS", default=not is_production_like_environment())

# Cloud SQL
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "trellis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_CONNECTION_NAME = os.getenv("DB_CONNECTION_NAME", "")  # project:region:instance

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
)

ALLOWED_ORIGINS = parse_allowed_origins()
API_DOCS_ENABLED = api_docs_enabled()

# Hosted Trellis texting service. This central service owns BAA, Stripe, Telnyx,
# and install credentials for the text messaging add-on.
TEXTING_SERVICE_URL = (
    os.getenv("TEXTING_SERVICE_URL")
    or os.getenv("TRELLIS_SERVICES_URL", "")
).rstrip("/")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080").rstrip("/")
