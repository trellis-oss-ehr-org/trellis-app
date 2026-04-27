"""Unit tests for hosted texting security helpers."""

import hmac
import json
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from conftest import clinician_headers, client_headers
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


def test_texting_onboarding_secret_is_required():
    assert texting._onboarding_secret({"onboarding_secret": "secret-value"}) == "secret-value"

    with pytest.raises(HTTPException):
        texting._onboarding_secret({})


def test_hosted_webhook_signature_verifies_against_install_secret():
    conn = {
        "install_id": "00000000-0000-0000-0000-000000000000",
        "onboarding_secret": "a" * 32,
    }
    payload = b'{"event_type":"sms_opt_out"}'
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    signature = hmac.new(
        texting._install_callback_secret_hash(conn).encode("utf-8"),
        texting._webhook_signature_payload(timestamp, payload),
        "sha256",
    ).hexdigest()

    texting._verify_hosted_webhook_signature(
        conn,
        payload,
        conn["install_id"],
        timestamp,
        signature,
    )


def test_hosted_webhook_signature_rejects_tampered_payload():
    conn = {
        "install_id": "00000000-0000-0000-0000-000000000000",
        "onboarding_secret": "a" * 32,
    }
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    signature = hmac.new(
        texting._install_callback_secret_hash(conn).encode("utf-8"),
        texting._webhook_signature_payload(timestamp, b"{}"),
        "sha256",
    ).hexdigest()

    with pytest.raises(HTTPException):
        texting._verify_hosted_webhook_signature(
            conn,
            b'{"changed":true}',
            conn["install_id"],
            timestamp,
            signature,
        )


def test_appointment_reminder_sms_uses_safe_template():
    body = texting._build_appointment_reminder_sms("2026-05-01T14:30:00+00:00")

    assert "Trellis reminder" in body
    assert "Reply STOP" in body
    assert "therapy" not in body.lower()
    assert "clinician" not in body.lower()
    assert "meet.google" not in body.lower()
    assert len(body) <= 160


def test_texting_consent_is_required_before_send():
    with pytest.raises(HTTPException) as exc:
        texting._validate_client_texting_consent(
            {"sms_consent_status": "unknown", "phone": "+15551234567"}
        )

    assert exc.value.status_code == 409


def test_texting_consent_requires_phone_number():
    with pytest.raises(HTTPException) as exc:
        texting._validate_client_texting_consent(
            {"sms_consent_status": "consented", "phone": " "}
        )

    assert exc.value.status_code == 409


def test_texting_consent_allows_consented_client_with_phone():
    texting._validate_client_texting_consent(
        {"sms_consent_status": "consented", "phone": "+15551234567"}
    )


async def test_update_texting_consent_endpoint(client):
    await client.post(
        "/api/auth/register",
        json={"role": "clinician"},
        headers=clinician_headers(),
    )
    await client.post(
        "/api/auth/register",
        json={"role": "client"},
        headers=client_headers(),
    )

    from db import get_pool

    pool = await get_pool()
    client_id = str(await pool.fetchval(
        "SELECT id FROM clients WHERE firebase_uid = 'test-client-1'"
    ))

    resp = await client.patch(
        f"/api/clients/{client_id}/texting-consent",
        json={"status": "consented", "source": "written"},
        headers=clinician_headers(),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["sms_consent_status"] == "consented"
    assert data["sms_consent_source"] == "written"
    assert data["sms_consent_version"] == "2026-04-27-shared-trellis-number-v1"
    assert data["sms_consent_at"] is not None


async def test_client_intake_records_sms_consent_text_and_version(client):
    await client.post(
        "/api/auth/register",
        json={"role": "client"},
        headers=client_headers(),
    )

    resp = await client.post(
        "/api/intake",
        json={
            "demographics": {
                "name": "Client One",
                "dateOfBirth": "1990-01-01",
                "phone": "(555) 123-4567",
                "smsReminderConsent": True,
            }
        },
        headers=client_headers(),
    )

    assert resp.status_code == 200
    from db import get_client

    updated = await get_client("test-client-1")
    assert updated["sms_consent_status"] == "consented"
    assert updated["sms_consent_source"] == "client_intake"
    assert updated["sms_consent_version"] == "2026-04-27-shared-trellis-number-v1"
    assert "Trellis LLC" in updated["sms_consent_text"]


async def test_hosted_stop_webhook_opts_out_matching_client(client):
    await client.post(
        "/api/auth/register",
        json={"role": "clinician"},
        headers=clinician_headers(),
    )
    await client.post(
        "/api/auth/register",
        json={"role": "client"},
        headers=client_headers(),
    )

    from db import get_client, get_texting_connection, phone_sha256_for_texting, update_client

    await update_client(
        "test-client-1",
        phone="(555) 123-4567",
        sms_consent_status="consented",
    )
    conn = await get_texting_connection()
    payload = {
        "event_type": "sms_opt_out",
        "install_id": conn["install_id"],
        "phone_sha256": phone_sha256_for_texting("+15551234567"),
        "provider_event_id": "telnyx-event-1",
        "occurred_at": "2026-04-27T12:00:00Z",
    }
    raw_payload = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    signature = hmac.new(
        texting._install_callback_secret_hash(conn).encode("utf-8"),
        texting._webhook_signature_payload(timestamp, raw_payload),
        "sha256",
    ).hexdigest()

    resp = await client.post(
        "/api/texting/webhooks/hosted",
        content=raw_payload,
        headers={
            "Content-Type": "application/json",
            "X-Trellis-Install-Id": conn["install_id"],
            "X-Trellis-Timestamp": timestamp,
            "X-Trellis-Signature-SHA256": signature,
        },
    )

    assert resp.status_code == 200
    assert resp.json()["matched_clients"] == 1
    updated = await get_client("test-client-1")
    assert updated["sms_consent_status"] == "opted_out"
    assert updated["sms_consent_source"] == "telnyx_stop"
    assert updated["sms_opted_out_at"] is not None
