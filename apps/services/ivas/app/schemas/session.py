"""Pydantic schemas for viva sessions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.voice import VoiceAuthEventOut


class SessionCreate(BaseModel):
    assignment_id: UUID
    student_id: str
    assignment_context: dict | None = None
    # Difficulty distribution: e.g. {1: 3, 2: 3, 3: 2} → 3 beginner, 3 intermediate, 2 advanced questions
    difficulty_distribution: dict[int, int] | None = None

    @field_validator("difficulty_distribution")
    @classmethod
    def validate_difficulty_distribution(cls, v: dict[int, int] | None) -> dict[int, int] | None:
        """Validate that difficulty distribution values are non-negative integers."""
        if v is None:
            return v
        for level, count in v.items():
            if not isinstance(level, int) or level < 1 or level > 5:
                raise ValueError(f"Invalid difficulty level {level}. Must be 1-5.")
            if not isinstance(count, int) or count < 0:
                raise ValueError(
                    f"Invalid question count {count} for level {level}. Must be non-negative integer."
                )
        return v


class SessionOut(BaseModel):
    id: UUID
    assignment_id: UUID
    assignment_context: dict = {}
    student_id: str
    status: str
    total_score: float | None = None
    max_possible: float | None = None
    started_at: datetime
    completed_at: datetime | None = None
    difficulty_distribution: dict[int, int] | None = None
    metadata: dict = {}

    @field_validator("difficulty_distribution", mode="before")
    @classmethod
    def _coerce_string_keys(cls, v: dict[int, int] | None) -> dict[int, int] | None:
        """Coerce string keys from JSONB to integers."""
        if v is None:
            return v
        return {int(k): int(val) for k, val in v.items()}


class TranscriptOut(BaseModel):
    id: UUID
    session_id: UUID
    turn_number: int
    role: str  # "examiner" | "student"
    content: str
    timestamp: datetime


class QuestionInstanceOut(BaseModel):
    id: UUID
    session_id: UUID
    question_text: str
    competency: str | None = None
    difficulty: int | None = None
    sequence_num: int
    asked_at: datetime


class StudentResponseOut(BaseModel):
    id: UUID
    question_instance_id: UUID
    session_id: UUID
    response_text: str | None = None
    score: float | None = None
    score_justification: str | None = None
    feedback_text: str | None = None
    responded_at: datetime


class GradedQAOut(BaseModel):
    """Paired question + response (what the instructor actually wants to see)."""

    sequence_num: int
    question_text: str
    response_text: str | None = None
    score: float | None = None
    max_score: float | None = None
    score_justification: str | None = None


class SessionDetailOut(BaseModel):
    session: SessionOut
    transcripts: list[TranscriptOut] = []
    graded_qa: list[GradedQAOut] = []
    voice_auth_events: list[VoiceAuthEventOut] = []
