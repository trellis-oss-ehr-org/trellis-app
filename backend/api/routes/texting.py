"""Local bridge to Trellis-hosted text messaging services.

The cloned app owns only a stable install ID and a service credential. The
hosted trellis-services backend remains authoritative for BAA, Stripe status,
and Telnyx delivery.
"""
import sys
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Literal

import httpx
from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import enforce_clinician_owns_client, require_practice_member
from config import (
    API_BASE_URL,
    FRONTEND_BASE_URL,
    TEXTING_SERVICE_URL,
    is_production_like_environment,
)

sys.path.insert(0, "../shared")
from db import (
    get_appointment,
    get_client,
    get_practice,
    get_texting_connection,
    update_texting_connection,
    mark_text_reminder_sent,
    normalize_phone_number_for_texting,
    opt_out_clients_by_phone_sha256,
    sha256_hex,
    log_audit_event,
)
from token_encryption import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter()


class CompleteOnboardingRequest(BaseModel):
    session_id: str
    exchange_code: str


class SendTextRequest(BaseModel):
    client_id: str
    appointment_id: str
    template: Literal["appointment_reminder"] = "appointment_reminder"


class HostedTextingWebhook(BaseModel):
    event_type: Literal["sms_opt_out"]
    install_id: str
    phone_sha256: str
    provider_event_id: str | None = None
    occurred_at: str | None = None


def _service_url() -> str:
    if not TEXTING_SERVICE_URL:
        raise HTTPException(503, "TEXTING_SERVICE_URL is not configured")
    return TEXTING_SERVICE_URL


def _onboarding_secret(conn: dict) -> str:
    secret = conn.get("onboarding_secret")
    if not secret:
        raise HTTPException(
            500,
            "Texting onboarding secret is not configured; run the latest database migrations.",
        )
    return secret


def _install_callback_secret_hash(conn: dict) -> str:
    return sha256_hex(_onboarding_secret(conn))


def _webhook_signature_payload(timestamp: str, payload: bytes) -> bytes:
    return timestamp.encode("utf-8") + b"|" + payload


def _verify_hosted_webhook_signature(
    conn: dict,
    payload: bytes,
    install_id: str | None,
    timestamp: str | None,
    signature: str | None,
) -> None:
    if install_id != conn["install_id"]:
        raise HTTPException(403, "Invalid install id")
    if not timestamp or not signature:
        raise HTTPException(403, "Missing hosted webhook signature")
    try:
        signed_at = int(timestamp)
    except ValueError as exc:
        raise HTTPException(403, "Invalid hosted webhook timestamp") from exc
    now = int(datetime.now(timezone.utc).timestamp())
    if abs(now - signed_at) > 5 * 60:
        raise HTTPException(403, "Expired hosted webhook timestamp")

    expected = hmac.new(
        _install_callback_secret_hash(conn).encode("utf-8"),
        _webhook_signature_payload(timestamp, payload),
        "sha256",
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(403, "Invalid hosted webhook signature")


def _texting_service_error(resp: httpx.Response) -> str:
    return f"texting_service_http_{resp.status_code}"


def _looks_like_plaintext_texting_credential(value: str) -> bool:
    return value.startswith("trls_")


def _encrypt_texting_credential(credential: str) -> str:
    return encrypt_token(credential).decode("utf-8")


def _decrypt_texting_credential(stored: str | bytes | None) -> str | None:
    if not stored:
        return None
    if isinstance(stored, str) and _looks_like_plaintext_texting_credential(stored):
        return stored
    ciphertext = stored.encode("utf-8") if isinstance(stored, str) else stored
    return decrypt_token(ciphertext)


async def _service_credential(conn: dict) -> str | None:
    stored = conn.get("credential_secret")
    if not stored:
        return None

    if isinstance(stored, str) and _looks_like_plaintext_texting_credential(stored):
        try:
            encrypted = _encrypt_texting_credential(stored)
        except RuntimeError:
            if is_production_like_environment():
                raise HTTPException(
                    500,
                    "Texting credential encryption is not configured",
                )
            return stored
        await update_texting_connection(credential_secret=encrypted)
        logger.info("Migrated legacy texting credential to encrypted storage")
        return stored

    try:
        return _decrypt_texting_credential(stored)
    except (InvalidToken, RuntimeError):
        raise HTTPException(500, "Texting credential could not be decrypted")


def _public_connection(conn: dict, configured: bool) -> dict:
    texting_enabled = _local_texting_enabled(conn)
    return {
        "configured": configured,
        "install_id": conn["install_id"],
        "account_id": conn["account_id"],
        "status": conn["status"],
        "baa_status": conn["baa_status"],
        "shared_number_attestation_status": conn.get(
            "shared_number_attestation_status",
            "not_accepted",
        ),
        "subscription_status": conn["subscription_status"],
        "telnyx_status": conn["telnyx_status"],
        "credential_key_prefix": conn["credential_key_prefix"],
        "last_error": conn["last_error"],
        "last_synced_at": conn["last_synced_at"],
        "texting_enabled": texting_enabled,
    }


def _local_texting_enabled(conn: dict) -> bool:
    return (
        conn["baa_status"] == "signed"
        and conn.get("shared_number_attestation_status") == "accepted"
        and conn["subscription_status"] in {"active", "trialing"}
        and conn["telnyx_status"] == "ready"
        and bool(conn["credential_secret"])
    )


async def texting_send_available() -> bool:
    """Return whether this install can attempt paid SMS sends."""
    if not TEXTING_SERVICE_URL:
        return False
    conn = await get_texting_connection()
    return _local_texting_enabled(conn)


def _format_sms_date_time(scheduled_at: str) -> tuple[str, str]:
    appt_dt = datetime.fromisoformat(scheduled_at)
    date_str = f"{appt_dt.strftime('%b')} {appt_dt.day}, {appt_dt.year}"
    time_str = appt_dt.strftime("%I:%M %p").lstrip("0")
    return date_str, time_str


def _build_appointment_reminder_sms(scheduled_at: str) -> str:
    date_str, time_str = _format_sms_date_time(scheduled_at)
    return (
        f"Trellis reminder: appointment on {date_str} at {time_str}. "
        "Reply STOP to opt out. Msg&data rates may apply."
    )


def _validate_client_texting_consent(client: dict) -> None:
    if client.get("sms_consent_status") != "consented":
        raise HTTPException(409, "Client has not consented to text reminders")
    if client.get("sms_opted_out_at"):
        raise HTTPException(409, "Client has opted out of text reminders")
    if not (client.get("phone") or "").strip():
        raise HTTPException(409, "Client does not have a phone number")


async def _sync_status_from_service(conn: dict) -> dict:
    if not TEXTING_SERVICE_URL or not conn.get("credential_secret"):
        return conn
    credential = await _service_credential(conn)
    if not credential:
        return conn
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{TEXTING_SERVICE_URL}/v1/texting/install/status",
                headers={"Authorization": f"Bearer {credential}"},
                json={"install_id": conn["install_id"]},
            )
        if resp.status_code >= 400:
            return await update_texting_connection(
                status="error",
                last_error=_texting_service_error(resp),
            )
        data = resp.json()
        return await update_texting_connection(
            account_id=data.get("account_id") or conn.get("account_id"),
            status="active" if data.get("texting_enabled") else data.get("subscription_status", "unknown"),
            baa_status=data.get("baa_status", conn["baa_status"]),
            shared_number_attestation_status=data.get(
                "shared_number_attestation_status",
                conn.get("shared_number_attestation_status", "not_accepted"),
            ),
            subscription_status=data.get("subscription_status", conn["subscription_status"]),
            telnyx_status=data.get("telnyx_status", conn["telnyx_status"]),
            last_error=None,
            last_synced_at=datetime.now(timezone.utc),
        )
    except Exception as exc:
        return await update_texting_connection(
            status="error",
            last_error=str(exc)[:500],
        )


@router.post("/texting/webhooks/hosted")
async def hosted_texting_webhook(request: Request):
    """Receive signed hosted-service events for this local install."""
    conn = await get_texting_connection()
    raw_payload = await request.body()
    _verify_hosted_webhook_signature(
        conn,
        raw_payload,
        request.headers.get("x-trellis-install-id"),
        request.headers.get("x-trellis-timestamp"),
        request.headers.get("x-trellis-signature-sha256"),
    )

    try:
        payload = HostedTextingWebhook.model_validate(json.loads(raw_payload))
    except ValueError as exc:
        raise HTTPException(400, "Invalid hosted texting webhook") from exc

    if payload.install_id != conn["install_id"]:
        raise HTTPException(403, "Invalid install id")

    updated_clients = await opt_out_clients_by_phone_sha256(
        payload.phone_sha256,
        source="telnyx_stop",
        updated_by="hosted_texting_webhook",
        hash_key=_install_callback_secret_hash(conn),
    )
    await log_audit_event(
        user_id=None,
        action="texting_opt_out_synced",
        resource_type="texting_consent",
        resource_id=payload.provider_event_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={
            "event_type": payload.event_type,
            "matched_clients": len(updated_clients),
        },
    )
    return {"status": "processed", "matched_clients": len(updated_clients)}


@router.get("/texting/status")
async def texting_status(user: dict = Depends(require_practice_member())):
    """Return local cached texting status, refreshing from hosted services when connected."""
    conn = await get_texting_connection()
    conn = await _sync_status_from_service(conn)
    return _public_connection(conn, bool(TEXTING_SERVICE_URL))


@router.post("/texting/onboarding/start")
async def start_texting_onboarding(
    request: Request,
    user: dict = Depends(require_practice_member("owner")),
):
    """Start BAA + Stripe onboarding on hosted trellis-services."""
    service_url = _service_url()
    conn = await get_texting_connection()
    practice = await get_practice(user["practice_id"])

    payload = {
        "install_id": conn["install_id"],
        "install_secret": _onboarding_secret(conn),
        "practice_id": user["practice_id"],
        "practice_name": practice["name"] if practice else None,
        "owner_uid": user["uid"],
        "owner_email": user.get("email"),
        "return_url": f"{FRONTEND_BASE_URL}/settings/texting",
        "install_callback_url": f"{API_BASE_URL}/api/texting/webhooks/hosted",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{service_url}/v1/texting/onboarding/start",
            json=payload,
        )
    if resp.status_code >= 400:
        await update_texting_connection(
            status="error",
            service_url=service_url,
            last_error=_texting_service_error(resp),
        )
        raise HTTPException(resp.status_code, "Texting onboarding service failed")

    data = resp.json()
    await update_texting_connection(
        account_id=data.get("account_id"),
        service_url=service_url,
        status="onboarding_started",
        baa_status=data.get("baa_status", "not_signed"),
        subscription_status=data.get("subscription_status", "not_started"),
        last_error=None,
    )
    await log_audit_event(
        user_id=user["uid"],
        action="started",
        resource_type="texting_onboarding",
        resource_id=data.get("account_id"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"onboarding_url": data["onboarding_url"]}


@router.post("/texting/onboarding/complete")
async def complete_texting_onboarding(
    body: CompleteOnboardingRequest,
    request: Request,
    user: dict = Depends(require_practice_member("owner")),
):
    """Exchange the hosted one-time return code for this install's service credential."""
    service_url = _service_url()
    conn = await get_texting_connection()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{service_url}/v1/texting/install/exchange",
            json={
                "install_id": conn["install_id"],
                "install_secret": _onboarding_secret(conn),
                "session_id": body.session_id,
                "exchange_code": body.exchange_code,
            },
        )

    if resp.status_code == 409:
        detail = resp.json().get("detail", "Subscription activation is pending")
        conn = await update_texting_connection(
            status="pending_activation",
            service_url=service_url,
            last_error=detail,
        )
        return {**_public_connection(conn, True), "detail": detail}

    if resp.status_code >= 400:
        await update_texting_connection(
            status="error",
            service_url=service_url,
            last_error=_texting_service_error(resp),
        )
        raise HTTPException(resp.status_code, "Texting credential exchange failed")

    data = resp.json()
    try:
        encrypted_credential = _encrypt_texting_credential(data["credential"])
    except RuntimeError:
        raise HTTPException(500, "Texting credential encryption is not configured")

    conn = await update_texting_connection(
        account_id=data["account_id"],
        service_url=service_url,
        credential_secret=encrypted_credential,
        credential_key_prefix=data["key_prefix"],
        status="active",
        baa_status=data.get("baa_status", "signed"),
        shared_number_attestation_status=data.get(
            "shared_number_attestation_status",
            "accepted",
        ),
        subscription_status=data.get("status", "active"),
        telnyx_status=data.get("telnyx_status", "ready"),
        last_error=None,
        last_synced_at=datetime.now(timezone.utc),
    )
    await log_audit_event(
        user_id=user["uid"],
        action="connected",
        resource_type="texting_onboarding",
        resource_id=data["account_id"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return _public_connection(conn, True)


@router.post("/texting/billing-portal")
async def texting_billing_portal(user: dict = Depends(require_practice_member("owner"))):
    """Create a hosted Stripe customer portal URL for an active texting install."""
    service_url = _service_url()
    conn = await get_texting_connection()
    credential = await _service_credential(conn)
    if not credential:
        raise HTTPException(409, "Texting is not connected yet")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{service_url}/v1/texting/billing-portal",
            headers={"Authorization": f"Bearer {credential}"},
            json={
                "install_id": conn["install_id"],
                "return_url": f"{FRONTEND_BASE_URL}/settings/practice",
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, "Texting billing portal request failed")
    return resp.json()


async def _send_text_to_service(
    conn: dict,
    to_number: str,
    scheduled_at: str,
    install_message_id: str,
) -> dict:
    service_url = _service_url()
    credential = await _service_credential(conn)
    if not credential:
        raise HTTPException(402, "Texting is not connected")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{service_url}/v1/texting/messages",
            headers={"Authorization": f"Bearer {credential}"},
            json={
                "install_id": conn["install_id"],
                "to_number": to_number,
                "template": "appointment_reminder",
                "template_params": {"scheduled_at": scheduled_at},
                "install_message_id": install_message_id,
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, "Texting message request failed")
    return resp.json()


async def send_appointment_reminder_text(
    appt: dict,
    client: dict | None = None,
) -> dict:
    """Send the approved SMS appointment reminder template for one appointment."""
    client = client or await get_client(appt["client_id"])
    if not client:
        raise HTTPException(404, "Client not found")
    _validate_client_texting_consent(client)

    if appt.get("status") != "scheduled":
        raise HTTPException(400, "Only scheduled appointments can receive reminders")

    conn = await get_texting_connection()
    if not _local_texting_enabled(conn):
        raise HTTPException(402, "Texting is not connected")

    install_message_id = f"appointment:{appt['id']}:reminder24h"
    return await _send_text_to_service(
        conn,
        to_number=normalize_phone_number_for_texting(client["phone"]),
        scheduled_at=appt["scheduled_at"],
        install_message_id=install_message_id,
    )


@router.post("/texting/messages")
async def send_text_message(
    body: SendTextRequest,
    request: Request,
    user: dict = Depends(require_practice_member()),
):
    """Send an approved text template through hosted Trellis/Telnyx."""
    client = await get_client(body.client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    await enforce_clinician_owns_client(user, body.client_id)

    appt = await get_appointment(body.appointment_id)
    if not appt or appt.get("client_id") != body.client_id:
        raise HTTPException(404, "Appointment not found")

    result = await send_appointment_reminder_text(appt, client=client)
    await mark_text_reminder_sent(appt["id"])
    await log_audit_event(
        user_id=user["uid"],
        action="text_reminder_sent",
        resource_type="appointment",
        resource_id=appt["id"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"template": body.template, "client_id": body.client_id},
    )
    return result
