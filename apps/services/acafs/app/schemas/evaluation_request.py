"""Schema definitions for evaluation requests."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TestCaseInput(BaseModel):
    """Test case input for evaluation."""

    id: str
    input: str
    expected_output: str


class RubricCriterionInput(BaseModel):
    """Rubric criterion input for evaluation."""

    name: str
    description: str | None = None
    grading_mode: str = Field(..., pattern="^(deterministic|llm|llm_ast)$")
    weight: float


class EvaluationRequest(BaseModel):
    """Evaluation request from API."""

    submission_id: UUID
    assignment_id: UUID
    code: str
    language: str
    language_id: int
    user_id: str
    username: str
    ip_address: str = "0.0.0.0"
    user_agent: str = "API"

    # Optional evaluation context
    assessment_type: str | None = None
    assignment_title: str | None = None
    assignment_description: str | None = None
    objective: str | None = None

    # Rubric (optional)
    rubric: list[RubricCriterionInput] | None = None

    # Test cases (optional)
    test_cases: list[TestCaseInput] | None = None

    # Sample answer (optional)
    sample_answer: dict[str, Any] | None = None


class EvaluationResponse(BaseModel):
    """Evaluation response."""

    status: str
    message: str
    submission_id: UUID
    enqueued_at: datetime