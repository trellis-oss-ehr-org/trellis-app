"""Unit tests for hosted texting security helpers."""

import pytest

from routes import texting


@pytest.fixture(autouse=True)
def cleanup_test_data():
    """Override backend DB cleanup for pure texting unit tests."""
    yield


def test_texting_credential_is_encrypted_before_storage(monkeypatch):
    monkeypatch.setattr(texting, "encrypt_token", lambda plaintext: b"encrypted-secret")

    assert texting._encrypt_texting_credential("trls_plaintext") == "encrypted-secret"


def test_texting_credential_decrypts_encrypted_storage(monkeypatch):
    monkeypatch.setattr(texting, "decrypt_token", lambda ciphertext: "trls_plaintext")

    assert texting._decrypt_texting_credential("encrypted-secret") == "trls_plaintext"


def test_legacy_plaintext_texting_credential_is_detected_without_decrypting():
    assert texting._decrypt_texting_credential("trls_legacy") == "trls_legacy"
