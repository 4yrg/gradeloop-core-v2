"""IVAS Service schemas."""

from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentDetailOut,
    AssignmentOut,
    AssignmentUpdate,
    GradingCriteriaCreate,
    GradingCriteriaOut,
    GradingCriteriaUpdate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
)
from app.schemas.session import SessionCreate, SessionOut
from app.schemas.voice import (
    VoiceEnrollmentOut,
    VoiceEnrollmentRequest,
    VoiceProfileOut,
    VoiceProfileStatus,
    VoiceVerifyOut,
    VoiceVerifyRequest,
)

__all__ = [
    "AssignmentCreate",
    "AssignmentDetailOut",
    "AssignmentOut",
    "AssignmentUpdate",
    "GradingCriteriaCreate",
    "GradingCriteriaOut",
    "GradingCriteriaUpdate",
    "QuestionCreate",
    "QuestionOut",
    "QuestionUpdate",
    "SessionCreate",
    "SessionOut",
    "VoiceEnrollmentOut",
    "VoiceEnrollmentRequest",
    "VoiceProfileOut",
    "VoiceProfileStatus",
    "VoiceVerifyOut",
    "VoiceVerifyRequest",
]
