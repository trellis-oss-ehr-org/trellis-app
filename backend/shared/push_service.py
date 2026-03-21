"""FCM push notification service.

Sends PHI-free appointment reminders via Firebase Cloud Messaging.
Payloads contain only date/time — no client names or session details.
"""
import logging
from typing import Optional

from firebase_admin import messaging

logger = logging.getLogger(__name__)


async def send_push_notifications(
    tokens: list[str],
    title: str,
    body: str,
    click_url: Optional[str] = None,
) -> list[str]:
    """Send a push notification to multiple FCM tokens.

    Returns a list of tokens that failed (for cleanup).
    Uses send_each() so one bad token doesn't block the rest.
    """
    if not tokens:
        return []

    messages = []
    for token in tokens:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
            webpush=messaging.WebpushConfig(
                fcm_options=messaging.WebpushFCMOptions(link=click_url)
                if click_url
                else None,
            ),
        )
        messages.append(msg)

    try:
        response = messaging.send_each(messages)
    except Exception:
        logger.exception("FCM send_each failed entirely")
        return list(tokens)

    failed_tokens: list[str] = []
    for i, send_response in enumerate(response.responses):
        if not send_response.success:
            error = send_response.exception
            # Token is invalid or unregistered — should be cleaned up
            if isinstance(error, (
                messaging.UnregisteredError,
                messaging.InvalidArgumentError,
            )):
                failed_tokens.append(tokens[i])
                logger.info("Stale FCM token removed: %s…", tokens[i][:20])
            else:
                logger.warning("FCM send failed for token %s…: %s", tokens[i][:20], error)

    logger.info(
        "Push notifications: %d sent, %d failed out of %d",
        response.success_count,
        response.failure_count,
        len(tokens),
    )
    return failed_tokens
