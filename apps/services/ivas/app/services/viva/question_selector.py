"""Difficulty-aware question selector for viva sessions.

Given an assignment's competency pool and a difficulty distribution
(e.g. {1: 3, 2: 3, 3: 2} meaning 3 Beginner, 3 Intermediate, 2 Advanced
questions), this module selects questions that cover the configured
competencies at the requested difficulty levels.

Question selection is done via an AI model so that each question is
contextually relevant to the specific assignment and competency.
"""

from __future__ import annotations

import json
import random
import re
from uuid import UUID

from app.logging_config import get_logger

logger = get_logger(__name__)

# Difficulty labels matching the DB schema
DIFFICULTY_LABELS = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert",
    5: "Master",
}


def _reverse_labels() -> dict[str, int]:
    return {v.lower(): k for k, v in DIFFICULTY_LABELS.items()}


async def select_questions_ai(
    *,
    gemini_api_key: str,
    model: str,
    assignment_context: dict,
    competencies: list[dict],
    difficulty_distribution: dict[int, int],
) -> list[dict]:
    """Select questions from the competency pool using AI.

    Args:
        gemini_api_key: Gemini API key.
        model: Gemini model name for question generation.
        assignment_context: Dict with title, code, description of the assignment.
        competencies: List of competency dicts with keys: id, name, description,
            difficulty (1-5), weight.
        difficulty_distribution: Map from difficulty level (1-5) to number of
            questions to select from that level, e.g. {1: 3, 2: 3, 3: 2}.

    Returns:
        A list of question dicts, each with keys:
            question_text, competency_id, competency_name, difficulty,
            sequence_num (1-based), max_score (10.0).
        Returns an empty list on any failure.
    """
    total_questions = sum(difficulty_distribution.values())
    if total_questions == 0:
        return []

    # Group competencies by difficulty level
    by_difficulty: dict[int, list[dict]] = {level: [] for level in range(1, 6)}
    for comp in competencies:
        level = int(comp.get("difficulty", 2))
        level = max(1, min(5, level))
        by_difficulty[level].append(comp)

    # Build a structured description of the pool for the prompt
    pool_lines = []
    for level, comps in by_difficulty.items():
        if comps:
            label = DIFFICULTY_LABELS.get(level, str(level))
            names = ", ".join(c["name"] for c in comps)
            pool_lines.append(f"  [{label}] {names}")

    pool_description = "\n".join(pool_lines) if pool_lines else "(no competencies)"

    # Build per-level question requests
    level_requests = []
    for level, count in sorted(difficulty_distribution.items()):
        if count <= 0:
            continue
        label = DIFFICULTY_LABELS.get(level, str(level))
        level_comps = by_difficulty.get(level, [])
        if level_comps:
            comp_names = ", ".join(c["name"] for c in level_comps)
        else:
            comp_names = "(any topic at this level)"
        level_requests.append(
            f'  {count} {label} question(s) — focus on: {comp_names}'
        )

    questions_per_level = "\n".join(level_requests)

    # Assignment block
    ctx = assignment_context or {}
    assignment_block_parts = []
    for key, label in [
        ("title", "Title"),
        ("code", "Code"),
        ("programming_language", "Language"),
        ("description", "Description"),
    ]:
        val = (ctx.get(key) or "").strip() if isinstance(ctx.get(key), str) else ""
        if val:
            assignment_block_parts.append(f"- {label}: {val[:500]}")
    assignment_block = "\n".join(assignment_block_parts) or "(no assignment context)"

    prompt = f"""You are an oral examination (viva voce) question writer.

Given the assignment and competency pool below, generate exactly {total_questions} viva questions.
Generate exactly the number of questions specified for each difficulty level below.

Rules:
- Questions must be open-ended conceptual questions suitable for a live spoken viva.
- They must test understanding (not just recall) — push the student to explain, justify, compare, or trace.
- Do NOT ask about syntax errors, typos, or trivial details.
- Assign each question to ONE competency from the pool that best fits it.
- Return ONLY a valid JSON object. No markdown, no prose.

JSON schema:
{{
  "questions": [
    {{
      "question_text": "<the exact question to ask>",
      "competency_name": "<name of the matching competency from the pool>",
      "difficulty": <1-5>
    }}
  ]
}}

Assignment:
{assignment_block}

Competency pool (course-wide conceptual areas for this assignment):
{pool_description}

Question requirements (exactly follow this distribution):
{questions_per_level}
"""

    logger.info(
        "question_selector_calling",
        model=model,
        total=total_questions,
        distribution=difficulty_distribution,
    )

    try:
        from google import genai

        client = genai.Client(api_key=gemini_api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
        )
    except Exception as exc:
        logger.error("question_selector_failed", error=str(exc))
        return []

    raw_text = getattr(response, "text", None) or ""
    parsed = _extract_json(raw_text)

    if not parsed or not isinstance(parsed, dict):
        logger.warning("question_selector_parse_failed", raw=raw_text[:500])
        return []

    raw_questions: list = parsed.get("questions") or []
    if len(raw_questions) != total_questions:
        logger.warning(
            "question_selector_count_mismatch",
            expected=total_questions,
            got=len(raw_questions),
        )

    # Build a lookup from competency name -> competency id
    # The competency rows may use either "id" or "competency_id" as the key
    # depending on whether they come from list_competencies() or list_assignment_competencies().
    def _comp_id(c: dict) -> str | None:
        return c.get("competency_id") or c.get("id")

    comp_by_name: dict[str, dict] = {c["name"]: c for c in competencies}
    # Also try lowercase for flexibility
    comp_by_name.update({k.lower(): v for k, v in comp_by_name.items()})

    results: list[dict] = []
    for idx, item in enumerate(raw_questions, start=1):
        if not isinstance(item, dict):
            continue
        question_text = str(item.get("question_text") or "").strip()
        if not question_text:
            continue

        comp_name = str(item.get("competency_name") or "").strip()
        comp = comp_by_name.get(comp_name) or comp_by_name.get(comp_name.lower())

        difficulty_val = item.get("difficulty")
        try:
            difficulty = int(difficulty_val) if difficulty_val is not None else 2
        except (TypeError, ValueError):
            difficulty = 2
        difficulty = max(1, min(5, difficulty))

        results.append({
            "question_text": question_text,
            "competency_id": _comp_id(comp) if comp else None,
            "competency_name": comp["name"] if comp else comp_name,
            "difficulty": difficulty,
            "sequence_num": idx,
            "max_score": 10.0,
        })

    logger.info("question_selector_done", count=len(results))
    return results


def select_questions_random(
    competencies: list[dict],
    difficulty_distribution: dict[int, int],
) -> list[dict]:
    """Fallback: randomly select questions from the competency pool.

    Used when AI generation is unavailable. Questions are selected
    uniformly at random from each difficulty bucket.

    Returns a list of question dicts (question_text is empty — caller
    must populate it from the competency's description).
    """
    total = sum(difficulty_distribution.values())
    if total == 0:
        return []

    # Group by difficulty
    by_difficulty: dict[int, list[dict]] = {level: [] for level in range(1, 6)}
    for comp in competencies:
        level = int(comp.get("difficulty", 2))
        level = max(1, min(5, level))
        by_difficulty[level].append(comp)

    questions: list[dict] = []
    seq = 1
    for level, count in sorted(difficulty_distribution.items()):
        pool = by_difficulty.get(level, [])
        # Shuffle and pick count (if pool is smaller than count, returns all available)
        shuffled = random.sample(pool, k=min(count, len(pool)))
        for comp in shuffled:
            questions.append({
                "question_text": "",  # Caller must fill in
                "competency_id": comp["id"],
                "competency_name": comp["name"],
                "difficulty": level,
                "sequence_num": seq,
                "max_score": 10.0,
            })
            seq += 1

    return questions


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict | None:
    """Extract JSON from model response."""
    if not text:
        return None
    text = text.strip()

    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None
