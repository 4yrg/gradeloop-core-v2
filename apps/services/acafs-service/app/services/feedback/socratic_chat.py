"""Socratic chat service using OpenRouter / Arcee Trinity Large.

Session lifecycle
-----------------
- A session is created automatically the first time a student sends a message
  for a given assignment.
- Exactly ONE active session exists per (assignment_id, user_id) pair.
- The session is closed (status → 'closed', closed_reason → 'submission') when
  the student's submission event is processed by the evaluation worker.
- Session history is preserved for instructor analytics after closure.
"""

import re
from typing import Any
from uuid import UUID

import httpx

from app.config import Settings
from app.logging_config import get_logger
from app.services.feedback.prompts import build_socratic_system_prompt

logger = get_logger(__name__)

_MOCK_PLACEHOLDER = "SET_YOUR_API_KEY_HERE"
# Strip code blocks with > 5 lines that look like full solutions
_LONG_CODE_BLOCK = re.compile(r"```[\s\S]*?```")


def _apply_guardrail(content: str) -> str:
    """Server-side guardrail: replace suspiciously long code blocks."""
    def _replace(m: re.Match) -> str:
        block = m.group(0)
        if block.count("\n") > 5:
            return (
                "What part of the logic would you like to reason through "
                "step by step?"
            )
        return block

    return _LONG_CODE_BLOCK.sub(_replace, content).strip()


class SocraticChatService:
    """Handles Socratic tutoring turns via OpenRouter / Arcee Trinity Large."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._timeout = httpx.Timeout(30.0, connect=5.0)

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "ACAFS Socratic Tutor",
            "Content-Type": "application/json",
        }

    # ── public API ─────────────────────────────────────────────────────────

    async def get_hint(
        self,
        *,
        messages: list[dict[str, str]],
        assignment_context: dict[str, Any] | None = None,
        ast_context: dict[str, Any] | None = None,
    ) -> tuple[str, Any]:
        """Generate the next Socratic hint.

        Parameters
        ----------
        messages:
            Full conversation history in OpenAI chat format
            ``[{"role": "user"|"assistant", "content": "..."}]``.
            A sliding window of the last 6 turns is used automatically.
        assignment_context:
            Dict with optional keys: title, assignment_description,
            rubric_skills (list[str]), answer_concepts (list[str]).
        ast_context:
            Compact AST snapshot from ASTBlueprint
            (variables, functions, valid_syntax).

        Returns
        -------
        (content, reasoning_details)
            content          – guardrail-filtered assistant reply
            reasoning_details – raw reasoning from the model (may be None)
        """
        if self.settings.openrouter_api_key == _MOCK_PLACEHOLDER:
            return (
                "What aspect of the problem would you like to think through "
                "first? (Mock hint — set OPENROUTER_API_KEY to enable live tutoring.)",
                None,
            )

        system_prompt = build_socratic_system_prompt(assignment_context, ast_context)

        # Sliding window: last 6 turns to control context size
        recent = messages[-6:] if len(messages) > 6 else messages
        clean_messages = [
            {"role": m["role"], "content": m["content"]} for m in recent
        ]

        payload = {
            "model": self.settings.openrouter_model,
            "messages": [{"role": "system", "content": system_prompt}] + clean_messages,
            "reasoning": {"enabled": True},
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self.settings.openrouter_base_url}/chat/completions",
                    headers=self._headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                message = data["choices"][0]["message"]
                content = _apply_guardrail(message.get("content", ""))
                reasoning = message.get("reasoning_details")
                logger.info("socratic_hint_generated", model=self.settings.openrouter_model)
                return content, reasoning
        except Exception as e:
            logger.error("socratic_hint_error", error=str(e))
            return (f"Tutor is temporarily offline. Error: {e}", None)
