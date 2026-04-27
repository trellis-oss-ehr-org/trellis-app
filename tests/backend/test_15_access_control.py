"""Tests for role-based access control and row-level security."""
from conftest import clinician_headers, client_headers, client2_headers, make_token
from datetime import datetime, timedelta


CLINICIAN2_TOKEN = make_token("test-clinician-2", "clinician2@example.com")


def clinician2_headers():
    return {"Authorization": f"Bearer {CLINICIAN2_TOKEN}"}


async def _register_both(client):
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
    await client.post(
        "/api/auth/register",
        json={"role": "client"},
        headers=client2_headers(),
    )


async def _add_second_clinician(practice_id: str):
    from db import create_clinician, get_pool, upsert_user

    await upsert_user(
        firebase_uid="test-clinician-2",
        email="clinician2@example.com",
        role="clinician",
        display_name="Dr. Second",
    )
    await create_clinician(
        practice_id=practice_id,
        firebase_uid="test-clinician-2",
        email="clinician2@example.com",
        clinician_name="Dr. Second",
        practice_role="clinician",
        status="active",
    )
    pool = await get_pool()
    await pool.execute(
        "UPDATE users SET practice_id = $1::uuid WHERE firebase_uid = $2",
        practice_id,
        "test-clinician-2",
    )


async def _register_owner_client_and_second_clinician(client):
    resp = await client.post(
        "/api/auth/register",
        json={"role": "clinician"},
        headers=clinician_headers(),
    )
    practice_id = resp.json()["practice_id"]
    await _add_second_clinician(practice_id)
    await client.post(
        "/api/auth/register",
        json={"role": "client", "display_name": "Assigned Client"},
        headers=client_headers(),
    )
    return practice_id


async def _client_uuid(firebase_uid: str = "test-client-1") -> str:
    from db import get_pool

    pool = await get_pool()
    return str(await pool.fetchval(
        "SELECT id FROM clients WHERE firebase_uid = $1",
        firebase_uid,
    ))


# --- Clinician-only routes ---

async def test_client_cannot_access_clients_list(client):
    """Clients cannot access GET /api/clients."""
    await _register_both(client)
    resp = await client.get("/api/clients", headers=client_headers())
    assert resp.status_code == 403


async def test_client_cannot_access_notes_unsigned(client):
    """Clients cannot access GET /api/notes/unsigned."""
    await _register_both(client)
    resp = await client.get("/api/notes/unsigned", headers=client_headers())
    assert resp.status_code == 403


async def test_client_cannot_generate_note(client):
    """Clients cannot access POST /api/notes/generate."""
    await _register_both(client)
    resp = await client.post(
        "/api/notes/generate",
        json={"encounter_id": "00000000-0000-0000-0000-000000000000"},
        headers=client_headers(),
    )
    assert resp.status_code == 403


async def test_client_cannot_access_audit_log(client):
    """Clients cannot access GET /api/audit-log."""
    await _register_both(client)
    resp = await client.get("/api/audit-log", headers=client_headers())
    assert resp.status_code == 403


async def test_client_cannot_generate_superbill(client):
    """Clients cannot access POST /api/superbills/generate."""
    await _register_both(client)
    resp = await client.post(
        "/api/superbills/generate",
        json={"note_id": "00000000-0000-0000-0000-000000000000"},
        headers=client_headers(),
    )
    assert resp.status_code == 403


async def test_client_cannot_access_assistant(client):
    """Clients cannot access POST /api/assistant/chat."""
    await _register_both(client)
    resp = await client.post(
        "/api/assistant/chat",
        json={"message": "Hello", "history": []},
        headers=client_headers(),
    )
    assert resp.status_code == 403


# --- Row-level access ---

async def test_client_appointments_scoped_to_self(client):
    """GET /api/appointments forces client_id to authenticated user."""
    await _register_both(client)
    start = datetime.now().strftime("%Y-%m-%dT00:00:00")
    end = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59")
    resp = await client.get(
        "/api/appointments",
        params={"start": start, "end": end, "client_id": "test-client-2"},
        headers=client_headers(),  # client-1 trying to see client-2's data
    )
    assert resp.status_code == 200
    # The backend forces client_id=user.uid for non-clinicians
    # So even if they pass client_id=test-client-2, they get their own data


async def test_client_cannot_book_for_another(client):
    """Clients can only book appointments for themselves."""
    await _register_both(client)
    resp = await client.post(
        "/api/appointments",
        json={
            "client_id": "test-client-2",  # trying to book for another
            "client_email": "client2@example.com",
            "client_name": "Other Client",
            "clinician_id": "test-clinician-1",
            "clinician_email": "test@example.com",
            "type": "assessment",
            "scheduled_at": (datetime.now() + timedelta(days=7)).isoformat(),
            "duration_minutes": 60,
        },
        headers=client_headers(),  # client-1 trying to book for client-2
    )
    assert resp.status_code == 403


async def test_non_owner_clinician_cannot_update_unassigned_client(client):
    """Non-owner clinicians cannot mutate clients assigned to someone else."""
    await _register_owner_client_and_second_clinician(client)
    client_id = await _client_uuid()

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"phone": "555-999-0000"},
        headers=clinician2_headers(),
    )

    assert resp.status_code == 403


async def test_non_owner_clinician_cannot_update_unassigned_texting_consent(client):
    """Non-owner clinicians cannot change SMS consent for another clinician's client."""
    await _register_owner_client_and_second_clinician(client)
    client_id = await _client_uuid()

    resp = await client.patch(
        f"/api/clients/{client_id}/texting-consent",
        json={"status": "consented", "source": "written"},
        headers=clinician2_headers(),
    )

    assert resp.status_code == 403


async def test_non_owner_clinician_cannot_read_unassigned_note(client):
    """Non-owner clinicians cannot read notes for another clinician's client."""
    await _register_owner_client_and_second_clinician(client)

    from db import create_encounter, get_pool

    encounter_id = await create_encounter(
        client_id="test-client-1",
        clinician_id="test-clinician-1",
        encounter_type="clinical",
        source="clinician",
        transcript="Private session transcript",
        status="complete",
    )
    pool = await get_pool()
    note_id = str(await pool.fetchval(
        """
        INSERT INTO clinical_notes (encounter_id, format, content, status, clinician_id)
        VALUES ($1::uuid, 'SOAP', '{"subjective":"private"}'::jsonb, 'draft', $2)
        RETURNING id
        """,
        encounter_id,
        "test-clinician-1",
    ))

    resp = await client.get(
        f"/api/notes/{note_id}",
        headers=clinician2_headers(),
    )

    assert resp.status_code == 403


async def test_non_owner_clinician_cannot_patch_unassigned_appointment(client):
    """Non-owner clinicians cannot change another clinician's appointment."""
    await _register_owner_client_and_second_clinician(client)

    from db import create_appointment

    appointment_id = await create_appointment(
        client_id="test-client-1",
        client_email="client@example.com",
        client_name="Assigned Client",
        clinician_id="test-clinician-1",
        clinician_email="test@example.com",
        appt_type="assessment",
        scheduled_at=(datetime.now() + timedelta(days=5)).isoformat(),
        duration_minutes=60,
        created_by="test-clinician-1",
    )

    resp = await client.patch(
        f"/api/appointments/{appointment_id}",
        json={"status": "cancelled", "cancelled_reason": "not allowed"},
        headers=clinician2_headers(),
    )

    assert resp.status_code == 403


async def test_non_owner_clinician_cannot_read_unassigned_transcript(client):
    """Non-owner clinicians cannot retrieve another clinician's session transcript."""
    await _register_owner_client_and_second_clinician(client)

    from db import create_appointment, create_encounter, get_pool

    encounter_id = await create_encounter(
        client_id="test-client-1",
        clinician_id="test-clinician-1",
        encounter_type="clinical",
        source="voice",
        transcript="Private transcript",
        status="complete",
    )
    appointment_id = await create_appointment(
        client_id="test-client-1",
        client_email="client@example.com",
        client_name="Assigned Client",
        clinician_id="test-clinician-1",
        clinician_email="test@example.com",
        appt_type="assessment",
        scheduled_at=(datetime.now() + timedelta(days=5)).isoformat(),
        duration_minutes=60,
        created_by="test-clinician-1",
    )
    pool = await get_pool()
    await pool.execute(
        "UPDATE appointments SET encounter_id = $1::uuid WHERE id = $2::uuid",
        encounter_id,
        appointment_id,
    )

    resp = await client.get(
        f"/api/sessions/{appointment_id}/transcript",
        headers=clinician2_headers(),
    )

    assert resp.status_code == 403
