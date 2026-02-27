"""Schema definitions for rubric-based scoring."""

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ExecutionConfig(BaseModel):
    """Deterministic execution scoring configuration."""

    weight: int = Field(default=30, ge=0, le=100)
    fixed: bool = Field(default=True)
    test_cases: list[str] = Field(default_factory=list)


class RubricDimension(BaseModel):
    """Individual semantic evaluation dimension."""

    id: str
    name: str
    weight: int = Field(ge=0, le=100)
    description: str


class RubricConfig(BaseModel):
    """Complete rubric configuration for an assignment."""

    execution: ExecutionConfig
    dimensions: list[RubricDimension]

    @field_validator("dimensions")
    @classmethod
    def validate_dimensions(cls, v: list[RubricDimension]) -> list[RubricDimension]:
        """Ensure dimension IDs are unique."""
        seen_ids = set()
        for dim in v:
            if dim.id in seen_ids:
                raise ValueError(f"duplicate dimension ID: {dim.id}")
            seen_ids.add(dim.id)
        return v

    def total_weight(self) -> int:
        """Calculate total weight of all dimensions plus execution."""
        total = self.execution.weight
        for dim in self.dimensions:
            total += dim.weight
        return total

    def validate_total_weight(self) -> bool:
        """Validate that total weight equals 100%."""
        return self.total_weight() == 100


class CriteriaBreakdown(BaseModel):
    """Scoring breakdown per rubric dimension."""

    execution: int = Field(default=0, ge=0, le=100)
    logical_correctness: int = Field(default=0, ge=0, le=100)
    best_practices: int = Field(default=0, ge=0, le=100)
    code_quality: int = Field(default=0, ge=0, le=100)
    conceptual_understanding: int = Field(default=0, ge=0, le=100)

    def total_score(self) -> int:
        """Calculate total score from all dimensions."""
        return (
            self.execution
            + self.logical_correctness
            + self.best_practices
            + self.code_quality
            + self.conceptual_understanding
        )


class InstructorOverride(BaseModel):
    """Manual score adjustment by an instructor."""

    adjusted_score: int = Field(ge=0, le=100)
    reason: str
    overridden_by: str
    overridden_at: str
    original_score: int = Field(ge=0, le=100)


class ScoreResult(BaseModel):
    """Final scoring output for a submission."""

    submission_id: str
    assignment_id: str
    criteria_breakdown: CriteriaBreakdown
    total_score: int = Field(ge=0, le=100)
    rubric_version_id: int
    instructor_override: Optional[InstructorOverride] = None
    evaluated_at: str


class RubricScoringInput(BaseModel):
    """Input data for the rubric scoring engine."""

    submission_id: str
    assignment_id: str
    code: str
    language: str
    ast_blueprint: dict[str, Any]
    rubric_config: RubricConfig
    test_results: Optional[list[dict[str, Any]]] = None
    execution_status: Optional[str] = None
    compile_output: Optional[str] = None


class SemanticScoreRequest(BaseModel):
    """Request for LLM-based semantic scoring."""

    dimension_id: str
    dimension_name: str
    description: str
    weight: int
    code: str
    ast_blueprint: dict[str, Any]
    language: str


class SemanticScoreResponse(BaseModel):
    """Response from LLM-based semantic scoring."""

    dimension_id: str
    score: int = Field(ge=0, le=100)
    reasoning: str
    suggestions: list[str] = Field(default_factory=list)


class LLMScoringResult(BaseModel):
    """Complete result from LLM semantic scoring."""

    logical_correctness: SemanticScoreResponse
    best_practices: SemanticScoreResponse
    code_quality: SemanticScoreResponse
    conceptual_understanding: SemanticScoreResponse
    overall_feedback: str


# Default ACAFS Blueprint rubric configuration
DEFAULT_RUBRIC_CONFIG = RubricConfig(
    execution=ExecutionConfig(weight=30, fixed=True, test_cases=[]),
    dimensions=[
        RubricDimension(
            id="logical_correctness",
            name="Logical Correctness",
            weight=25,
            description="Algorithmic accuracy and logical flow of the solution",
        ),
        RubricDimension(
            id="best_practices",
            name="Best Practices",
            weight=20,
            description="Bounds checking, initialization, error handling, and defensive programming",
        ),
        RubricDimension(
            id="code_quality",
            name="Code Quality",
            weight=15,
            description="Readability, modularity, naming conventions, and code organization",
        ),
        RubricDimension(
            id="conceptual_understanding",
            name="Conceptual Understanding",
            weight=10,
            description="Appropriate use of programming paradigms (recursion vs iteration, etc.)",
        ),
    ],
)

# Valid dimension IDs for validation
VALID_DIMENSION_IDS = {
    "logical_correctness",
    "best_practices",
    "code_quality",
    "conceptual_understanding",
}


def is_valid_dimension_id(dimension_id: str) -> bool:
    """Check if a dimension ID is valid."""
    return dimension_id in VALID_DIMENSION_IDS


def get_default_criteria_breakdown(execution_score: int = 0) -> CriteriaBreakdown:
    """Create a default criteria breakdown with the given execution score."""
    return CriteriaBreakdown(execution=execution_score)
