import logging
import sys

import pytest

from safe_logging import PHISafeFormatter


@pytest.fixture(autouse=True)
def cleanup_test_data():
    """Override backend DB cleanup for pure logging unit tests."""
    yield


def _format_record(message, args=(), exc_info=None):
    record = logging.LogRecord(
        name="test.safe_logging",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=args,
        exc_info=exc_info,
    )
    formatter = PHISafeFormatter("%(levelname)s %(message)s")
    return formatter.format(record)


def test_phi_safe_formatter_redacts_interpolated_args():
    rendered = _format_record(
        "Failed to send message to %s at %s with token=%s",
        ("client@example.com", "(555) 123-4567", "secret-token-123"),
    )

    assert "client@example.com" not in rendered
    assert "(555) 123-4567" not in rendered
    assert "secret-token-123" not in rendered
    assert "[REDACTED_EMAIL]" in rendered
    assert "[REDACTED_PHONE]" in rendered
    assert "token=[REDACTED_SECRET]" in rendered


def test_phi_safe_formatter_redacts_exception_text():
    try:
        raise ValueError("lookup failed for client@example.com using Bearer abc123")
    except ValueError:
        rendered = _format_record("Unhandled exception", exc_info=sys.exc_info())

    assert "client@example.com" not in rendered
    assert "Bearer abc123" not in rendered
    assert "[REDACTED_EMAIL]" in rendered
    assert "[REDACTED_BEARER_TOKEN]" in rendered


def test_phi_safe_formatter_redacts_json_secret_values_and_ssn():
    rendered = _format_record(
        'payload={"refresh_token":"abc123","ssn":"123-45-6789"} api_key=secret123'
    )

    assert "abc123" not in rendered
    assert "secret123" not in rendered
    assert "123-45-6789" not in rendered
    assert "[REDACTED_SECRET]" in rendered
    assert "[REDACTED_SSN]" in rendered
