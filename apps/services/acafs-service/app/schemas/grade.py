"""Grade and feedback schema definitions."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CriterionScore(BaseModel):
    """Score and justification for a single rubric criterion."""

    name: str
    score: float
    max_score: float
    grading_mode: str  # deterministic | llm | llm_ast
    reason: str  # instructor-facing technical justification
    band_selected: str | None = None  # excellent | good | satisfactory | unsatisfactory
    confidence: float | None = None  # 0.0–1.0 grading certainty
    # Instructor override — stored alongside original AI score; never overwrites it
    instructor_override_score: float | None = None
    instructor_override_reason: str | None = None


class SubmissionGrade(BaseModel):
    """Complete grading result for a submission."""

    submission_id: UUID
    assignment_id: UUID
    total_score: float
    max_total_score: float
    criteria_scores: list[CriterionScore] = Field(default_factory=list)
    holistic_feedback: str
    graded_at: datetime = Field(default_factory=datetime.utcnow)
    grading_metadata: dict[str, Any] | None = None
    # Instructor override fields
    instructor_override_score: float | None = None
    instructor_holistic_feedback: str | None = None
    override_by: str | None = None
    overridden_at: datetime | None = None


class GradeOverrideRequest(BaseModel):
    """Payload for the instructor grade-override endpoint (PUT /grades/{id}/override).

    All fields are optional so instructors can override only what they need.
    The original ACAFS-generated scores are never mutated — overrides are stored
    in separate columns so the AI output is always preserved for audit.
    """

    # Per-criterion overrides: [{criterion_name, override_score, override_reason}]
    criteria_overrides: list[dict[str, Any]] | None = None
    instructor_holistic_feedback: str | None = None
    override_by: str  # instructor user_id or display name
