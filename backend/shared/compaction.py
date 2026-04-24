"""Rolling context compaction for client portraits.

Maintains a persistent, incrementally-enriched clinical portrait per client.
After each encounter, checks whether unsummarized material exceeds the token
budget. If so, compresses the oldest unsummarized encounters into the rolling
summary, keeping the most recent encounters "hot" (uncompacted) for full-
fidelity context injection.

All AI features pull context through get_client_context(), which returns
the compressed portrait + recent raw encounters.
"""
import asyncio
import logging
import os

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHARS_PER_TOKEN = 4
COMPACTION_THRESHOLD = 30_000   # compress when unsummarized tokens exceed this
HOT_BUFFER_TOKENS = 10_000     # keep this many tokens of recent encounters raw

COMPACTION_MODEL = os.getenv("GEMINI_COMPACTION_MODEL", "gemini-2.5-flash")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")

# ---------------------------------------------------------------------------
# Compaction Prompts
# ---------------------------------------------------------------------------

INITIAL_COMPACTION_PROMPT = """\
You are a skilled therapist reviewing session material for one of your
clients. Your task is to distill everything you've observed into a living
clinical portrait — not a summary of what happened, but a map of who this
person is and how they're moving through treatment.

Think of this as your private preparation notes before a session: What do
I need to hold in mind about this person? What patterns keep showing up?
What's shifting? What moments stay with me?

Write the following sections. Each should be a rich but efficient
distillation — capture the signal, not the noise. Favor themes over events.
When a specific moment is especially revealing or poignant, preserve the
client's exact words in quotes.


## Identity

Who they are — name, age, pronouns, life circumstances. How they present:
their energy, their way of being in conversation. Not demographics for a
chart, but the felt sense of this person.


## Why They Came

The original wound or reason, in their language. What they said when asked
why they're here. This section should barely change over time — it's the
anchor.


## Core Themes

The patterns that recur across interactions. Name each theme, then describe
how it shows up — with specificity. A good theme entry looks like:

  "Control — surfaces as rigid scheduling, difficulty delegating at work,
   and a need to 'have a plan' before exploring emotions in session.
   Connected to early parentification (became the household manager at 11
   after mother's depression)."

Themes might include relational dynamics, self-concept patterns, emotional
or behavioral patterns, somatic patterns, cognitive distortions, or
recurring metaphors the client uses to describe their experience.

Between-session material (journal entries, chat check-ins) is especially
valuable for themes — it shows what the client carries with them outside
the therapy room.


## Therapeutic Arc

Where they started. Where they are now. What's shifting. This is the
narrative of movement — breakthroughs, regressions, plateaus, turning
points. Not a session log. The trajectory.


## Moments That Matter

Verbatim quotes or specific moments that crystallize something essential
about this client — the things a therapist would still remember years
later. Keep only the most revealing. If a new moment eclipses an older
one on the same theme, let the older one go. Aim for 3–7 moments, each
with a brief note on why it matters.

Example:
  "I don't think I've ever told anyone that before." (Session 4 — first
   time client disclosed childhood neglect. Marked a shift from
   intellectualized narrative to embodied vulnerability.)


## Clinical Anchors

Diagnoses (provisional or confirmed), medications, medical conditions,
risk factors, safety considerations, substance use. The factual clinical
backbone — current and precise.


## How to Be With This Person

Rapport notes for anyone — AI or human — interacting with this client.
What works: pacing, tone, humor, directness, how much silence they can
hold. What to avoid: triggers, sensitivities, framings that shut them
down. Their defense mechanisms and how those show up in conversation.
What the therapeutic alliance is built on, and where it's fragile.


## Growing Edges

What the client is approaching but hasn't fully accessed. Themes they
circle around. Questions they aren't yet asking. This is clinical
intuition about where treatment is heading — the next layer of work.


---

RULES:
- Themes should deepen over time, not just accumulate. Enrich, don't list.
- Never fabricate. Every claim must trace to the source material.
- Prefer the client's own language when it's more alive than clinical
  terminology. A client who says "I just disappear inside myself" is more
  useful than "client exhibits dissociative tendencies."
- If something contradicts an earlier pattern, name the contradiction —
  it may be growth, or it may be a new facet.
- Between-session data (journals, chat) often reveals what the client
  is processing on their own. Weight it as signal, not noise.
- Be concise but never reductive. Compression without loss of meaning.


SOURCE MATERIAL:
"""

INCREMENTAL_COMPACTION_PROMPT = """\
You are updating the clinical portrait for an ongoing client. Below is the
existing portrait, followed by new material that has not yet been
incorporated.

Your task is to produce an updated portrait — not a rewrite, an evolution:

- DEEPEN existing themes with new evidence or nuance. A theme that keeps
  showing up should get richer, not longer.
- ADD new themes only when something genuinely new has emerged.
- UPDATE the therapeutic arc to reflect the current trajectory. Collapse
  older arc detail into the themes it informed.
- PRESERVE moments that still matter. REPLACE a moment only when something
  more crystallizing has surfaced on the same theme. NEVER exceed 7.
- REFRESH clinical anchors if anything has changed.
- REFINE "how to be with this person" — the AI and clinician need to know
  if rapport dynamics have shifted.
- SHARPEN growing edges — some edges from before may now be active themes.
  Move them. New edges may have appeared. Name them.

The updated portrait should read as if written by someone who has known
this client for the full duration of treatment — seamless, not a patchwork
of updates.

Preserve the same section structure. Do not add new sections.


EXISTING PORTRAIT:
{existing_summary}


NEW MATERIAL TO INCORPORATE:
{new_encounters}
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def estimate_tokens(text: str) -> int:
    """Rough token count. ~4 chars per token for English."""
    return len(text) // CHARS_PER_TOKEN


def _format_encounter_for_compaction(encounter: dict) -> str:
    """Format a single encounter for the compaction prompt."""
    source = encounter.get("source", "unknown")
    enc_type = encounter.get("type", "unknown")
    date = encounter.get("created_at", "unknown date")
    transcript = encounter.get("transcript", "")

    label = f"{enc_type}/{source}" if enc_type != source else source
    return f"--- {label}, {date} ---\n{transcript}"


def _get_gemini_client() -> genai.Client:
    return genai.Client(
        vertexai=True,
        project=GCP_PROJECT_ID,
        location=GCP_REGION,
    )


# ---------------------------------------------------------------------------
# Core compaction
# ---------------------------------------------------------------------------


async def _run_compaction(
    existing_summary: str | None,
    encounters_to_compress: list[dict],
) -> str:
    """Run the compaction prompt against Gemini and return the new portrait."""
    encounter_text = "\n\n".join(
        _format_encounter_for_compaction(e) for e in encounters_to_compress
    )

    if existing_summary:
        prompt = INCREMENTAL_COMPACTION_PROMPT.format(
            existing_summary=existing_summary,
            new_encounters=encounter_text,
        )
    else:
        prompt = INITIAL_COMPACTION_PROMPT + encounter_text

    client = _get_gemini_client()

    try:
        response = await client.aio.models.generate_content(
            model=COMPACTION_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=2000),
                temperature=0.2,
                max_output_tokens=8192,
            ),
        )

        result = response.text
        if not result:
            logger.error("Compaction returned empty response")
            return existing_summary or ""

        original_tokens = estimate_tokens(encounter_text)
        result_tokens = estimate_tokens(result)
        logger.info(
            "Compaction complete: %d encounter tokens → %d portrait tokens (%.0f%% reduction)",
            original_tokens,
            result_tokens,
            (1 - result_tokens / max(original_tokens, 1)) * 100,
        )
        return result

    except Exception as e:
        logger.error("Compaction failed: %s: %s", type(e).__name__, e)
        return existing_summary or ""


async def check_and_compact(client_id: str) -> bool:
    """Check if compaction is needed for a client and run it if so.

    Called after every encounter save. Returns True if compaction ran.
    """
    # Import here to avoid circular imports (db.py imports nothing from us)
    from db import (
        get_client_summary,
        get_unsummarized_encounters,
        update_client_summary,
        mark_encounters_summarized,
    )

    unsummarized = await get_unsummarized_encounters(client_id)
    if not unsummarized:
        return False

    total_tokens = sum(e.get("token_estimate") or estimate_tokens(e.get("transcript", "")) for e in unsummarized)

    if total_tokens < COMPACTION_THRESHOLD:
        logger.debug(
            "%d unsummarized tokens (threshold %d) — skipping compaction",
            total_tokens, COMPACTION_THRESHOLD,
        )
        return False

    logger.info(
        "%d unsummarized tokens across %d encounters — compacting",
        total_tokens, len(unsummarized),
    )

    # Split: keep recent encounters hot, compress the rest
    to_keep = []
    to_compress = []
    running_tokens = 0

    for encounter in reversed(unsummarized):  # newest first
        enc_tokens = encounter.get("token_estimate") or estimate_tokens(encounter.get("transcript", ""))
        running_tokens += enc_tokens
        if running_tokens <= HOT_BUFFER_TOKENS:
            to_keep.append(encounter)
        else:
            to_compress.append(encounter)

    # to_compress is newest-first from the loop, reverse to oldest-first
    to_compress.reverse()

    if not to_compress:
        return False

    # Get existing summary
    summary_data = await get_client_summary(client_id)
    existing_summary = summary_data.get("context_summary") if summary_data else None
    current_version = summary_data.get("summary_version", 0) if summary_data else 0

    # Run compaction
    new_summary = await _run_compaction(existing_summary, to_compress)
    if not new_summary:
        return False

    # Atomic update
    new_version = current_version + 1
    encounter_ids = [e["id"] for e in to_compress]
    await update_client_summary(client_id, new_summary, new_version)
    await mark_encounters_summarized(encounter_ids, new_version)

    logger.info(
        "Compacted %d encounters into portrait v%d (%d tokens)",
        len(to_compress), new_version, estimate_tokens(new_summary),
    )
    return True


async def trigger_compaction(client_id: str) -> None:
    """Fire-and-forget compaction check. Logs errors but never raises."""
    try:
        await check_and_compact(client_id)
    except Exception as e:
        logger.error("Compaction trigger failed: %s", type(e).__name__)


# ---------------------------------------------------------------------------
# Unified context retrieval — all AI features use this
# ---------------------------------------------------------------------------


async def get_client_context(client_id: str) -> str:
    """Build the full context string for any AI feature.

    Returns: compressed portrait (if any) + recent raw encounters, formatted
    as a single string ready for system prompt injection.
    """
    from db import get_client_summary, get_unsummarized_encounters

    summary_data = await get_client_summary(client_id)
    unsummarized = await get_unsummarized_encounters(client_id)

    parts = []

    # 1. Compressed portrait
    if summary_data and summary_data.get("context_summary"):
        parts.append(
            f"--- Client Portrait (compressed history, v{summary_data.get('summary_version', 0)}) ---\n"
            f"{summary_data['context_summary']}"
        )

    # 2. Recent raw encounters (oldest-first for chronological flow)
    for enc in unsummarized:
        parts.append(_format_encounter_for_compaction(enc))

    return "\n\n".join(parts)
