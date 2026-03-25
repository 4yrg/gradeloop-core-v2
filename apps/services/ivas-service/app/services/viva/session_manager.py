"""Viva session manager — lifecycle and state machine.

Manages the full lifecycle of a viva session:
    initializing → in_progress → completed/abandoned

Each active session holds a GeminiLiveSession and tracks
which questions have been asked and answered.
"""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from app.logging_config import get_logger
from app.services.viva.gemini_client import GeminiLiveSession

logger = get_logger(__name__)

# Active sessions keyed by session UUID
_active_sessions: dict[UUID, "VivaSession"] = {}


class VivaSession:
    """Represents a single live viva examination session."""

    VALID_TRANSITIONS = {
        "initializing": {"in_progress", "abandoned"},
        "in_progress": {"paused", "completed", "abandoned"},
        "paused": {"in_progress", "completed", "abandoned"},
        "completed": set(),
        "abandoned": set(),
    }

    def __init__(
        self,
        session_id: UUID,
        assignment_id: UUID,
        student_id: str,
        assignment_title: str,
        code_context: str | None = None,
        programming_language: str = "python",
        questions: list[dict] | None = None,
        criteria: list[dict] | None = None,
    ) -> None:
        self.session_id = session_id
        self.assignment_id = assignment_id
        self.student_id = student_id
        self.status = "initializing"
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: datetime | None = None

        # Question tracking
        self.questions_asked: list[dict] = []
        self.current_question_index = 0

        # Gemini session
        self._gemini = GeminiLiveSession(
            assignment_title=assignment_title,
            code_context=code_context,
            programming_language=programming_language,
            questions=questions,
            criteria=criteria,
        )
        self._receive_task: asyncio.Task | None = None

    def _transition(self, new_status: str) -> None:
        """Transition session to new status with validation."""
        allowed = self.VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition: {self.status} → {new_status}"
            )
        old = self.status
        self.status = new_status
        logger.info(
            "session_transition",
            session_id=str(self.session_id),
            from_status=old,
            to_status=new_status,
        )

    async def start(self) -> None:
        """Connect to Gemini and start the viva."""
        await self._gemini.connect()
        self._transition("in_progress")

        # Send initial prompt to Gemini to begin the viva
        await self._gemini.send_text(
            "Begin the viva examination. Greet the student briefly and ask "
            "your first question. Keep your introduction under 15 seconds."
        )

    async def send_audio(self, pcm_base64: str) -> None:
        """Forward student audio to Gemini."""
        if self.status != "in_progress":
            return
        await self._gemini.send_audio(pcm_base64)

    async def receive_responses(self):
        """Yield Gemini responses (audio/text/turn_complete)."""
        async for response in self._gemini.receive_audio():
            yield response

    async def end_viva(self) -> None:
        """Request Gemini to wrap up and provide final assessment."""
        if self.status != "in_progress":
            return

        await self._gemini.send_text(
            "The viva time is up. Please provide a brief closing statement "
            "to the student, then end the conversation."
        )

    async def complete(self) -> None:
        """Mark session as completed and clean up."""
        if self.status in ("completed", "abandoned"):
            return
        self._transition("completed")
        self.completed_at = datetime.now(timezone.utc)
        await self._cleanup()

    async def abandon(self) -> None:
        """Mark session as abandoned (student disconnected, error, etc.)."""
        if self.status in ("completed", "abandoned"):
            return
        if self.status == "initializing":
            self.status = "abandoned"
        else:
            self._transition("abandoned")
        self.completed_at = datetime.now(timezone.utc)
        await self._cleanup()

    async def _cleanup(self) -> None:
        """Close Gemini session and remove from active sessions."""
        await self._gemini.close()
        _active_sessions.pop(self.session_id, None)
        logger.info(
            "session_cleaned_up",
            session_id=str(self.session_id),
            status=self.status,
        )


def get_active_session(session_id: UUID) -> VivaSession | None:
    """Get an active session by ID."""
    return _active_sessions.get(session_id)


def register_session(session: VivaSession) -> None:
    """Register a new session as active."""
    _active_sessions[session.session_id] = session


async def cleanup_all_sessions() -> None:
    """Clean up all active sessions (called on shutdown)."""
    for session in list(_active_sessions.values()):
        try:
            await session.abandon()
        except Exception as e:
            logger.error(
                "session_cleanup_error",
                session_id=str(session.session_id),
                error=str(e),
            )
    _active_sessions.clear()
