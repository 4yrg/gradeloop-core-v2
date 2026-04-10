"""Viva session management routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.session import (
    GradedQAOut,
    SessionCreate,
    SessionDetailOut,
    SessionOut,
    TranscriptOut,
)

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
        assignment_context=body.assignment_context,
        difficulty_distribution=body.difficulty_distribution,
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


@router.get("/{session_id}/details", response_model=SessionDetailOut)
async def get_session_details(session_id: UUID) -> SessionDetailOut:
    """Get a viva session along with its transcript and per-question scores.

    Used by the instructor review page to show the full picture:
    every conceptual question asked, the student's answer, the score,
    and the justification.
    """
    db = _get_db()
    row = await db.get_session(session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")

    transcripts = await db.list_transcripts(session_id)
    graded_rows = await db.list_graded_qa(session_id)

    # Default per-question max: 10 (matches grader). If the session has a
    # stored max_possible that divides evenly across items, prefer that.
    session_max = row.get("max_possible")
    per_q_max = 10.0
    if session_max and graded_rows:
        try:
            candidate = float(session_max) / float(len(graded_rows))
            if candidate > 0:
                per_q_max = candidate
        except Exception:
            pass

    graded_out = [
        GradedQAOut(
            sequence_num=g["sequence_num"],
            question_text=g["question_text"],
            response_text=g.get("response_text"),
            score=float(g["score"]) if g.get("score") is not None else None,
            max_score=per_q_max,
            score_justification=g.get("score_justification"),
        )
        for g in graded_rows
    ]

    return SessionDetailOut(
        session=SessionOut(**row),
        transcripts=[TranscriptOut(**t) for t in transcripts],
        graded_qa=graded_out,
    )
