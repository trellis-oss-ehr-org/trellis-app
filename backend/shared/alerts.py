"""Operational alerts for new client intake."""
import logging
import os
from datetime import datetime, timezone

from mailer import send_email

logger = logging.getLogger(__name__)

BD_EMAIL = os.getenv("BD_ALERT_EMAIL", "")


async def notify_bd_new_intake(
    client_name: str,
    source: str,
    transcript: str,
    data: dict | None = None,
    encounter_id: str | None = None,
):
    """Send a minimized operational alert when a new intake is completed.

    Args:
        client_name: Ignored. Kept for backward-compatible call sites.
        source: "voice" or "form"
        transcript: Ignored. Clinical content remains in Trellis.
        data: Ignored. Clinical content remains in Trellis.
        encounter_id: Optional encounter ID for reference
    """
    now = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    source_label = "Voice Intake" if source == "voice" else "Written Form"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fafaf9; padding: 24px;">
        <div style="background: #0f766e; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">New Client Intake</h1>
            <p style="color: #99f6e4; margin: 4px 0 0; font-size: 14px;">{now}</p>
        </div>

        <div style="background: white; padding: 24px; border: 1px solid #e7e5e4; border-top: none;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                    <td style="padding: 8px 12px; font-weight: 600; color: #57534e;">Source</td>
                    <td style="padding: 8px 12px;">
                        <span style="background: {'#ccfbf1' if source == 'voice' else '#e8ebe3'}; color: {'#0f766e' if source == 'voice' else '#4a5440'}; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: 500;">{source_label}</span>
                    </td>
                </tr>
                {f'<tr><td style="padding: 8px 12px; font-weight: 600; color: #57534e;">Encounter ID</td><td style="padding: 8px 12px; color: #1c1917;">{encounter_id}</td></tr>' if encounter_id else ''}
            </table>

            <p style="margin: 16px 0 0; color: #57534e;">A new intake was completed. Review the record in Trellis.</p>
        </div>

        <div style="padding: 16px; text-align: center; border-radius: 0 0 12px 12px; background: #f5f5f4; border: 1px solid #e7e5e4; border-top: none;">
            <p style="margin: 0; font-size: 13px; color: #78716c;">Trellis — AI-Native Behavioral Health</p>
        </div>
    </div>
    """

    text = f"""New Client Intake — {now}

Source: {source_label}

{'Encounter ID: ' + encounter_id if encounter_id else ''}

Review the record in Trellis.
---
Trellis — AI-Native Behavioral Health
"""

    if not BD_EMAIL:
        logger.debug("BD_ALERT_EMAIL not configured — skipping intake alert")
        return

    try:
        await send_email(
            to=BD_EMAIL,
            subject=f"New Intake Completed ({source_label})",
            html_body=html,
            text_body=text,
        )
    except Exception:
        logger.error("BD alert failed")
