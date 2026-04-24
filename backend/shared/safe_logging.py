"""PHI-safe logging utilities for HIPAA compliance.

All backend services must use these patterns to ensure no Protected Health
Information (PHI) appears in application logs (stdout/stderr/Cloud Run logs).

PHI includes but is not limited to:
  - Patient/client names
  - Email addresses
  - Phone numbers
  - Dates of birth
  - Diagnoses and ICD-10 codes
  - Transcript content
  - Clinical note content
  - Insurance member IDs
  - Addresses

Safe to log:
  - Request IDs, resource UUIDs
  - HTTP methods, paths, status codes
  - Timing/duration metrics
  - Record counts
  - Error types (not error messages containing PHI)
  - Configuration values
  - Service operational state
"""
import copy
import logging
import re


def redact_phi(message: str) -> str:
    """Redact potential PHI patterns from a log message.

    This is a best-effort safety net. The primary defense is to never
    pass PHI to logging calls in the first place.
    """
    # Redact email addresses
    message = re.sub(
        r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        '[REDACTED_EMAIL]',
        message,
    )
    # Redact common US phone number formats
    message = re.sub(
        r'(?<!\w)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)',
        '[REDACTED_PHONE]',
        message,
    )
    # Redact bearer tokens and common secret-bearing key/value pairs
    message = re.sub(
        r'(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+',
        '[REDACTED_BEARER_TOKEN]',
        message,
    )
    message = re.sub(
        r'(?i)\b(token|access_token|refresh_token|id_token|api_key|secret|password)=([^\s&]+)',
        r'\1=[REDACTED_SECRET]',
        message,
    )
    return message


class PHISafeFormatter(logging.Formatter):
    """Log formatter that redacts potential PHI patterns as a safety net.

    This catches accidental PHI in log messages. The primary defense is
    to never pass PHI to logging calls.
    """

    def format(self, record: logging.LogRecord) -> str:
        safe_record = copy.copy(record)
        safe_record.msg = redact_phi(record.getMessage())
        safe_record.args = ()
        safe_record.exc_text = None
        return redact_phi(super().format(safe_record))


def configure_safe_logging(level: int = logging.INFO) -> None:
    """Configure root logger with PHI-safe formatter.

    Call this at service startup before any other logging.
    """
    handler = logging.StreamHandler()
    handler.setFormatter(PHISafeFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
