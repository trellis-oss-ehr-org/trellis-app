"""Tests for relay booking confirmation emails."""
import os
import sys

import pytest

relay_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/relay"))
if relay_dir not in sys.path:
    sys.path.insert(0, relay_dir)

import booking_emails  # noqa: E402


def cleanup_test_data():
    """Override backend DB cleanup for pure relay unit tests."""


@pytest.mark.asyncio
async def test_clinician_confirmation_escapes_html(monkeypatch):
    sent = {}

    async def fake_send_email(**kwargs):
        sent.update(kwargs)

    monkeypatch.setattr(booking_emails, "send_email", fake_send_email)

    await booking_emails.send_clinician_confirmation(
        clinician_email="clinician@example.com",
        clinician_name='Dr. <img src=x onerror="alert(1)">',
        practice_name="Practice <b>Bad</b>",
        client_name='Client <script>alert("x")</script>',
        client_email='client@example.com"><img src=x onerror=alert(1)>',
        scheduled_at="2026-05-15T10:00:00",
        meet_link='https://meet.example.com/a?x="><script>alert(1)</script>',
        duration_minutes=60,
        transcript='Transcript <script>alert("phi")</script> & notes',
        appointment_id='appt"><script>alert(1)</script>',
        clinician_uid="clinician-1",
    )

    html = sent["html_body"]
    assert "<script>" not in html
    assert "<img" not in html
    assert 'onerror="alert(1)"' not in html
    assert "&lt;script&gt;" in html
    assert "&lt;img" in html
    assert "&amp; notes" in html
    assert "\n" not in sent["subject"]
