"""Socratic Agent for generating contextual hints based on rubric criteria."""

import json
import os
from typing import Any, Optional

from app.logging_config import get_logger
from app.schemas.rubric import CriteriaBreakdown, RubricConfig

logger = get_logger(__name__)


class SocraticAgent:
    """Agent that generates Socratic hints aligned with rubric criteria."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize the Socratic Agent.

        Args:
            api_key: API key for the LLM service
            model: Model name to use
        """
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "gpt-4")
        self.logger = get_logger(__name__)
        self._client = None

    def _get_client(self):
        """Lazy initialization of LLM client."""
        if self._client is None:
            try:
                from openai import OpenAI

                self._client = OpenAI(api_key=self.api_key)
                self.logger.debug("llm_client_initialized")
            except ImportError:
                self.logger.warning("openai_not_installed")
                return None
        return self._client

    def generate_hints(
        self,
        criteria_breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
        code: str,
        language: str,
    ) -> dict[str, Any]:
        """Generate contextual hints based on low-scoring dimensions.

        Args:
            criteria_breakdown: Scoring breakdown per dimension
            rubric_config: Rubric configuration
            code: Student's source code
            language: Programming language

        Returns:
            Dictionary with prioritized hints per dimension
        """
        # Identify weak dimensions (score below 50% of max possible)
        weak_dimensions = self._identify_weak_dimensions(
            criteria_breakdown, rubric_config
        )

        if not weak_dimensions:
            return {
                "status": "success",
                "message": "Great job! Your solution meets all criteria.",
                "hints": [],
            }

        # Generate hints for weak dimensions
        hints = []
        for dim_id, dim_info in weak_dimensions.items():
            hint = self._generate_dimension_hint(
                dim_id, dim_info, code, language
            )
            if hint:
                hints.append(hint)

        # Sort hints by priority (lowest scores first)
        hints.sort(key=lambda h: h.get("score", 100))

        return {
            "status": "success",
            "message": f"Found {len(hints)} areas for improvement",
            "hints": hints,
            "prioritized_dimensions": list(weak_dimensions.keys()),
        }

    def _identify_weak_dimensions(
        self,
        breakdown: CriteriaBreakdown,
        rubric_config: RubricConfig,
    ) -> dict[str, dict[str, Any]]:
        """Identify dimensions where the student scored poorly.

        Args:
            breakdown: Criteria breakdown
            rubric_config: Rubric configuration

        Returns:
            Dictionary of weak dimension IDs to their info
        """
        weak_dims = {}

        # Map dimension IDs to their scores and weights
        dimension_scores = {
            "logical_correctness": {
                "score": breakdown.logical_correctness,
                "max_score": 25,
            },
            "best_practices": {
                "score": breakdown.best_practices,
                "max_score": 20,
            },
            "code_quality": {
                "score": breakdown.code_quality,
                "max_score": 15,
            },
            "conceptual_understanding": {
                "score": breakdown.conceptual_understanding,
                "max_score": 10,
            },
        }

        # Find dimensions scoring below 50% of their max
        for dim_id, scores in dimension_scores.items():
            max_score = scores["max_score"]
            actual_score = scores["score"]
            percentage = (actual_score / max_score * 100) if max_score > 0 else 0

            if percentage < 50:  # Less than 50% of max score
                # Get dimension description from rubric
                description = ""
                for dim in rubric_config.dimensions:
                    if dim.id == dim_id:
                        description = dim.description
                        break

                weak_dims[dim_id] = {
                    "score": actual_score,
                    "max_score": max_score,
                    "percentage": percentage,
                    "description": description,
                }

        return weak_dims

    def _generate_dimension_hint(
        self,
        dimension_id: str,
        dim_info: dict[str, Any],
        code: str,
        language: str,
    ) -> Optional[dict[str, Any]]:
        """Generate a Socratic hint for a specific dimension.

        Args:
            dimension_id: Dimension identifier
            dim_info: Dimension information
            code: Source code
            language: Programming language

        Returns:
            Hint dictionary or None
        """
        # Use predefined hint templates based on dimension
        hint_templates = self._get_hint_templates(dimension_id)

        # Try to use LLM for personalized hint
        client = self._get_client()
        if client:
            try:
                personalized_hint = self._generate_llm_hint(
                    client, dimension_id, dim_info, code, language
                )
                if personalized_hint:
                    return {
                        "dimension": dimension_id,
                        "score": dim_info["score"],
                        "max_score": dim_info["max_score"],
                        "hint": personalized_hint,
                        "type": "personalized",
                    }
            except Exception as e:
                self.logger.warning("llm_hint_generation_failed", error=str(e))

        # Fallback to template-based hint
        return {
            "dimension": dimension_id,
            "score": dim_info["score"],
            "max_score": dim_info["max_score"],
            "hint": hint_templates[0] if hint_templates else "Review this area.",
            "type": "template",
        }

    def _get_hint_templates(self, dimension_id: str) -> list[str]:
        """Get predefined hint templates for a dimension.

        Args:
            dimension_id: Dimension identifier

        Returns:
            List of hint templates
        """
        templates = {
            "logical_correctness": [
                "Have you considered all possible edge cases in your logic?",
                "What would happen if the input was at its minimum or maximum value?",
                "Can you trace through your algorithm step by step to verify correctness?",
                "Is there a simpler way to express this logic?",
            ],
            "best_practices": [
                "Have you checked that all variables are properly initialized before use?",
                "What happens if the user provides unexpected input?",
                "Are there any boundary conditions you might have missed?",
                "Consider adding validation for your inputs.",
            ],
            "code_quality": [
                "Would another developer easily understand this code?",
                "Are your variable names descriptive of their purpose?",
                "Could this code be organized more clearly?",
                "Consider breaking complex operations into smaller steps.",
            ],
            "conceptual_understanding": [
                "Is this the most appropriate data structure for this problem?",
                "Have you considered alternative approaches to solve this?",
                "Does your solution demonstrate understanding of the core concept?",
                "Think about the trade-offs in your chosen approach.",
            ],
        }
        return templates.get(dimension_id, ["Review your solution."])

    def _generate_llm_hint(
        self,
        client,
        dimension_id: str,
        dim_info: dict[str, Any],
        code: str,
        language: str,
    ) -> Optional[str]:
        """Generate a personalized hint using LLM.

        Args:
            client: LLM client
            dimension_id: Dimension identifier
            dim_info: Dimension information
            code: Source code
            language: Programming language

        Returns:
            Personalized hint or None
        """
        dimension_names = {
            "logical_correctness": "Logical Correctness",
            "best_practices": "Best Practices",
            "code_quality": "Code Quality",
            "conceptual_understanding": "Conceptual Understanding",
        }

        dim_name = dimension_names.get(dimension_id, dimension_id)

        prompt = f"""You are a Socratic tutor helping a student improve their code.

The student scored {dim_info['score']}/{dim_info['max_score']} on "{dim_name}".

Description: {dim_info['description']}

Language: {language}

Code:
```{language}
{code[:1000]}  # Truncated for brevity
```

Provide a single, specific Socratic question or hint that guides the student to discover the issue themselves. Do NOT give the answer directly. Be encouraging and concise.

Hint:"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful Socratic tutor. Provide hints, not answers.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=150,
        )

        hint = response.choices[0].message.content.strip()
        return hint

    def build_socratic_prompt(
        self,
        rubric_config: RubricConfig,
        weak_dimensions: list[str],
    ) -> str:
        """Build a Socratic prompt for the chatbot.

        Args:
            rubric_config: Rubric configuration
            weak_dimensions: List of weak dimension IDs

        Returns:
            System prompt for Socratic mode
        """
        dim_descriptions = []
        for dim in rubric_config.dimensions:
            if dim.id in weak_dimensions:
                dim_descriptions.append(f"- {dim.name}: {dim.description}")

        prompt = f"""You are a Socratic tutor helping a student with their programming assignment.

The student needs help in these areas:
{chr(10).join(dim_descriptions)}

Guidelines:
1. Ask guiding questions rather than giving direct answers
2. Focus on the areas where the student lost points
3. Encourage the student to think critically about their solution
4. Be supportive and encouraging
5. If the student asks for the answer, guide them to discover it themselves

Remember: Your goal is to help the student learn, not to give them the solution."""

        return prompt
