"""Environment-based configuration for the API service."""
import os

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

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

# Hosted Trellis texting service. This central service owns BAA, Stripe, Telnyx,
# and install credentials for the text messaging add-on.
TEXTING_SERVICE_URL = os.getenv("TEXTING_SERVICE_URL", "").rstrip("/")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
