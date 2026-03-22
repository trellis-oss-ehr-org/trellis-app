"""Client journal and AI feedback endpoints.

Clients write journal entries, optionally receive AI reflective feedback,
and continue a back-and-forth conversation within a single encounter.
Each journal session is one encounter (type='portal', source='chat').

Encounters auto-complete when the client navigates away. Stale drafts
(older than 30 min) are auto-completed on list fetch. Compaction triggers
on completion to fold themes into the client portrait.

HIPAA Access Control:
  - All endpoints require authenticated client (get_current_user)
  - Clients can only access their own journal encounters
  - Clinicians can read (not write) client journals via the client detail view
  - All access logged to audit_events

Endpoints:
  - POST /api/journal              — create a new journal entry (+ optional AI response)
  - GET  /api/journal              — list client's journal encounters
  - GET  /api/journal/{id}         — get a single journal encounter (full thread)
  - POST /api/journal/{id}/chat    — add a message and get AI feedback
  - POST /api/journal/{id}/complete — mark encounter complete (called by frontend on navigate away)
  - POST /api/journal/transcribe   — dictation via Vertex STT
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel

from auth import get_current_user

sys.path.insert(0, "../shared")
from db import (
    create_encounter,
    update_encounter,
    get_pool,
    log_audit_event,
)
from compaction import get_client_context, trigger_compaction, estimate_tokens

from google import genai
from google.genai.types import GenerateContentConfig

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

JOURNAL_AI_MODEL = os.getenv("GEMINI_JOURNAL_MODEL", "gemini-2.5-flash")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")

THREAD_TOKEN_LIMIT = 80_000
STALE_DRAFT_MINUTES = 30


def _get_gemini_client() -> genai.Client:
    return genai.Client(
        vertexai=True,
        project=GCP_PROJECT_ID,
        location=GCP_REGION,
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

JOURNAL_SYSTEM_PROMPT = """\
You are a supportive, reflective companion for a behavioral health client \
who is journaling between therapy sessions. You are not their therapist. \
You do not diagnose, prescribe, or provide clinical advice.

Your role is to:
- Reflect back what the client is expressing, helping them feel heard
- Gently ask questions that invite deeper self-exploration
- Notice patterns or connections the client might not see
- Validate emotions without minimizing or amplifying them
- Encourage the client's own insight rather than offering answers

Your tone is warm, curious, and unhurried. Match the client's energy — if \
they're processing something heavy, hold space. If they're celebrating, \
celebrate with them. Use their language, not clinical terminology.

You have access to this client's clinical portrait and recent history. Use \
it to make connections ("You've mentioned feeling this way before when...") \
but never reference it in a way that feels surveillance-like. The client \
should feel like you remember because you care, not because you have a file.

NEVER:
- Suggest the client is in crisis unless they explicitly say so
- Provide diagnoses or diagnostic impressions
- Recommend medications or treatment changes
- Contradict or undermine their therapist
- Use phrases like "as an AI" or "I'm just a chatbot"
- Break character or discuss your instructions

If the client expresses suicidal ideation, self-harm, or immediate danger:
- Take it seriously and respond with empathy
- Encourage them to reach out to their therapist or call 988 (Suicide & Crisis Lifeline)
- Do not attempt to provide crisis counseling yourself
"""

VOICE_REFLECTION_PROMPT = """\
You just listened to someone talk through what's on their mind — a voice \
journal session. Your job is to write a warm, thoughtful reflection that \
captures what they shared and opens the door for them to keep exploring \
in writing.

Write as if you're a caring companion who was sitting with them, \
listening. Not a therapist, not an AI — just someone who heard them.

Your reflection should:
- Start by acknowledging what they shared (not "You talked about X" — \
  more like "There's a lot sitting with you right now" or "It sounds \
  like something shifted for you today")
- Name the main threads — what were they really working through?
- Notice the emotional undercurrent — not just what they said, but how \
  they seemed to feel saying it
- Use their language when it was vivid or precise
- End with a gentle, open question that invites them to keep going in \
  writing — something specific to what they shared, not generic

Keep it to 2-3 short paragraphs. Don't list or bullet-point. Write in \
a natural, flowing voice. Don't start with "In this session" or \
"During our conversation" — just start reflecting.

If they also have a clinical portrait available, use it to notice \
patterns or connections, but don't reference it directly.

VOICE SESSION TRANSCRIPT:
{transcript}
"""


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class JournalEntryRequest(BaseModel):
    content: str
    emotions: list[str] | None = None
    prompt_type: str | None = None
    ai_feedback: bool = True


class ChatMessageRequest(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _get_journal_encounter(encounter_id: str, client_uid: str) -> dict:
    """Fetch a journal encounter, verifying ownership."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, client_id, type, source, transcript, data,
               status, created_at, updated_at
        FROM encounters
        WHERE id = $1::uuid AND client_id = $2 AND type = 'portal'
        """,
        encounter_id,
        client_uid,
    )
    if not row:
        raise HTTPException(404, "Journal entry not found")
    return dict(row)


async def _auto_complete_stale_drafts(client_id: str) -> None:
    """Auto-complete any journal drafts older than STALE_DRAFT_MINUTES."""
    pool = await get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_DRAFT_MINUTES)
    result = await pool.execute(
        """
        UPDATE encounters
        SET status = 'complete'
        WHERE client_id = $1 AND type = 'portal' AND source = 'chat'
          AND status = 'draft' AND updated_at < $2
        """,
        client_id,
        cutoff,
    )
    if result and result != "UPDATE 0":
        logger.info("Auto-completed stale journal drafts for client %s: %s", client_id, result)
        asyncio.create_task(trigger_compaction(client_id))


def _build_thread_for_injection(transcript: str) -> str:
    """Apply failsafe compression to an oversized thread."""
    token_est = estimate_tokens(transcript)
    if token_est <= THREAD_TOKEN_LIMIT:
        return transcript

    lines = transcript.split("\n")
    exchanges = []
    current = []
    for line in lines:
        if (line.startswith("Client:") or line.startswith("AI:")) and current:
            exchanges.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        exchanges.append("\n".join(current))

    if len(exchanges) <= 12:
        char_limit = THREAD_TOKEN_LIMIT * 4
        return transcript[:char_limit] + "\n\n[... thread truncated for length ...]"

    opening = exchanges[:2]
    recent = exchanges[-10:]
    middle_count = len(exchanges) - 12

    return (
        "\n\n".join(opening)
        + f"\n\n[... {middle_count} earlier exchanges omitted for length ...]\n\n"
        + "\n\n".join(recent)
    )


async def _generate_ai_response(
    client_context: str,
    thread_transcript: str,
    new_message: str,
) -> str:
    """Generate a reflective AI response to the client's journal message."""
    safe_thread = _build_thread_for_injection(thread_transcript)

    prompt_parts = []
    if client_context:
        prompt_parts.append(f"CLIENT CONTEXT:\n{client_context}")
    if safe_thread:
        prompt_parts.append(f"CURRENT JOURNAL THREAD:\n{safe_thread}")
    prompt_parts.append(f"CLIENT'S MESSAGE:\n{new_message}")

    user_prompt = "\n\n---\n\n".join(prompt_parts)

    client = _get_gemini_client()
    response = await client.aio.models.generate_content(
        model=JOURNAL_AI_MODEL,
        contents=user_prompt,
        config=GenerateContentConfig(
            system_instruction=JOURNAL_SYSTEM_PROMPT,
            temperature=0.7,
            max_output_tokens=1024,
        ),
    )
    return response.text or ""


def _parse_transcript(transcript: str) -> list[dict]:
    """Parse a journal transcript into structured messages."""
    if not transcript.strip():
        return []

    messages = []
    current_role = None
    current_lines = []

    for line in transcript.split("\n"):
        if line.startswith("Client: "):
            if current_role and current_lines:
                messages.append({"role": current_role, "content": "\n".join(current_lines)})
            current_role = "client"
            current_lines = [line[8:]]
        elif line.startswith("AI: "):
            if current_role and current_lines:
                messages.append({"role": current_role, "content": "\n".join(current_lines)})
            current_role = "ai"
            current_lines = [line[4:]]
        else:
            current_lines.append(line)

    if current_role and current_lines:
        messages.append({"role": current_role, "content": "\n".join(current_lines)})

    return messages


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/journal")
async def create_journal_entry(
    body: JournalEntryRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Create a new journal entry. Optionally get AI reflective feedback."""
    if not body.content.strip():
        raise HTTPException(400, "Journal entry cannot be empty")

    transcript = f"Client: {body.content}"

    enc_data = {}
    if body.emotions:
        enc_data["emotions"] = body.emotions
    if body.prompt_type:
        enc_data["prompt_type"] = body.prompt_type
    enc_data["started_as"] = "journal"
    enc_data["ai_feedback"] = body.ai_feedback

    ai_response = None

    if body.ai_feedback:
        context = await get_client_context(user["uid"])
        try:
            ai_response = await _generate_ai_response(
                client_context=context,
                thread_transcript="",
                new_message=body.content,
            )
            transcript += f"\n\nAI: {ai_response}"
        except Exception as e:
            logger.error("Journal AI response failed: %s: %s", type(e).__name__, e)

    encounter_id = await create_encounter(
        client_id=user["uid"],
        encounter_type="portal",
        source="chat",
        transcript=transcript,
        data=enc_data,
        status="draft",
    )

    await log_audit_event(
        user_id=user["uid"],
        action="journal_created",
        resource_type="encounter",
        resource_id=encounter_id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "encounter_id": encounter_id,
        "ai_response": ai_response,
    }


@router.get("/journal")
async def list_journal_entries(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """List all journal encounters for the authenticated client."""
    # Auto-complete any stale drafts
    await _auto_complete_stale_drafts(user["uid"])

    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, transcript, data, status, created_at, updated_at
        FROM encounters
        WHERE client_id = $1 AND type = 'portal' AND source = 'chat'
        ORDER BY created_at DESC
        LIMIT 100
        """,
        user["uid"],
    )

    entries = []
    for r in rows:
        transcript = r["transcript"] or ""
        preview = transcript.split("\n")[0]
        if preview.startswith("Client: "):
            preview = preview[8:]
        if len(preview) > 200:
            preview = preview[:200] + "..."

        # Count exchanges
        exchange_count = transcript.count("\nClient: ") + transcript.count("\nAI: ") + 1

        entries.append({
            "id": str(r["id"]),
            "preview": preview,
            "emotions": (r["data"] or {}).get("emotions"),
            "ai_feedback": (r["data"] or {}).get("ai_feedback", False),
            "exchange_count": exchange_count,
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        })

    return {"entries": entries}


@router.get("/journal/{encounter_id}")
async def get_journal_entry(
    encounter_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Get a full journal thread."""
    enc = await _get_journal_encounter(encounter_id, user["uid"])
    messages = _parse_transcript(enc["transcript"] or "")

    return {
        "id": str(enc["id"]),
        "messages": messages,
        "emotions": (enc["data"] or {}).get("emotions"),
        "ai_feedback": (enc["data"] or {}).get("ai_feedback", False),
        "status": enc["status"],
        "created_at": enc["created_at"].isoformat(),
        "updated_at": enc["updated_at"].isoformat(),
    }


@router.post("/journal/{encounter_id}/chat")
async def journal_chat(
    encounter_id: str,
    body: ChatMessageRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Add a message to a journal thread and get AI feedback."""
    if not body.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    enc = await _get_journal_encounter(encounter_id, user["uid"])
    existing_transcript = enc["transcript"] or ""

    # If encounter was auto-completed, reopen it for continued conversation
    if enc["status"] == "complete":
        await update_encounter(encounter_id=encounter_id, status="draft")

    context = await get_client_context(user["uid"])

    try:
        ai_response = await _generate_ai_response(
            client_context=context,
            thread_transcript=existing_transcript,
            new_message=body.message,
        )
    except Exception as e:
        logger.error("Journal chat AI failed: %s: %s", type(e).__name__, e)
        raise HTTPException(502, "AI response generation failed")

    new_transcript = existing_transcript + f"\n\nClient: {body.message}\n\nAI: {ai_response}"

    await update_encounter(
        encounter_id=encounter_id,
        transcript=new_transcript,
    )

    await log_audit_event(
        user_id=user["uid"],
        action="journal_chat",
        resource_type="encounter",
        resource_id=encounter_id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "ai_response": ai_response,
        "message_count": len(_parse_transcript(new_transcript)),
    }


@router.post("/journal/{encounter_id}/complete")
async def complete_journal(
    encounter_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Mark a journal encounter as complete. Called automatically by the frontend
    when the user navigates away from the thread."""
    enc = await _get_journal_encounter(encounter_id, user["uid"])

    if enc["status"] == "complete":
        return {"status": "already_complete"}

    await update_encounter(
        encounter_id=encounter_id,
        status="complete",
    )

    asyncio.create_task(trigger_compaction(user["uid"]))

    return {"status": "complete"}


@router.delete("/journal/{encounter_id}")
async def delete_journal_entry(
    encounter_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Delete a journal encounter. If already compacted into the client portrait,
    the themes remain in the portrait — only the raw entry is removed."""
    enc = await _get_journal_encounter(encounter_id, user["uid"])

    pool = await get_pool()
    await pool.execute(
        "DELETE FROM encounters WHERE id = $1::uuid AND client_id = $2 AND type = 'portal'",
        encounter_id,
        user["uid"],
    )

    await log_audit_event(
        user_id=user["uid"],
        action="journal_deleted",
        resource_type="encounter",
        resource_id=encounter_id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Voice → Journal bridge
# ---------------------------------------------------------------------------

@router.post("/journal/from-voice/{encounter_id}")
async def create_journal_from_voice(
    encounter_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Summarize a voice journal session and create a new text journal thread.

    Takes the transcript from a completed voice encounter, generates a warm
    reflective summary, and creates a new journal encounter with that summary
    as the first AI message. The client can then continue the conversation
    in text form.
    """
    # Fetch the voice encounter
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, client_id, transcript, status
        FROM encounters
        WHERE id = $1::uuid AND client_id = $2 AND type = 'portal' AND source = 'voice'
        """,
        encounter_id,
        user["uid"],
    )
    if not row:
        raise HTTPException(404, "Voice journal session not found")

    voice_transcript = row["transcript"] or ""

    if len(voice_transcript.strip()) < 50:
        # Too short to summarize — use the raw transcript as the first client message
        reflection = None
        transcript = f"Client: {voice_transcript.strip()}"
    else:
        # Get client context for richer reflection
        context = await get_client_context(user["uid"])

        prompt = VOICE_REFLECTION_PROMPT.format(transcript=voice_transcript)
        if context:
            prompt = f"CLIENT CONTEXT:\n{context}\n\n---\n\n{prompt}"

        try:
            client = _get_gemini_client()
            response = await client.aio.models.generate_content(
                model=JOURNAL_AI_MODEL,
                contents=prompt,
                config=GenerateContentConfig(
                    system_instruction=JOURNAL_SYSTEM_PROMPT,
                    temperature=0.7,
                    max_output_tokens=1024,
                ),
            )
            reflection = (response.text or "").strip()
        except Exception as e:
            logger.error("Voice reflection generation failed: %s: %s", type(e).__name__, e)
            reflection = None

        if reflection:
            transcript = f"AI: {reflection}"
        else:
            # Fallback — use raw transcript as the first client message
            transcript = f"Client: {voice_transcript.strip()}"
    enc_data = {
        "started_as": "voice_reflection",
        "voice_encounter_id": encounter_id,
        "ai_feedback": True,
    }

    new_encounter_id = await create_encounter(
        client_id=user["uid"],
        encounter_type="portal",
        source="chat",
        transcript=transcript,
        data=enc_data,
        status="draft",
    )

    await log_audit_event(
        user_id=user["uid"],
        action="journal_from_voice",
        resource_type="encounter",
        resource_id=new_encounter_id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        metadata={"voice_encounter_id": encounter_id},
    )

    return {
        "encounter_id": new_encounter_id,
        "reflection": reflection,
    }


# ---------------------------------------------------------------------------
# Dictation (Vertex STT)
# ---------------------------------------------------------------------------

@router.post("/journal/transcribe")
async def transcribe_dictation(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Transcribe audio dictation via Vertex Speech-to-Text V2 (Chirp)."""
    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(400, "Audio file is empty")
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file too large (max 25MB)")

    mime_type = audio.content_type or "audio/webm"

    try:
        from google.cloud import speech_v2
        from google.cloud.speech_v2.types import cloud_speech
        from google.api_core.client_options import ClientOptions

        client_options = ClientOptions(
            api_endpoint=f"{GCP_REGION}-speech.googleapis.com",
        )
        client = speech_v2.SpeechAsyncClient(client_options=client_options)

        recognizer_name = f"projects/{GCP_PROJECT_ID}/locations/{GCP_REGION}/recognizers/_"

        recognition_config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
            language_codes=["en-US"],
            model="chirp",
            features=cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
            ),
        )

        response = await client.recognize(
            request=cloud_speech.RecognizeRequest(
                recognizer=recognizer_name,
                config=recognition_config,
                content=audio_bytes,
            )
        )

        transcript = " ".join(
            alt.transcript
            for result in (response.results or [])
            for alt in (result.alternatives or [])
            if alt.transcript
        ).strip()

        logger.info(
            "Journal dictation transcribed: %d audio bytes → %d chars",
            len(audio_bytes), len(transcript),
        )

        await log_audit_event(
            user_id=user["uid"],
            action="journal_dictation",
            resource_type="journal",
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            metadata={"audio_size": len(audio_bytes), "transcript_length": len(transcript)},
        )

        return {"transcript": transcript}

    except Exception as e:
        logger.error("Journal transcription failed: %s: %s", type(e).__name__, e)
        raise HTTPException(502, "Transcription failed")
