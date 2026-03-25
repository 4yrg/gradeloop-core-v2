"""Session management REST routes.

Sessions are created here, then the client connects via WebSocket
at /ws/ivas/session/{session_id} to start the live viva.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.session import SessionCreate, SessionOut
from app.services.viva.session_manager import VivaSession, register_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_db():
    """Get postgres client — injected at app startup."""
    from app.main import postgres_client

    if postgres_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready.",
        )
    return postgres_client


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate) -> SessionOut:
    """Create a new viva session.

    This prepares the session in the database and registers it in memory.
    The client should then connect via WebSocket to start the live viva:
        ws://.../ws/ivas/session/{session_id}
    """
    db = _get_db()

    # Verify assignment exists and load its data
    assignment = await db.get_assignment(body.assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    # Load criteria and approved questions for the system prompt
    criteria = await db.list_criteria(body.assignment_id)
    questions = await db.list_questions(body.assignment_id, status_filter="approved")

    # If no approved questions, fall back to all questions
    if not questions:
        questions = await db.list_questions(body.assignment_id)

    # Create DB record
    row = await db.create_session(
        assignment_id=body.assignment_id,
        student_id=body.student_id,
    )

    # Register in-memory session with Gemini config
    session = VivaSession(
        session_id=row["id"],
        assignment_id=body.assignment_id,
        student_id=body.student_id,
        assignment_title=assignment["title"],
        code_context=assignment.get("code_context"),
        programming_language=assignment.get("programming_language", "python"),
        questions=questions,
        criteria=criteria,
    )
    register_session(session)

    return SessionOut(**row)


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    student_id: str | None = Query(None),
    assignment_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
) -> list[SessionOut]:
    """List viva sessions with optional filters."""
    db = _get_db()
    rows = await db.list_sessions(
        student_id=student_id,
        assignment_id=assignment_id,
        status_filter=status_filter,
    )
    return [SessionOut(**r) for r in rows]


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: UUID) -> SessionOut:
    """Get a session's details and current status."""
    db = _get_db()
    row = await db.get_session(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    return SessionOut(**row)
