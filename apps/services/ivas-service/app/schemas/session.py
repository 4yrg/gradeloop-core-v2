"""Pydantic schemas for viva sessions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    assignment_id: UUID
    student_id: str


class SessionOut(BaseModel):
    id: UUID
    assignment_id: UUID
    student_id: str
    status: str
    total_score: float | None = None
    max_possible: float | None = None
    started_at: datetime
    completed_at: datetime | None = None
    metadata: dict = {}
