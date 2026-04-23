"""AI-powered competency generation for assignments.

Given an assignment's code context, description, and title, this module
calls Gemini to suggest relevant competencies (conceptual areas) with
difficulty levels — giving instructors a strong starting point.
"""

from __future__ import annotations

import json
import re

from app.logging_config import get_logger
from app.schemas.competency import GeneratedCompetency

logger = get_logger(__name__)

# Difficulty labels used in the prompt
DIFFICULTY_LABELS = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert",
    5: "Master",
}


def _build_generation_prompt(
    code_context: str,
    description: str,
    title: str,
) -> str:
    """Build the prompt sent to Gemini for competency generation."""
    return f"""You are a CS education expert helping design a viva voce (oral examination) rubric.

Given the assignment below, suggest 6–10 reusable conceptual competencies that a student should demonstrate when completing it. Each competency is a course-wide concept (e.g. "Loops", "Recursion", "Data Structures") NOT tied to a specific assignment.

Rules:
- Each competency should be something that can appear across multiple assignments in the same course.
- Difficulty levels: 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master.
- Suggest a realistic mix: mostly Beginner/Intermediate with some Advanced. Avoid too many high-difficulty items.
- max_score for each competency is always 10.0.
- Return ONLY a valid JSON object. Do NOT wrap it in markdown or prose.

JSON schema:
{{
  "competencies": [
    {{
      "name": "<short label, e.g. 'Loops'>",
      "description": "<1-sentence explanation of what this competency means in this context>",
      "difficulty": <1-5>,
      "max_score": 10.0
    }}
  ]
}}

Assignment title: {title or '(no title)'}
Assignment description: {description or '(no description)'}
Assignment code (first 3000 chars): {code_context[:3000] if code_context else '(no code)'}
"""


def _extract_json(text: str) -> dict | None:
    """Extract JSON from model response, handling fences and surrounding text."""
    if not text:
        return None
    text = text.strip()

    # Try fenced block first
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


async def generate_competencies_ai(
    *,
    gemini_api_key: str,
    model: str,
    code_context: str,
    description: str,
    title: str,
) -> list[GeneratedCompetency]:
    """Generate competency suggestions from an assignment.

    Calls Gemini and returns a list of GeneratedCompetency objects.
    Returns an empty list on any failure — callers handle gracefully.
    """
    prompt = _build_generation_prompt(code_context, description, title)

    logger.info("competency_gen_calling", model=model)

    try:
        from google import genai

        client = genai.Client(api_key=gemini_api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
        )
    except Exception as exc:
        logger.error("competency_gen_failed", error=str(exc))
        raise

    raw_text = getattr(response, "text", None) or ""
    parsed = _extract_json(raw_text)

    if not parsed or not isinstance(parsed, dict):
        logger.warning("competency_gen_parse_failed", raw=raw_text[:500])
        raise ValueError(f"AI model did not return valid JSON. Raw response: {raw_text[:200]}")

    raw_competencies: list = parsed.get("competencies") or []
    results: list[GeneratedCompetency] = []

    for item in raw_competencies:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        difficulty_val = item.get("difficulty")
        try:
            difficulty = int(difficulty_val) if difficulty_val is not None else 2
        except (TypeError, ValueError):
            difficulty = 2
        difficulty = max(1, min(5, difficulty))

        results.append(
            GeneratedCompetency(
                name=name,
                description=str(item.get("description") or "").strip(),
                difficulty=difficulty,
                max_score=10.0,
                weight=1.0,
            )
        )

    logger.info("competency_gen_done", count=len(results))
    return results
