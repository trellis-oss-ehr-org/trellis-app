"""Push notification subscription endpoints.

Clients register/unregister FCM tokens to receive appointment reminders
as push notifications on their devices.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from db import (
    upsert_push_subscription,
    delete_push_subscription,
    log_audit_event,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class PushTokenRequest(BaseModel):
    fcm_token: str
    device_label: str | None = None


@router.post("/push/register")
async def register_push(
    body: PushTokenRequest,
    user: dict = Depends(get_current_user),
):
    """Register an FCM token for push notifications."""
    if not body.fcm_token or not body.fcm_token.strip():
        raise HTTPException(status_code=400, detail="fcm_token is required")

    await upsert_push_subscription(
        client_id=user["uid"],
        fcm_token=body.fcm_token.strip(),
        device_label=body.device_label,
    )

    await log_audit_event(
        user_id=user["uid"],
        action="push_subscription_registered",
        resource_type="push_subscription",
        resource_id=None,
        ip_address=None,
        user_agent=None,
        metadata={"device_label": body.device_label},
    )

    return {"status": "registered"}


@router.post("/push/unregister")
async def unregister_push(
    body: PushTokenRequest,
    user: dict = Depends(get_current_user),
):
    """Unregister an FCM token."""
    if not body.fcm_token or not body.fcm_token.strip():
        raise HTTPException(status_code=400, detail="fcm_token is required")

    await delete_push_subscription(
        client_id=user["uid"],
        fcm_token=body.fcm_token.strip(),
    )

    await log_audit_event(
        user_id=user["uid"],
        action="push_subscription_removed",
        resource_type="push_subscription",
        resource_id=None,
        ip_address=None,
        user_agent=None,
        metadata={},
    )

    return {"status": "unregistered"}
