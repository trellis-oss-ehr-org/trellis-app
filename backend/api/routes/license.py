"""License key management endpoints.

Allows clinicians to activate a license key by validating it against
the external trellis-services server, and check their current license status.
"""

import logging
import sys

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import require_role
from config import TRELLIS_SERVICES_URL

sys.path.insert(0, "../shared")
from db import (
    get_clinician,
    log_audit_event,
    get_pool,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_SERVICES_URL = TRELLIS_SERVICES_URL.rstrip("/") if TRELLIS_SERVICES_URL else ""

_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)


class ActivateKeyRequest(BaseModel):
    key: str


@router.put("/practice/license-key")
async def activate_license_key(
    body: ActivateKeyRequest,
    request: Request,
    user: dict = Depends(require_role("clinician")),
):
    """Validate and save a license key.

    Calls trellis-services to validate the key and get the features it grants.
    Stores the key and features on the practice.
    """
    if not _SERVICES_URL:
        raise HTTPException(500, "License service not configured")

    clinician = await get_clinician(user["uid"])
    if not clinician or clinician["practice_role"] != "owner":
        raise HTTPException(403, "Only the practice owner can manage the license key")

    # Validate key against trellis-services
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{_SERVICES_URL}/keys/validate",
                headers={"X-API-Key": body.key},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("License validation failed: %s", e)
        raise HTTPException(502, "Could not reach the license service")

    if not data.get("valid"):
        raise HTTPException(400, "Invalid or expired license key")

    features = data.get("features", {})

    # Store key and features on the practice
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE practices
        SET billing_api_key = $1,
            billing_service_url = $2,
            licensed_features = $3::jsonb,
            updated_at = now()
        WHERE id = $4::uuid
        """,
        body.key,
        _SERVICES_URL,
        features,
        clinician["practice_id"],
    )

    # Enable SMS on the practice if the key grants it
    if features.get("sms"):
        await pool.execute(
            "UPDATE practices SET sms_enabled = true WHERE id = $1::uuid",
            clinician["practice_id"],
        )

    await log_audit_event(
        user_id=user["uid"],
        action="activated_license",
        resource_type="practice",
        resource_id=clinician["practice_id"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"features": features},
    )

    return {
        "status": "activated",
        "features": features,
        "practice_name": data.get("practice_name"),
    }


@router.get("/practice/license-key")
async def get_license_status(
    request: Request,
    user: dict = Depends(require_role("clinician")),
):
    """Get the current license key status and features."""
    clinician = await get_clinician(user["uid"])
    if not clinician:
        raise HTTPException(404, "Clinician not found")

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT billing_api_key, billing_service_url, licensed_features
        FROM practices WHERE id = $1::uuid
        """,
        clinician["practice_id"],
    )

    if not row or not row["billing_api_key"]:
        return {"has_key": False, "features": {}}

    return {
        "has_key": True,
        "key_preview": row["billing_api_key"][:16] + "..." if row["billing_api_key"] else None,
        "features": row["licensed_features"] or {},
    }


@router.delete("/practice/license-key")
async def remove_license_key(
    request: Request,
    user: dict = Depends(require_role("clinician")),
):
    """Remove the license key and disable licensed features."""
    clinician = await get_clinician(user["uid"])
    if not clinician or clinician["practice_role"] != "owner":
        raise HTTPException(403, "Only the practice owner can manage the license key")

    pool = await get_pool()
    await pool.execute(
        """
        UPDATE practices
        SET billing_api_key = NULL,
            billing_service_url = NULL,
            licensed_features = '{}',
            sms_enabled = false,
            updated_at = now()
        WHERE id = $1::uuid
        """,
        clinician["practice_id"],
    )

    await log_audit_event(
        user_id=user["uid"],
        action="removed_license",
        resource_type="practice",
        resource_id=clinician["practice_id"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {"status": "removed"}
