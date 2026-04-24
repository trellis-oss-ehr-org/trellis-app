"""Local bridge to Trellis-hosted text messaging services.

The cloned app owns only a stable install ID and a service credential. The
hosted trellis-services backend remains authoritative for BAA, Stripe status,
and Telnyx delivery.
"""
import sys
import logging
from datetime import datetime, timezone

import httpx
from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import require_practice_member
from config import FRONTEND_BASE_URL, TEXTING_SERVICE_URL, is_production_like_environment

sys.path.insert(0, "../shared")
from db import (
    get_practice,
    get_texting_connection,
    update_texting_connection,
    log_audit_event,
)
from token_encryption import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter()


class CompleteOnboardingRequest(BaseModel):
    session_id: str
    exchange_code: str


class SendTextRequest(BaseModel):
    to_number: str = Field(min_length=7, max_length=32)
    body: str = Field(min_length=1, max_length=1600)
    install_message_id: str | None = None
    metadata: dict | None = None


def _service_url() -> str:
    if not TEXTING_SERVICE_URL:
        raise HTTPException(503, "TEXTING_SERVICE_URL is not configured")
    return TEXTING_SERVICE_URL


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
    return {
        "configured": configured,
        "install_id": conn["install_id"],
        "account_id": conn["account_id"],
        "status": conn["status"],
        "baa_status": conn["baa_status"],
        "subscription_status": conn["subscription_status"],
        "telnyx_status": conn["telnyx_status"],
        "credential_key_prefix": conn["credential_key_prefix"],
        "last_error": conn["last_error"],
        "last_synced_at": conn["last_synced_at"],
        "texting_enabled": (
            conn["baa_status"] == "signed"
            and conn["subscription_status"] in {"active", "trialing"}
            and bool(conn["credential_secret"])
        ),
    }


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
        "practice_id": user["practice_id"],
        "practice_name": practice["name"] if practice else None,
        "owner_uid": user["uid"],
        "owner_email": user.get("email"),
        "return_url": f"{FRONTEND_BASE_URL}/settings/practice",
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


@router.post("/texting/messages")
async def send_text_message(
    body: SendTextRequest,
    user: dict = Depends(require_practice_member()),
):
    """Forward an authenticated text request to hosted Trellis/Telnyx."""
    service_url = _service_url()
    conn = await get_texting_connection()
    credential = await _service_credential(conn)
    if not credential:
        raise HTTPException(402, "Texting is not connected")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{service_url}/v1/texting/messages",
            headers={"Authorization": f"Bearer {credential}"},
            json={
                "install_id": conn["install_id"],
                "to_number": body.to_number,
                "body": body.body,
                "install_message_id": body.install_message_id,
                "metadata": body.metadata,
            },
        )
    if resp.status_code >= 400:
        raise HTTPException(resp.status_code, "Texting message request failed")
    return resp.json()
