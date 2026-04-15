"""Shared utilities for the IVAS viva service.

Consolidates duplicated constants and helper functions that are used across
multiple modules (grader, question_selector, competency_generator, viva_ws).
"""

from __future__ import annotations

import json
import re

# Difficulty labels matching the DB schema (1-5 scale).
DIFFICULTY_LABELS = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert",
    5: "Master",
}


def extract_json_from_response(text: str) -> dict | None:
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