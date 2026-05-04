"""Schema definitions for ACAFS Service."""

from .chat import (
    ChatHistoryResponse,
    ChatMessageModel,
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionModel,
)
from .evaluation_request import (
    EvaluationRequest,
    EvaluationResponse,
    RubricCriterionInput,
    TestCaseInput,
)
from .grade import CriterionScore, GradeOverrideRequest, SubmissionGrade
from .submission_event import (
    ASTBlueprint,
    ASTMetadata,
    GradingMode,
    RubricBand,
    RubricCriterion,
    SubmissionEvent,
    TestCaseResult,
)

__all__ = [
    # submission event
    "ASTBlueprint",
    "ASTMetadata",
    "GradingMode",
    "RubricBand",
    "RubricCriterion",
    "SubmissionEvent",
    "TestCaseResult",
    # evaluation request
    "EvaluationRequest",
    "EvaluationResponse",
    "RubricCriterionInput",
    "TestCaseInput",
    # grade
    "CriterionScore",
    "GradeOverrideRequest",
    "SubmissionGrade",
    # chat
    "ChatMessageModel",
    "ChatSessionModel",
    "ChatRequest",
    "ChatResponse",
    "ChatHistoryResponse",
    "ChatMessageResponse",
]
