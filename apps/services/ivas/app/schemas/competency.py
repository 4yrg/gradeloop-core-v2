"""Pydantic schemas for competency management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CompetencyOut(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    difficulty: int = Field(ge=1, le=5)
    max_score: float
    created_at: datetime
    updated_at: datetime


class CompetencyAssignmentLinkOut(BaseModel):
    link_id: UUID
    competency_id: UUID
    name: str
    description: str | None = None
    difficulty: int
    max_score: float
    weight: float


class CompetencyScoreOut(BaseModel):
    id: UUID
    student_id: str
    competency_id: UUID
    competency_name: str | None = None
    difficulty: int | None = None
    max_score: float | None = None
    session_id: UUID | None = None
    score: float | None = None
    is_override: bool = False
    override_by: str | None = None
    override_at: datetime | None = None
    created_at: datetime


class CompetencyScoreSummary(BaseModel):
    """Aggregated score per student per competency."""
    student_id: str
    competency_id: UUID
    competency_name: str
    difficulty: int
    max_score: float
    avg_score: float | None
    session_count: int
    has_override: bool


class SetCompetenciesRequest(BaseModel):
    """Request body to set competencies for an assignment."""
    competencies: list["CompetencyEntry"] = []


class CompetencyEntry(BaseModel):
    competency_id: UUID
    weight: float = 1.0


class GenerateCompetenciesRequest(BaseModel):
    assignment_id: UUID
    code_context: str | None = None
    description: str | None = None
    title: str | None = None


class GenerateCompetenciesResponse(BaseModel):
    competencies: list["GeneratedCompetency"]


class GeneratedCompetency(BaseModel):
    name: str
    description: str
    difficulty: int = Field(ge=1, le=5)
    max_score: float = 10.0
    weight: float = 1.0


class CreateCompetencyRequest(BaseModel):
    """Request body for creating a new competency."""
    name: str
    description: str | None = None
    difficulty: int = Field(default=1, ge=1, le=5)
    max_score: float = 10.0


class OverrideScoreRequest(BaseModel):
    student_id: str
    competency_id: UUID
    new_score: float = Field(ge=0)
    override_by: str  # instructor user id/name
