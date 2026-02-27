"""LLM Gateway for semantic scoring using AST blueprint and rubric context."""

import json
import os
from typing import Any, Optional

from app.logging_config import get_logger
from app.schemas.rubric import (
    LLMScoringResult,
    RubricConfig,
    SemanticScoreRequest,
    SemanticScoreResponse,
)

logger = get_logger(__name__)


class LLMGateway:
    """Gateway for LLM-based semantic code evaluation."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None):
        """Initialize the LLM Gateway.

        Args:
            api_key: API key for the LLM service (defaults to env var)
            model: Model name to use (defaults to env var or gpt-4)
            base_url: Custom base URL for OpenAI-compatible API (e.g., OpenRouter)
        """
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "gpt-4")
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "")
        self.logger = get_logger(__name__)
        self._client = None

    def _get_client(self):
        """Lazy initialization of LLM client."""
        if self._client is None:
            # Try to import and initialize OpenAI client
            try:
                from openai import OpenAI

                # Support custom base URL for OpenRouter or other OpenAI-compatible APIs
                client_kwargs = {"api_key": self.api_key}
                if self.base_url:
                    client_kwargs["base_url"] = self.base_url
                    self.logger.debug("llm_client_initialized_with_custom_base_url", base_url=self.base_url)
                else:
                    self.logger.debug("llm_client_initialized")

                self._client = OpenAI(**client_kwargs)
            except ImportError:
                self.logger.warning("openai_not_installed")
                return None
        return self._client

    def generate_semantic_scores(
        self,
        code: str,
        ast_blueprint: dict[str, Any],
        rubric_config: RubricConfig,
        language: str,
    ) -> Optional[LLMScoringResult]:
        """Generate semantic scores using LLM.

        Args:
            code: Source code being evaluated
            ast_blueprint: AST structural blueprint
            rubric_config: Rubric configuration
            language: Programming language

        Returns:
            LLM scoring result or None if LLM is unavailable
        """
        client = self._get_client()
        if client is None:
            self.logger.warning("llm_client_not_available")
            return None

        try:
            # Build the scoring prompt
            prompt = self._build_scoring_prompt(code, ast_blueprint, rubric_config, language)

            # Call LLM
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt(),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,  # Lower temperature for consistent scoring
                max_tokens=2000,
            )

            # Parse response
            content = response.choices[0].message.content
            return self._parse_llm_response(content, rubric_config)

        except Exception as e:
            self.logger.error("llm_scoring_failed", error=str(e))
            return None

    def _get_system_prompt(self) -> str:
        """Get the system prompt for semantic scoring."""
        return """You are an expert code evaluator for an automated assessment system.
Your task is to evaluate student code submissions across multiple semantic dimensions.

You will receive:
1. Source code
2. AST (Abstract Syntax Tree) blueprint showing code structure
3. Rubric dimensions with descriptions and weights

Evaluate the code objectively based on the rubric criteria.
Provide scores from 0-100 for each dimension, where:
- 0-20: Poor / Missing
- 21-40: Below Average
- 41-60: Average
- 61-80: Good
- 81-100: Excellent

Provide brief reasoning for each score and actionable suggestions for improvement.

Respond in JSON format only."""

    def _build_scoring_prompt(
        self,
        code: str,
        ast_blueprint: dict[str, Any],
        rubric_config: RubricConfig,
        language: str,
    ) -> str:
        """Build the scoring prompt for the LLM.

        Args:
            code: Source code
            ast_blueprint: AST blueprint
            rubric_config: Rubric configuration
            language: Programming language

        Returns:
            Formatted prompt string
        """
        # Build dimension descriptions
        dimension_descriptions = []
        for dim in rubric_config.dimensions:
            dimension_descriptions.append(
                f"- {dim.name} (Weight: {dim.weight}%): {dim.description}"
            )

        # Truncate code if too long
        max_code_lines = 100
        code_lines = code.split("\n")
        if len(code_lines) > max_code_lines:
            code = "\n".join(code_lines[:max_code_lines]) + "\n... (truncated)"

        prompt = f"""Please evaluate the following {language} code submission:

## Source Code
```{language}
{code}
```

## AST Blueprint (Structural Analysis)
```json
{json.dumps(ast_blueprint, indent=2)}
```

## Rubric Dimensions
{chr(10).join(dimension_descriptions)}

## Evaluation Instructions

For each dimension below, provide a score (0-100), reasoning, and suggestions:

1. **Logical Correctness**: Does the code demonstrate correct algorithmic thinking?
   - Look for: Proper control flow, correct logic, edge case handling

2. **Best Practices**: Does the code follow defensive programming?
   - Look for: Input validation, error handling, bounds checking, initialization

3. **Code Quality**: Is the code readable and well-organized?
   - Look for: Meaningful names, proper formatting, modularity, comments

4. **Conceptual Understanding**: Does the code show mastery of concepts?
   - Look for: Appropriate data structures, efficient algorithms, paradigm usage

## Response Format

Respond ONLY with a JSON object in this exact format:

{{
  "logical_correctness": {{
    "score": <0-100>,
    "reasoning": "<brief explanation>",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  }},
  "best_practices": {{
    "score": <0-100>,
    "reasoning": "<brief explanation>",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  }},
  "code_quality": {{
    "score": <0-100>,
    "reasoning": "<brief explanation>",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  }},
  "conceptual_understanding": {{
    "score": <0-100>,
    "reasoning": "<brief explanation>",
    "suggestions": ["<suggestion 1>", "<suggestion 2>"]
  }},
  "overall_feedback": "<summary of evaluation>"
}}"""

        return prompt

    def _parse_llm_response(
        self, content: str, rubric_config: RubricConfig
    ) -> Optional[LLMScoringResult]:
        """Parse LLM response into structured scoring result.

        Args:
            content: Raw LLM response content
            rubric_config: Rubric configuration

        Returns:
            Parsed LLM scoring result or None if parsing fails
        """
        try:
            # Extract JSON from response (handle markdown code blocks)
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)

            # Build semantic score responses
            logical = SemanticScoreResponse(
                dimension_id="logical_correctness",
                score=data.get("logical_correctness", {}).get("score", 0),
                reasoning=data.get("logical_correctness", {}).get("reasoning", ""),
                suggestions=data.get("logical_correctness", {}).get("suggestions", []),
            )

            best_practices = SemanticScoreResponse(
                dimension_id="best_practices",
                score=data.get("best_practices", {}).get("score", 0),
                reasoning=data.get("best_practices", {}).get("reasoning", ""),
                suggestions=data.get("best_practices", {}).get("suggestions", []),
            )

            code_quality = SemanticScoreResponse(
                dimension_id="code_quality",
                score=data.get("code_quality", {}).get("score", 0),
                reasoning=data.get("code_quality", {}).get("reasoning", ""),
                suggestions=data.get("code_quality", {}).get("suggestions", []),
            )

            conceptual = SemanticScoreResponse(
                dimension_id="conceptual_understanding",
                score=data.get("conceptual_understanding", {}).get("score", 0),
                reasoning=data.get("conceptual_understanding", {}).get("reasoning", ""),
                suggestions=data.get("conceptual_understanding", {}).get("suggestions", []),
            )

            return LLMScoringResult(
                logical_correctness=logical,
                best_practices=best_practices,
                code_quality=code_quality,
                conceptual_understanding=conceptual,
                overall_feedback=data.get("overall_feedback", ""),
            )

        except (json.JSONDecodeError, KeyError) as e:
            self.logger.error("failed_to_parse_llm_response", error=str(e), content=content[:200])
            return None

    def score_single_dimension(
        self,
        request: SemanticScoreRequest,
    ) -> Optional[SemanticScoreResponse]:
        """Score a single dimension using LLM.

        Args:
            request: Semantic score request

        Returns:
            Semantic score response or None if LLM unavailable
        """
        client = self._get_client()
        if client is None:
            return None

        try:
            prompt = f"""Evaluate the following code for the dimension: {request.dimension_name}

Description: {request.description}
Weight: {request.weight}%

Language: {request.language}

Code:
```{request.language}
{request.code}
```

AST Blueprint:
```json
{json.dumps(request.ast_blueprint, indent=2)}
```

Provide a score (0-100), reasoning, and suggestions in JSON format:
{{
  "score": <0-100>,
  "reasoning": "<explanation>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}}"""

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert code evaluator. Respond with JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=500,
            )

            content = response.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)
            return SemanticScoreResponse(
                dimension_id=request.dimension_id,
                score=data.get("score", 0),
                reasoning=data.get("reasoning", ""),
                suggestions=data.get("suggestions", []),
            )

        except Exception as e:
            self.logger.error("single_dimension_scoring_failed", error=str(e))
            return None
