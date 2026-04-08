"""Viva session management routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.session import SessionCreate, SessionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_db():
    from app.main import postgres_client

    if postgres_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready.",
        )
    return postgres_client


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate) -> SessionOut:
    """Create a new viva session for a student."""
    db = _get_db()
    row = await db.create_session(
        assignment_id=body.assignment_id,
        student_id=body.student_id,
    )
    return SessionOut(**row)


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    student_id: str | None = Query(default=None),
    assignment_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[SessionOut]:
    """List viva sessions with optional filters."""
    db = _get_db()
    rows = await db.list_sessions(
        student_id=student_id,
        assignment_id=assignment_id,
        status=status,
    )
    return [SessionOut(**r) for r in rows]


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: UUID) -> SessionOut:
    """Get a viva session by ID."""
    db = _get_db()
    row = await db.get_session(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    return SessionOut(**row)
