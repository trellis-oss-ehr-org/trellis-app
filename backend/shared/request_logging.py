"""PHI-safe request logging middleware for FastAPI.

Logs operational metadata about every request without exposing PHI:
  - Request ID (UUID)
  - HTTP method and path
  - Response status code
  - Request duration in milliseconds
  - Client IP fingerprint (X-Forwarded-For aware; hashed outside local dev)

Does NOT log: request bodies, response bodies, query parameters that may
contain PHI, authorization header values, or any content that could
include patient information.

HIPAA Technical Safeguard: provides audit trail of all HTTP activity
without storing Protected Health Information in application logs.
"""
import logging
import os
import hmac
import hashlib
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("trellis.access")


def _production_like() -> bool:
    app_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
    return app_env in {"production", "prod", "staging"} or bool(
        os.getenv("K_SERVICE") or os.getenv("GAE_SERVICE")
    )


def _ip_logging_mode() -> str:
    configured = os.getenv("REQUEST_IP_LOGGING", "").strip().lower()
    if configured in {"plain", "hash", "redact"}:
        return configured
    return "hash" if _production_like() else "plain"


def _safe_client_ip(ip_address: str) -> str:
    mode = _ip_logging_mode()
    if mode == "plain":
        return ip_address
    if mode == "redact":
        return "[REDACTED_IP]"

    secret = (
        os.getenv("LOG_HASH_SECRET")
        or os.getenv("CRON_SECRET")
        or os.getenv("HEALTH_CHECK_SECRET")
        or "local-log-hash-secret"
    )
    digest = hmac.new(
        secret.encode("utf-8"),
        ip_address.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"ip_hash={digest}"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs request metadata without PHI."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start = time.monotonic()

        # Extract client IP (X-Forwarded-For aware for Cloud Run)
        forwarded = request.headers.get("x-forwarded-for")
        raw_client_ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )
        client_ip = _safe_client_ip(raw_client_ip)

        # Store request_id on request state for downstream use
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.monotonic() - start) * 1000)
            logger.error(
                "req=%s method=%s path=%s status=500 duration=%dms ip=%s",
                request_id, request.method, request.url.path, duration_ms, client_ip,
            )
            raise

        duration_ms = round((time.monotonic() - start) * 1000)

        # Log at INFO for success, WARNING for client errors, ERROR for server errors
        status = response.status_code
        if status >= 500:
            log_fn = logger.error
        elif status >= 400:
            log_fn = logger.warning
        else:
            log_fn = logger.info

        log_fn(
            "req=%s method=%s path=%s status=%d duration=%dms ip=%s",
            request_id, request.method, request.url.path, status, duration_ms, client_ip,
        )

        # Add request ID to response headers for debugging
        response.headers["X-Request-ID"] = request_id
        return response
