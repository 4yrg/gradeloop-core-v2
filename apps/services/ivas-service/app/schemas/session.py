"""Pydantic schemas for viva sessions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    assignment_id: UUID
    student_id: str
    assignment_context: dict | None = None


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
    metadata: dict = {}


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
