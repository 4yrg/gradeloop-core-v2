"""Post-session viva grader.

Takes the raw transcript of a finished viva and asks a non-live Gemini model
to:
  - Identify each conceptual question the examiner asked.
  - Pair it with the student's answer.
  - Score each answer out of 10 with a short justification.

The grader is intentionally isolated from the Live WebSocket bridge so that a
grading failure never affects the realtime session — callers should wrap its
invocation in a try/except.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.logging_config import get_logger

logger = get_logger(__name__)


MAX_SCORE_PER_QUESTION = 10.0


def _format_transcript_for_prompt(turns: list[dict]) -> str:
    """Render an in-memory transcript list into a readable dialogue block."""
    lines: list[str] = []
    for t in turns:
        role = "Examiner" if t.get("role") == "examiner" else "Student"
        content = (t.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _format_assignment_block(assignment_context: dict | None) -> str:
    ctx = assignment_context or {}
    bits = []
    for key, label in (
        ("title", "Title"),
        ("code", "Code"),
        ("programming_language", "Subject"),
        ("description", "Description"),
    ):
        val = (ctx.get(key) or "").strip() if isinstance(ctx.get(key), str) else ""
        if val:
            bits.append(f"- {label}: {val}")
    return "\n".join(bits) if bits else "- (no assignment context provided)"


def _build_grading_prompt(
    transcript: str,
    assignment_block: str,
) -> str:
    return f"""You are a strict but fair grader reviewing a completed oral examination (viva voce).

Your task: read the transcript below, identify every distinct CONCEPTUAL question the examiner asked, pair each with the student's answer, and score each answer out of {MAX_SCORE_PER_QUESTION:.0f}.

Assignment that was being examined:
{assignment_block}

Rules:
- Only include substantive conceptual questions (ignore greetings, chit-chat, acknowledgements, and pure pleasantries).
- If the student did not answer a question (or answer is missing/off-topic), still include the item but set response_text to null and give an appropriate low score (0-3).
- Justifications must be 1-2 sentences, specific, and reference what the student actually said.
- Use whole or half numbers between 0 and {MAX_SCORE_PER_QUESTION:.0f} for scores.
- Return ONLY a valid JSON object matching the schema below. Do NOT wrap it in markdown or prose.

JSON schema:
{{
  "items": [
    {{
      "sequence_num": <1-based integer>,
      "question_text": "<the exact question the examiner asked, paraphrased if long>",
      "response_text": "<the student's answer, or null if none>",
      "score": <number between 0 and {MAX_SCORE_PER_QUESTION:.0f}>,
      "score_justification": "<1-2 sentence reason>"
    }}
  ]
}}

Transcript:
---
{transcript}
---
"""


def _extract_json(text: str) -> dict | None:
    """Best-effort JSON extraction from a model response.

    Handles plain JSON, fenced ```json blocks, and leading/trailing chatter.
    Returns None on failure.
    """
    if not text:
        return None
    text = text.strip()

    # Strip markdown code fences if present.
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)

    # First try: parse as-is.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: find the widest balanced {...} slice.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


async def grade_viva_transcript(
    *,
    gemini_api_key: str,
    grader_model: str,
    turns: list[dict],
    assignment_context: dict | None,
) -> dict:
    """Grade a completed viva. Returns {"items": [...], "total_score": float, "max_possible": float}.

    `turns` is a list of {turn_number, role, content} dicts accumulated by the
    live bridge. Empty transcripts yield zero items — the caller should handle
    that case gracefully.
    """
    if not turns:
        return {"items": [], "total_score": 0.0, "max_possible": 0.0}

    transcript = _format_transcript_for_prompt(turns)
    if not transcript.strip():
        return {"items": [], "total_score": 0.0, "max_possible": 0.0}

    from google import genai

    client = genai.Client(api_key=gemini_api_key)

    prompt = _build_grading_prompt(
        transcript=transcript,
        assignment_block=_format_assignment_block(assignment_context),
    )

    logger.info("grader_calling", model=grader_model, turn_count=len(turns))

    try:
        response = await client.aio.models.generate_content(
            model=grader_model,
            contents=prompt,
        )
    except Exception as exc:
        logger.error("grader_call_failed", error=str(exc))
        raise

    raw_text = getattr(response, "text", None) or ""
    parsed = _extract_json(raw_text)
    if not parsed or not isinstance(parsed, dict):
        logger.warning("grader_parse_failed", raw=raw_text[:500])
        return {"items": [], "total_score": 0.0, "max_possible": 0.0}

    raw_items: list[Any] = parsed.get("items") or []
    cleaned: list[dict] = []
    total = 0.0
    for idx, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue
        q = str(item.get("question_text") or "").strip()
        if not q:
            continue
        resp = item.get("response_text")
        if resp is not None:
            resp = str(resp).strip() or None
        score_val = item.get("score")
        try:
            score = float(score_val) if score_val is not None else 0.0
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(MAX_SCORE_PER_QUESTION, score))
        justification = str(item.get("score_justification") or "").strip() or None
        # Use per-item max_score if provided, otherwise default to global max
        item_max = item.get("max_score")
        try:
            item_max = float(item_max) if item_max is not None else MAX_SCORE_PER_QUESTION
        except (TypeError, ValueError):
            item_max = MAX_SCORE_PER_QUESTION
        cleaned.append({
            "sequence_num": idx,
            "question_text": q,
            "response_text": resp,
            "score": score,
            "max_score": item_max,
            "score_justification": justification,
        })
        total += score

    # Sum per-item max scores instead of assuming uniform max
    max_possible = sum(item["max_score"] for item in cleaned)
    logger.info(
        "grader_done",
        question_count=len(cleaned),
        total_score=total,
        max_possible=max_possible,
    )
    return {
        "items": cleaned,
        "total_score": total,
        "max_possible": max_possible,
    }
