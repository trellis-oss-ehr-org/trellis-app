"""Tests for cron endpoints (Cloud Scheduler)."""
from datetime import datetime, timedelta

from conftest import clinician_headers, client_headers


CRON_HEADERS = {"X-Cron-Secret": "dev-cron-secret"}
BAD_CRON_HEADERS = {"X-Cron-Secret": "wrong-secret"}


async def test_cron_check_reconfirmations(client):
    """POST /api/cron/check-reconfirmations runs with correct secret."""
    resp = await client.post(
        "/api/cron/check-reconfirmations", headers=CRON_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "released_count" in data


async def test_cron_send_reminders(client):
    """POST /api/cron/send-reminders runs with correct secret."""
    resp = await client.post("/api/cron/send-reminders", headers=CRON_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "sent_count" in data
    assert "errors" in data


async def test_cron_send_reminders_sends_text_for_consented_client(client, monkeypatch):
    """SMS reminders only send through the approved template path after consent."""
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

    from db import create_appointment, get_pool, update_client
    from routes import texting

    await update_client(
        "test-client-1",
        phone="+15551234567",
        sms_consent_status="consented",
    )
    appointment_id = await create_appointment(
        client_id="test-client-1",
        client_email="client@example.com",
        client_name="Text Client",
        clinician_id="test-clinician-1",
        clinician_email="test@example.com",
        appt_type="assessment",
        scheduled_at=(datetime.now() + timedelta(hours=20)).isoformat(),
        duration_minutes=60,
        created_by="test-clinician-1",
    )

    sent_ids: list[str] = []

    async def fake_available():
        return True

    async def fake_send(appt):
        sent_ids.append(appt["id"])
        return {"status": "sent", "message_id": "msg_test"}

    monkeypatch.setattr(texting, "texting_send_available", fake_available)
    monkeypatch.setattr(texting, "send_appointment_reminder_text", fake_send)

    resp = await client.post("/api/cron/send-reminders", headers=CRON_HEADERS)

    assert resp.status_code == 200
    data = resp.json()
    assert data["text_sent_count"] >= 1
    assert appointment_id in sent_ids

    pool = await get_pool()
    marked_at = await pool.fetchval(
        "SELECT text_reminder_sent_at FROM appointments WHERE id = $1::uuid",
        appointment_id,
    )
    assert marked_at is not None


async def test_cron_check_no_shows(client):
    """POST /api/cron/check-no-shows runs with correct secret."""
    resp = await client.post("/api/cron/check-no-shows", headers=CRON_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "no_show_count" in data


async def test_cron_check_unsigned_docs(client):
    """POST /api/cron/check-unsigned-docs runs with correct secret."""
    resp = await client.post(
        "/api/cron/check-unsigned-docs", headers=CRON_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "clinician_alerts" in data
    assert "client_reminders" in data


async def test_cron_process_recordings(client):
    """POST /api/cron/process-recordings runs with correct secret."""
    resp = await client.post(
        "/api/cron/process-recordings", headers=CRON_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "processed" in data


async def test_cron_rejects_bad_secret(client):
    """Cron endpoints return 403 with wrong secret."""
    resp = await client.post(
        "/api/cron/check-reconfirmations", headers=BAD_CRON_HEADERS
    )
    assert resp.status_code == 403


async def test_cron_rejects_no_secret(client):
    """Cron endpoints return 403 without X-Cron-Secret header."""
    resp = await client.post("/api/cron/send-reminders")
    assert resp.status_code == 403
