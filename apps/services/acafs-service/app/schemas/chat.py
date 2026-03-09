"""Chat session and message schema definitions."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

ChatRole = Literal["user", "assistant"]
SessionStatus = Literal["active", "closed"]


class ChatMessageModel(BaseModel):
    """A single turn in a Socratic chat session."""

    id: int | None = None
    session_id: UUID
    role: ChatRole
    content: str
    reasoning_details: Any | None = None
    created_at: datetime | None = None


class ChatSessionModel(BaseModel):
    """A Socratic chat session scoped to one student + assignment."""

    id: UUID
    assignment_id: UUID
    user_id: str
    status: SessionStatus = "active"
    messages: list[ChatMessageModel] = Field(default_factory=list)
    created_at: datetime | None = None
    closed_at: datetime | None = None
    closed_reason: str | None = None  # "submission" | "manual"


# ── API request / response models ────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Payload for sending a message to the Socratic tutor."""

    content: str = Field(..., min_length=1, max_length=4000)
    # Optional assignment context forwarded by the frontend
    assignment_title: str | None = None
    assignment_description: str | None = None
    rubric_skills: list[str] | None = None  # skill names only, no scores
    answer_concepts: list[str] | None = None  # key concepts to guide toward
    student_code: str | None = None  # latest editor snapshot
    ast_context: dict[str, Any] | None = None  # compact AST snapshot


class ChatMessageResponse(BaseModel):
    """A single message returned from the API."""

    id: int | None = None
    role: ChatRole
    content: str
    created_at: datetime | None = None


class ChatResponse(BaseModel):
    """Response returned after sending a chat message."""

    session_id: UUID
    assignment_id: UUID
    user_id: str
    status: SessionStatus
    reply: str
    messages: list[ChatMessageResponse] = Field(default_factory=list)


class ChatHistoryResponse(BaseModel):
    """Full chat session history returned for analytics or UI restore."""

    session_id: UUID
    assignment_id: UUID
    user_id: str
    status: SessionStatus
    created_at: datetime | None = None
    closed_at: datetime | None = None
    closed_reason: str | None = None
    messages: list[ChatMessageResponse] = Field(default_factory=list)
