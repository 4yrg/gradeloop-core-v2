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
    # Use string concatenation for template sections that embed
    # transcript/assignment text. This avoids any risk of curly braces
    # in user content being misinterpreted by f-string parsing, and
    # makes it clear where user content enters the prompt.
    max_score = int(MAX_SCORE_PER_QUESTION)
    return (
        "You are a strict but fair grader reviewing a completed oral examination (viva voce).\n"
        "\n"
        f"Your task: read the transcript below, identify every distinct CONCEPTUAL question the examiner asked, "
        f"pair each with the student's answer, and score each answer out of {max_score}.\n"
        "\n"
        "Assignment that was being examined:\n" + assignment_block + "\n\n"
        "Rules:\n"
        "- Only include substantive conceptual questions (ignore greetings, chit-chat, acknowledgements, and pure pleasantries).\n"
        "- If the student did not answer a question (or answer is missing/off-topic), still include the item but set response_text to null and give an appropriate low score (0-3).\n"
        "- Justifications must be 1-2 sentences, specific, and reference what the student actually said.\n"
        f"- Use whole or half numbers between 0 and {max_score} for scores.\n"
        "- Return ONLY a valid JSON object matching the schema below. Do NOT wrap it in markdown or prose.\n"
        "\n"
        "JSON schema:\n"
        "{\n"
        '  "items": [\n'
        "    {\n"
        '      "sequence_num": <1-based integer>,\n'
        '      "question_text": "<the exact question the examiner asked, paraphrased if long>",\n'
        '      "response_text": "<the student\'s answer, or null if none>",\n'
        f'      "score": <number between 0 and {max_score}>,\n'
        '      "score_justification": "<1-2 sentence reason>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "\n"
        "Transcript:\n"
        "---\n" + transcript + "\n---\n"
    )


def _build_plan_aware_grading_prompt(
    planned_questions: list[dict],
    transcript: str,
    assignment_block: str,
) -> str:
    """Build a grading prompt that aligns the grader output to the planned questions.

    This guarantees the resulting items have sequence_num matching the plan, so
    upstream code that maps sequence_num → competency works reliably even if
    the live examiner asked follow-ups, paraphrased, or skipped questions.
    """
    plan_lines = []
    for q in planned_questions:
        q_text = q.get("question_text") or f"(topic: {q.get('competency_name', 'unknown')})"
        plan_lines.append(
            f"  [seq={q['sequence_num']}] (competency: {q.get('competency_name', '?')}, "
            f"difficulty: {q.get('difficulty', '?')})\n"
            f"      Q: {q_text}"
        )
    plan_block = "\n".join(plan_lines)

    # Use string concatenation for template sections that embed
    # transcript/assignment text. This avoids any risk of curly braces
    # in user content being misinterpreted by f-string parsing, and
    # makes it clear where user content enters the prompt.
    max_score = int(MAX_SCORE_PER_QUESTION)
    return (
        "You are a strict but fair grader reviewing a completed oral examination (viva voce).\n"
        "\n"
        "You are given (a) an assignment, (b) a list of PLANNED questions the examiner was supposed to cover, "
        "and (c) the full transcript of the live viva.\n"
        "\n"
        f"Your task: for each planned question, find the student's most relevant answer in the transcript and "
        f"score it out of {max_score}. The examiner may have asked the question verbatim, paraphrased it, "
        "asked follow-ups, or skipped it entirely — match by topic, not by literal text.\n"
        "\n"
        "Assignment that was being examined:\n" + assignment_block + "\n\n"
        "Planned questions (you MUST grade exactly these, in this order):\n" + plan_block + "\n\n"
        "CRITICAL output rules:\n"
        "- Output EXACTLY one item per planned question — no more, no less.\n"
        "- Each item's `sequence_num` MUST equal the seq= value of the corresponding planned question.\n"
        "- Each item's `question_text` MUST be the planned question text, copied verbatim.\n"
        "- If the student never answered a planned question (or said something completely off-topic), "
        "set response_text=null and score 0-3 with a justification explaining what was missing.\n"
        "- Otherwise, summarise the student's answer in `response_text` based on what they actually said in the transcript.\n"
        f"- Score each answer between 0 and {max_score} (whole or half numbers).\n"
        "- Justifications must be 1-2 sentences and reference what the student actually said (or didn't say).\n"
        "- Return ONLY a valid JSON object matching the schema below. No markdown, no prose.\n"
        "\n"
        "JSON schema:\n"
        "{\n"
        '  "items": [\n'
        "    {\n"
        '      "sequence_num": <integer matching a planned seq= value>,\n'
        '      "question_text": "<the planned question text, verbatim>",\n'
        '      "response_text": "<paraphrased student answer, or null if none>",\n'
        f'      "score": <number between 0 and {max_score}>,\n'
        '      "score_justification": "<1-2 sentence reason>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "\n"
        "Transcript:\n"
        "---\n" + transcript + "\n---\n"
    )


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
    planned_questions: list[dict] | None = None,
) -> dict:
    """Grade a completed viva. Returns {"items": [...], "total_score": float, "max_possible": float}.

    `turns` is a list of {turn_number, role, content} dicts accumulated by the
    live bridge. Empty transcripts yield zero items — the caller should handle
    that case gracefully.

    `planned_questions` is the list of questions selected for the session
    (with their `sequence_num`, `competency_name`, and `difficulty`). When
    provided, the grader is constrained to produce exactly one item per
    planned question with matching `sequence_num`, so callers can map items
    back to their competency by sequence number reliably.
    """
    if not turns:
        return {"items": [], "total_score": 0.0, "max_possible": 0.0}

    transcript = _format_transcript_for_prompt(turns)
    if not transcript.strip():
        return {"items": [], "total_score": 0.0, "max_possible": 0.0}

    from google import genai

    client = genai.Client(api_key=gemini_api_key)

    if planned_questions:
        prompt = _build_plan_aware_grading_prompt(
            planned_questions=planned_questions,
            transcript=transcript,
            assignment_block=_format_assignment_block(assignment_context),
        )
    else:
        prompt = _build_grading_prompt(
            transcript=transcript,
            assignment_block=_format_assignment_block(assignment_context),
        )

    logger.info(
        "grader_calling",
        model=grader_model,
        turn_count=len(turns),
        planned=len(planned_questions or []),
    )

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

    def _coerce_item(item: Any, fallback_seq: int, fallback_q: str | None = None) -> dict | None:
        if not isinstance(item, dict):
            return None
        q = str(item.get("question_text") or "").strip() or (fallback_q or "")
        if not q:
            return None
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
        item_max = item.get("max_score")
        try:
            item_max = float(item_max) if item_max is not None else MAX_SCORE_PER_QUESTION
        except (TypeError, ValueError):
            item_max = MAX_SCORE_PER_QUESTION
        seq_raw = item.get("sequence_num")
        try:
            seq = int(seq_raw) if seq_raw is not None else fallback_seq
        except (TypeError, ValueError):
            seq = fallback_seq
        return {
            "sequence_num": seq,
            "question_text": q,
            "response_text": resp,
            "score": score,
            "max_score": item_max,
            "score_justification": justification,
        }

    cleaned: list[dict] = []
    if planned_questions:
        # Plan-aware mode: index model output by sequence_num and emit one
        # entry per planned question, in plan order. Missing questions are
        # filled in with a low default so the per-competency mapping always
        # has a row to attribute.
        by_seq: dict[int, dict] = {}
        for item in raw_items:
            coerced = _coerce_item(item, fallback_seq=-1)
            if coerced is None or coerced["sequence_num"] < 0:
                continue
            by_seq[coerced["sequence_num"]] = coerced

        for q in planned_questions:
            seq = int(q["sequence_num"])
            entry = by_seq.get(seq)
            if entry is None:
                # Fallback: the model didn't return this question. Insert a
                # zero-score placeholder so the competency stays accounted for.
                cleaned.append(
                    {
                        "sequence_num": seq,
                        "question_text": q.get("question_text", ""),
                        "response_text": None,
                        "score": 0.0,
                        "max_score": float(q.get("max_score") or MAX_SCORE_PER_QUESTION),
                        "score_justification": "Grader could not locate an answer for this question in the transcript.",
                    }
                )
            else:
                # Always force the planned question text + sequence_num + max_score through.
                # The model doesn't return max_score in its JSON, so _coerce_item
                # defaults it to MAX_SCORE_PER_QUESTION. Override with the planned
                # value so per-question maxes match the competency definition.
                entry["question_text"] = q.get("question_text") or entry["question_text"]
                entry["sequence_num"] = seq
                entry["max_score"] = float(q.get("max_score") or MAX_SCORE_PER_QUESTION)
                cleaned.append(entry)
    else:
        # Free-form mode: enumerate items in order.
        for idx, item in enumerate(raw_items, start=1):
            coerced = _coerce_item(item, fallback_seq=idx)
            if coerced is None:
                continue
            coerced["sequence_num"] = idx
            cleaned.append(coerced)

    total = sum(item["score"] for item in cleaned)
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
