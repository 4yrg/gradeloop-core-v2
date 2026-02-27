"""Feedback generator for creating structured feedback reports."""

from datetime import datetime
from typing import Any, Optional

from app.logging_config import get_logger
from app.schemas.rubric import CriteriaBreakdown, RubricConfig

logger = get_logger(__name__)


class FeedbackGenerator:
    """Generator for structured feedback reports (Feed Up/Feed Back/Feed Forward)."""

    def __init__(self):
        """Initialize the feedback generator."""
        self.logger = get_logger(__name__)

    def generate_complete_feedback(
        self,
        criteria_breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
        code: str,
        language: str,
    ) -> dict[str, Any]:
        """Generate a complete feedback report.

        Args:
            criteria_breakdown: Scoring breakdown
            rubric_config: Rubric configuration
            code: Source code
            language: Programming language

        Returns:
            Complete feedback report
        """
        return {
            "feed_up": self.generate_feed_up(criteria_breakdown, rubric_config),
            "feed_back": self.generate_feed_back(criteria_breakdown, rubric_config, code),
            "feed_forward": self.generate_feed_forward(criteria_breakdown, rubric_config),
            "summary": self.generate_summary(criteria_breakdown),
            "generated_at": datetime.utcnow().isoformat(),
        }

    def generate_feed_up(
        self,
        criteria_breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
    ) -> dict[str, Any]:
        """Generate "Feed Up" - explanation of current performance.

        This helps students understand where they stand relative to goals.

        Args:
            criteria_breakdown: Scoring breakdown
            rubric_config: Rubric configuration

        Returns:
            Feed up content
        """
        total_score = criteria_breakdown.total_score()

        # Determine performance level
        if total_score >= 90:
            level = "excellent"
            message = "Outstanding work! Your solution demonstrates mastery of the concepts."
        elif total_score >= 80:
            level = "good"
            message = "Great job! Your solution meets most requirements with minor areas for improvement."
        elif total_score >= 70:
            level = "satisfactory"
            message = "Good effort! Your solution meets the basic requirements but has room for improvement."
        elif total_score >= 60:
            level = "needs_improvement"
            message = "Your solution shows understanding but needs significant improvement in several areas."
        else:
            level = "unsatisfactory"
            message = "Your solution needs substantial revision. Review the concepts and try again."

        # Build dimension breakdown
        dimensions = []
        for dim in rubric_config.dimensions:
            score = self._get_dimension_score(criteria_breakdown, dim.id)
            max_score = dim.weight
            percentage = (score / max_score * 100) if max_score > 0 else 0

            dimensions.append({
                "id": dim.id,
                "name": dim.name,
                "score": score,
                "max_score": max_score,
                "percentage": round(percentage, 1),
                "status": self._get_performance_status(percentage),
            })

        return {
            "level": level,
            "message": message,
            "total_score": total_score,
            "max_possible": 100,
            "percentage": round(total_score, 1),
            "dimensions": dimensions,
        }

    def generate_feed_back(
        self,
        criteria_breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
        code: str,
    ) -> dict[str, Any]:
        """Generate "Feed Back" - specific feedback on the work.

        This provides actionable comments on what was done well and what needs improvement.

        Args:
            criteria_breakdown: Scoring breakdown
            rubric_config: Rubric configuration
            code: Source code

        Returns:
            Feed back content
        """
        strengths = []
        improvements = []

        # Analyze each dimension
        for dim in rubric_config.dimensions:
            score = self._get_dimension_score(criteria_breakdown, dim.id)
            max_score = dim.weight
            percentage = (score / max_score * 100) if max_score > 0 else 0

            if percentage >= 80:
                strengths.append({
                    "dimension": dim.name,
                    "comment": self._get_strength_comment(dim.id),
                })
            elif percentage < 50:
                improvements.append({
                    "dimension": dim.name,
                    "comment": self._get_improvement_comment(dim.id),
                    "suggestion": self._get_suggestion_comment(dim.id),
                })

        # Add execution feedback
        execution_percentage = (criteria_breakdown.execution / 30 * 100) if 30 > 0 else 0
        if execution_percentage >= 80:
            strengths.append({
                "dimension": "Code Execution",
                "comment": "Your code runs correctly and passes the test cases.",
            })
        elif execution_percentage < 50:
            improvements.append({
                "dimension": "Code Execution",
                "comment": "Your code has execution issues or fails test cases.",
                "suggestion": "Review the error messages and test your code with different inputs.",
            })

        return {
            "strengths": strengths,
            "improvements": improvements,
            "strength_count": len(strengths),
            "improvement_count": len(improvements),
        }

    def generate_feed_forward(
        self,
        criteria_breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
    ) -> dict[str, Any]:
        """Generate "Feed Forward" - guidance for next steps.

        This helps students understand what to focus on for future assignments.

        Args:
            criteria_breakdown: Scoring breakdown
            rubric_config: Rubric configuration

        Returns:
            Feed forward content
        """
        total_score = criteria_breakdown.total_score()
        recommendations = []

        # Identify lowest-scoring dimensions
        dimension_scores = [
            ("logical_correctness", criteria_breakdown.logical_correctness, 25),
            ("best_practices", criteria_breakdown.best_practices, 20),
            ("code_quality", criteria_breakdown.code_quality, 15),
            ("conceptual_understanding", criteria_breakdown.conceptual_understanding, 10),
            ("execution", criteria_breakdown.execution, 30),
        ]

        # Sort by percentage score (ascending)
        dimension_scores.sort(key=lambda x: (x[1] / x[2] * 100) if x[2] > 0 else 0)

        # Generate recommendations for the two lowest dimensions
        for dim_id, score, max_score in dimension_scores[:2]:
            percentage = (score / max_score * 100) if max_score > 0 else 0
            if percentage < 70:  # Only recommend if below 70%
                recommendations.append({
                    "dimension": dim_id,
                    "priority": "high" if percentage < 50 else "medium",
                    "action": self._get_learning_action(dim_id),
                    "resources": self._get_learning_resources(dim_id),
                })

        # Add general next steps based on overall score
        if total_score < 70:
            next_steps = [
                "Review the fundamental concepts covered in this assignment",
                "Practice with simpler examples before attempting complex solutions",
                "Seek help from the instructor or teaching assistants",
            ]
        elif total_score < 85:
            next_steps = [
                "Refine your solution based on the feedback provided",
                "Practice similar problems to reinforce your understanding",
                "Review best practices for the programming language used",
            ]
        else:
            next_steps = [
                "Challenge yourself with more advanced variations of this problem",
                "Help peers who are struggling with similar concepts",
                "Explore alternative approaches to solving this problem",
            ]

        return {
            "recommendations": recommendations,
            "next_steps": next_steps,
            "target_score": min(total_score + 10, 100),
        }

    def generate_summary(self, criteria_breakdown: CriteriaBreakdown) -> dict[str, Any]:
        """Generate a brief summary of the evaluation.

        Args:
            criteria_breakdown: Scoring breakdown

        Returns:
            Summary content
        """
        total = criteria_breakdown.total_score()

        return {
            "total_score": total,
            "execution": criteria_breakdown.execution,
            "logical_correctness": criteria_breakdown.logical_correctness,
            "best_practices": criteria_breakdown.best_practices,
            "code_quality": criteria_breakdown.code_quality,
            "conceptual_understanding": criteria_breakdown.conceptual_understanding,
            "passed": total >= 60,  # Assuming 60% is passing
        }

    def _get_dimension_score(self, breakdown: CriteriaBreakdown, dim_id: str) -> int:
        """Get the score for a specific dimension."""
        scores = {
            "logical_correctness": breakdown.logical_correctness,
            "best_practices": breakdown.best_practices,
            "code_quality": breakdown.code_quality,
            "conceptual_understanding": breakdown.conceptual_understanding,
        }
        return scores.get(dim_id, 0)

    def _get_performance_status(self, percentage: float) -> str:
        """Get performance status based on percentage."""
        if percentage >= 90:
            return "excellent"
        elif percentage >= 80:
            return "good"
        elif percentage >= 70:
            return "satisfactory"
        elif percentage >= 60:
            return "needs_improvement"
        else:
            return "unsatisfactory"

    def _get_strength_comment(self, dimension_id: str) -> str:
        """Get a positive comment for a dimension."""
        comments = {
            "logical_correctness": "Your algorithmic approach is sound and well-reasoned.",
            "best_practices": "You demonstrate good defensive programming habits.",
            "code_quality": "Your code is clean, readable, and well-organized.",
            "conceptual_understanding": "You show strong grasp of the programming concepts.",
        }
        return comments.get(dimension_id, "Well done on this aspect.")

    def _get_improvement_comment(self, dimension_id: str) -> str:
        """Get a comment about what needs improvement."""
        comments = {
            "logical_correctness": "The logic in your solution needs refinement.",
            "best_practices": "Your code could benefit from better defensive programming.",
            "code_quality": "The organization and readability of your code could be improved.",
            "conceptual_understanding": "Your application of programming concepts needs strengthening.",
        }
        return comments.get(dimension_id, "This area needs improvement.")

    def _get_suggestion_comment(self, dimension_id: str) -> str:
        """Get a specific suggestion for improvement."""
        suggestions = {
            "logical_correctness": "Trace through your algorithm with various inputs to identify edge cases.",
            "best_practices": "Add input validation and check for boundary conditions.",
            "code_quality": "Use more descriptive variable names and add comments for complex logic.",
            "conceptual_understanding": "Review the core concepts and practice with simpler examples first.",
        }
        return suggestions.get(dimension_id, "Review the relevant material and practice more.")

    def _get_learning_action(self, dimension_id: str) -> str:
        """Get a learning action for a dimension."""
        actions = {
            "logical_correctness": "Practice algorithm design and edge case analysis",
            "best_practices": "Study defensive programming techniques",
            "code_quality": "Learn code refactoring and clean code principles",
            "conceptual_understanding": "Review fundamental programming concepts",
            "execution": "Practice debugging and testing strategies",
        }
        return actions.get(dimension_id, "Review and practice")

    def _get_learning_resources(self, dimension_id: str) -> list[str]:
        """Get learning resources for a dimension."""
        resources = {
            "logical_correctness": [
                "Course textbook chapter on algorithm design",
                "Practice problems on edge case handling",
            ],
            "best_practices": [
                "Code review guidelines",
                "Input validation tutorials",
            ],
            "code_quality": [
                "Clean Code by Robert Martin",
                "Language-specific style guides",
            ],
            "conceptual_understanding": [
                "Lecture recordings on core concepts",
                "Supplementary reading materials",
            ],
            "execution": [
                "Debugging techniques workshop",
                "Test-driven development tutorial",
            ],
        }
        return resources.get(dimension_id, ["Consult course materials"])
