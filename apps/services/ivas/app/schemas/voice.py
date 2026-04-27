"""Pydantic schemas for voice enrollment and verification."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# =============================================================================
# Voice Profile
# =============================================================================


class VoiceEnrollmentRequest(BaseModel):
    student_id: str
    sample_index: int = Field(ge=1, le=5, description="Which sample number (1-5)")


class VoiceEnrollmentOut(BaseModel):
    student_id: str
    samples_count: int
    required_samples: int
    is_complete: bool
    message: str


class VoiceProfileOut(BaseModel):
    id: UUID
    student_id: str
    samples_count: int
    enrolled_at: datetime
    updated_at: datetime


class VoiceProfileStatus(BaseModel):
    student_id: str
    enrolled: bool
    samples_count: int = 0
    required_samples: int
    is_complete: bool = False


# =============================================================================
# Voice Verification
# =============================================================================


class VoiceVerifyRequest(BaseModel):
    student_id: str


class VoiceVerifyOut(BaseModel):
    student_id: str
    similarity_score: float
    is_match: bool
    confidence: str = Field(pattern="^(high|medium|low)$")
    threshold: float


# =============================================================================
# Voice Auth Events (per-answer verification during viva)
# =============================================================================


class VoiceAuthEventOut(BaseModel):
    id: UUID
    session_id: UUID
    question_instance_id: UUID | None = None
    similarity_score: float | None = None
    is_match: bool | None = None
    confidence: str | None = None
    audio_ref: str | None = None
    checked_at: datetime
