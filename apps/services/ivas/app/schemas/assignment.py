"""Pydantic schemas for assignments, grading criteria, and questions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# =============================================================================
# Assignment
# =============================================================================


class AssignmentCreate(BaseModel):
    title: str
    description: str | None = None
    code_context: str | None = None
    programming_language: str = "python"
    course_id: str | None = None
    instructor_id: str


class AssignmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    code_context: str | None = None
    programming_language: str | None = None
    course_id: str | None = None


class AssignmentOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    code_context: str | None = None
    programming_language: str
    course_id: str | None = None
    instructor_id: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Grading Criteria
# =============================================================================


class GradingCriteriaCreate(BaseModel):
    competency: str
    description: str | None = None
    max_score: float = 10.0
    weight: float = 1.0
    difficulty: int = Field(default=3, ge=1, le=5)


class GradingCriteriaUpdate(BaseModel):
    competency: str | None = None
    description: str | None = None
    max_score: float | None = None
    weight: float | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)


class GradingCriteriaOut(BaseModel):
    id: UUID
    assignment_id: UUID
    competency: str
    description: str | None = None
    max_score: float
    weight: float
    difficulty: int
    created_at: datetime


# =============================================================================
# Question
# =============================================================================


class QuestionCreate(BaseModel):
    criteria_id: UUID | None = None
    question_text: str
    competency: str | None = None
    difficulty: int = Field(default=3, ge=1, le=5)
    expected_topics: list[str] | None = None


class QuestionUpdate(BaseModel):
    criteria_id: UUID | None = None
    question_text: str | None = None
    competency: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    expected_topics: list[str] | None = None
    status: str | None = Field(default=None, pattern="^(draft|approved|rejected)$")


class QuestionOut(BaseModel):
    id: UUID
    assignment_id: UUID
    criteria_id: UUID | None = None
    question_text: str
    competency: str | None = None
    difficulty: int
    expected_topics: list[str] | None = None
    status: str
    created_at: datetime


# =============================================================================
# Assignment with nested details
# =============================================================================


class AssignmentDetailOut(AssignmentOut):
    criteria: list[GradingCriteriaOut] = []
    questions: list[QuestionOut] = []
