"""Tests for production security configuration helpers."""

import pytest

from config import parse_allowed_origins
from request_logging import _safe_client_ip


def test_production_cors_rejects_wildcard():
    with pytest.raises(RuntimeError):
        parse_allowed_origins("*", app_env="production")


def test_production_cors_rejects_localhost_http():
    with pytest.raises(RuntimeError):
        parse_allowed_origins("http://localhost:5173", app_env="production")


def test_production_cors_allows_https_origin():
    assert parse_allowed_origins(
        "https://app.example.com, https://admin.example.com/",
        app_env="production",
    ) == ["https://app.example.com", "https://admin.example.com"]


def test_request_ip_hashing_does_not_log_plain_ip(monkeypatch):
    monkeypatch.setenv("REQUEST_IP_LOGGING", "hash")
    monkeypatch.setenv("LOG_HASH_SECRET", "test-secret")

    rendered = _safe_client_ip("203.0.113.10")

    assert "203.0.113.10" not in rendered
    assert rendered.startswith("ip_hash=")
