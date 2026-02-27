"""Rubric-based scoring engine for ACAFS."""

from datetime import datetime
from typing import Any, Optional

from app.logging_config import get_logger
from app.schemas.rubric import (
    CriteriaBreakdown,
    ExecutionConfig,
    RubricConfig,
    RubricDimension,
    RubricScoringInput,
    ScoreResult,
    get_default_criteria_breakdown,
)

logger = get_logger(__name__)


class RubricEngine:
    """Engine for calculating multi-dimensional rubric scores."""

    def __init__(self):
        """Initialize the rubric engine."""
        self.logger = get_logger(__name__)

    def score_submission(
        self,
        input_data: RubricScoringInput,
        semantic_scores: Optional[dict[str, int]] = None,
    ) -> ScoreResult:
        """Calculate complete rubric-based score for a submission.

        Args:
            input_data: Scoring input including code, AST, and rubric config
            semantic_scores: Optional pre-computed semantic scores from LLM

        Returns:
            Complete score result with criteria breakdown
        """
        self.logger.info(
            "scoring_submission",
            submission_id=input_data.submission_id,
            assignment_id=input_data.assignment_id,
        )

        # 1. Calculate execution score (deterministic)
        execution_score = self._calculate_execution_score(
            input_data.rubric_config.execution,
            input_data.test_results,
            input_data.execution_status,
        )

        # 2. Calculate semantic scores (from LLM or default)
        if semantic_scores:
            semantic_breakdown = self._apply_semantic_scores(
                semantic_scores, input_data.rubric_config.dimensions
            )
        else:
            # Default: all semantic dimensions score 0
            semantic_breakdown = self._get_default_semantic_breakdown(
                input_data.rubric_config.dimensions
            )

        # 3. Apply partial credit logic
        # If execution failed but code shows correct algorithmic intent,
        # logical_correctness can still score up to 100% of its weight
        if execution_score == 0 and semantic_breakdown.logical_correctness > 0:
            self.logger.info(
                "applying_partial_credit",
                submission_id=input_data.submission_id,
                logical_score=semantic_breakdown.logical_correctness,
            )

        # 4. Build criteria breakdown with weighted scores
        breakdown = CriteriaBreakdown(
            execution=execution_score,
            logical_correctness=semantic_breakdown.logical_correctness,
            best_practices=semantic_breakdown.best_practices,
            code_quality=semantic_breakdown.code_quality,
            conceptual_understanding=semantic_breakdown.conceptual_understanding,
        )

        # 5. Calculate total score
        total_score = breakdown.total_score()

        # 6. Validate and normalize if needed
        if total_score > 100:
            self.logger.warning(
                "score_exceeds_maximum",
                submission_id=input_data.submission_id,
                total_score=total_score,
            )
            # Normalize proportionally
            breakdown = self._normalize_breakdown(breakdown, total_score)
            total_score = 100

        result = ScoreResult(
            submission_id=input_data.submission_id,
            assignment_id=input_data.assignment_id,
            criteria_breakdown=breakdown,
            total_score=total_score,
            rubric_version_id=1,  # TODO: Get from assignment
            evaluated_at=datetime.utcnow().isoformat(),
        )

        self.logger.info(
            "submission_scored",
            submission_id=input_data.submission_id,
            total_score=total_score,
            execution=breakdown.execution,
            logical_correctness=breakdown.logical_correctness,
        )

        return result

    def _calculate_execution_score(
        self,
        execution_config: ExecutionConfig,
        test_results: Optional[list[dict[str, Any]]],
        execution_status: Optional[str],
    ) -> int:
        """Calculate execution score based on test results.

        Args:
            execution_config: Execution scoring configuration
            test_results: List of test case results
            execution_status: Overall execution status

        Returns:
            Execution score (0 to execution_config.weight)
        """
        weight = execution_config.weight

        # If compilation failed, execution score is 0
        if execution_status in ["compilation_error", "CE", "error"]:
            self.logger.debug("compilation_error_detected", status=execution_status)
            return 0

        # If no test results, return 0
        if not test_results:
            return 0

        # Count passed tests
        passed = sum(1 for r in test_results if r.get("passed", False))
        total = len(test_results)

        if total == 0:
            return 0

        if passed >= total:
            return weight

        # Proportional score
        score = (passed * weight) // total
        return score

    def _apply_semantic_scores(
        self,
        semantic_scores: dict[str, int],
        dimensions: list[RubricDimension],
    ) -> CriteriaBreakdown:
        """Apply semantic scores weighted by dimension weights.

        Args:
            semantic_scores: Raw scores from LLM (0-100 per dimension)
            dimensions: Rubric dimension configurations

        Returns:
            Weighted criteria breakdown
        """
        # Map dimension IDs to their weights
        dimension_weights = {dim.id: dim.weight for dim in dimensions}

        # Calculate weighted scores
        logical_score = self._calculate_weighted_score(
            semantic_scores.get("logical_correctness", 0),
            dimension_weights.get("logical_correctness", 25),
        )
        best_practices_score = self._calculate_weighted_score(
            semantic_scores.get("best_practices", 0),
            dimension_weights.get("best_practices", 20),
        )
        code_quality_score = self._calculate_weighted_score(
            semantic_scores.get("code_quality", 0),
            dimension_weights.get("code_quality", 15),
        )
        conceptual_score = self._calculate_weighted_score(
            semantic_scores.get("conceptual_understanding", 0),
            dimension_weights.get("conceptual_understanding", 10),
        )

        return CriteriaBreakdown(
            execution=0,  # Set separately
            logical_correctness=logical_score,
            best_practices=best_practices_score,
            code_quality=code_quality_score,
            conceptual_understanding=conceptual_score,
        )

    def _calculate_weighted_score(self, raw_score: int, weight: int) -> int:
        """Convert a raw 0-100 score to weighted score.

        Args:
            raw_score: Raw score from LLM (0-100)
            weight: Dimension weight

        Returns:
            Weighted score
        """
        return (raw_score * weight) // 100

    def _get_default_semantic_breakdown(
        self, dimensions: list[RubricDimension]
    ) -> CriteriaBreakdown:
        """Get default semantic breakdown (all zeros).

        Args:
            dimensions: Rubric dimensions

        Returns:
            Criteria breakdown with zero semantic scores
        """
        return CriteriaBreakdown(
            execution=0,
            logical_correctness=0,
            best_practices=0,
            code_quality=0,
            conceptual_understanding=0,
        )

    def _normalize_breakdown(
        self, breakdown: CriteriaBreakdown, current_total: int
    ) -> CriteriaBreakdown:
        """Normalize breakdown to sum to 100.

        Args:
            breakdown: Current criteria breakdown
            current_total: Current total score

        Returns:
            Normalized criteria breakdown
        """
        if current_total == 0:
            return breakdown

        factor = 100 / current_total
        return CriteriaBreakdown(
            execution=int(breakdown.execution * factor),
            logical_correctness=int(breakdown.logical_correctness * factor),
            best_practices=int(breakdown.best_practices * factor),
            code_quality=int(breakdown.code_quality * factor),
            conceptual_understanding=int(breakdown.conceptual_understanding * factor),
        )

    def validate_rubric(self, rubric_config: RubricConfig) -> tuple[bool, Optional[str]]:
        """Validate a rubric configuration.

        Args:
            rubric_config: Rubric configuration to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check execution weight is fixed at 30%
        if rubric_config.execution.weight != 30:
            return False, f"execution weight must be 30%, got {rubric_config.execution.weight}%"

        if not rubric_config.execution.fixed:
            return False, "execution weight must be marked as fixed"

        # Check total weight equals 100%
        total_weight = rubric_config.total_weight()
        if total_weight != 100:
            return False, f"total weight must equal 100%, got {total_weight}%"

        # Check dimension IDs are valid
        valid_ids = {
            "logical_correctness",
            "best_practices",
            "code_quality",
            "conceptual_understanding",
        }
        for dim in rubric_config.dimensions:
            if dim.id not in valid_ids:
                return False, f"invalid dimension ID: {dim.id}"

        return True, None

    def calculate_execution_only_score(
        self,
        test_results: list[dict[str, Any]],
        execution_weight: int = 30,
    ) -> int:
        """Calculate score based only on execution (test case results).

        Args:
            test_results: List of test case results
            execution_weight: Weight for execution dimension

        Returns:
            Execution score
        """
        if not test_results:
            return 0

        passed = sum(1 for r in test_results if r.get("passed", False))
        total = len(test_results)

        if total == 0:
            return 0

        if passed >= total:
            return execution_weight

        return (passed * execution_weight) // total
