"""Viva session management routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.logging_config import get_logger
from app.schemas.session import (
    GradedQAOut,
    SessionCreate,
    SessionDetailOut,
    SessionOut,
    TranscriptOut,
)
from app.schemas.voice import VoiceAuthEventOut

logger = get_logger(__name__)

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

    # Enforce that the assignment has grading criteria (competencies) before
    # allowing a viva session to be created.
    competency_rows = await db.list_assignment_competencies(body.assignment_id)
    if not competency_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot start viva: no grading criteria (competencies) configured for this assignment. The instructor must add competencies first.",
        )

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


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: UUID) -> None:
    """Delete a viva session and all related data."""
    db = _get_db()
    deleted = await db.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")


@router.post("/{session_id}/regrade", response_model=SessionOut)
async def regrade_session(session_id: UUID) -> SessionOut:
    """Re-run grading on an existing session's transcript.

    Used by instructors when grading failed, when the AI produced a poor
    result, or simply when they want a fresh score. The transcript itself is
    NOT re-recorded — only the grading + per-question + per-competency
    derivation is re-executed.

    Strategy for picking the question plan (in priority order):
      1. session.metadata.planned_questions  (saved at session start)
      2. existing question_instances rows    (legacy sessions)
      3. assignment competencies + AI question selection (last resort)
    """
    db = _get_db()
    from app.config import get_settings
    from app.routes.viva_ws import _grade_and_persist, _serialize_planned_questions

    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if session.get("status") in {"in_progress", "initializing", "grading"}:
        raise HTTPException(
            status_code=409,
            detail="Session is still active or already being graded; wait for it to finish first.",
        )

    transcript_rows = await db.list_transcripts(session_id)
    if not transcript_rows:
        raise HTTPException(
            status_code=400,
            detail="Cannot regrade: this session has no transcript to grade.",
        )

    # Convert DB transcript rows into the {turn_number, role, content} shape
    # the grader expects.
    transcript_turns = [
        {
            "turn_number": int(t["turn_number"]),
            "role": t["role"],
            "content": t["content"] or "",
        }
        for t in transcript_rows
    ]

    settings = get_settings()
    assignment_context = session.get("assignment_context") or {}
    metadata = session.get("metadata") or {}

    # 1. Try the saved plan from session metadata.
    planned_questions: list[dict] = list(metadata.get("planned_questions") or [])

    # 2. Fall back to reconstructing from question_instances.
    if not planned_questions:
        planned_questions = await _reconstruct_plan_from_instances(db, session_id)

    # 3. Last resort: re-select questions from the assignment competencies.
    if not planned_questions:
        planned_questions = await _select_fresh_plan(
            db, settings, session.get("assignment_id"), assignment_context,
            session.get("difficulty_distribution") or {},
        )

    # Persist whatever plan we ended up using so subsequent regrades stay
    # consistent with the same competency mapping.
    if planned_questions:
        try:
            metadata["planned_questions"] = _serialize_planned_questions(planned_questions)
            await db.update_session_metadata(session_id, metadata)
        except Exception as exc:
            logger.warning("regrade_persist_plan_failed", error=str(exc))

    await db.update_session_status(session_id, "grading")

    success = await _grade_and_persist(
        db=db,
        settings=settings,
        sid=session_id,
        transcript_turns=transcript_turns,
        assignment_context=assignment_context,
        # Explicit: empty list [] is treated as None (no plan = free-form grading)
        selected_questions=planned_questions if planned_questions else None,
    )

    refreshed = await db.get_session(session_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Session disappeared during regrade.")

    if not success and refreshed.get("status") != "grading_failed":
        # Defensive: _grade_and_persist should already have set this, but
        # make sure we never leave the session stuck in 'grading'.
        await db.update_session_status(session_id, "grading_failed")
        refreshed = await db.get_session(session_id)

    return SessionOut(**refreshed)


async def _reconstruct_plan_from_instances(db, session_id: UUID) -> list[dict]:
    """Build a planned-questions list from saved question_instances rows.

    Maps each row's competency NAME back to a competency_id by looking it up
    in the global competencies table. Rows whose competency name doesn't
    resolve are still included so the grader still grades the question — they
    just won't contribute to per-competency scoring.
    """
    qi_rows = await db.list_question_instances(session_id)
    if not qi_rows:
        return []

    plan: list[dict] = []
    for r in qi_rows:
        comp_name = r.get("competency")
        comp_id: str | None = None
        if comp_name:
            comp = await db.get_competency_by_name(comp_name)
            if comp:
                comp_id = str(comp["id"])
        plan.append({
            "sequence_num": int(r["sequence_num"]),
            "question_text": r.get("question_text") or "",
            "competency_id": comp_id,
            "competency_name": comp_name,
            "difficulty": r.get("difficulty"),
            "max_score": 10.0,
        })
    return plan


async def _select_fresh_plan(
    db,
    settings,
    assignment_id,
    assignment_context: dict,
    difficulty_distribution: dict,
) -> list[dict]:
    """Last-resort plan: re-run question selection against assignment competencies."""
    if not assignment_id:
        return []
    competency_rows = await db.list_assignment_competencies(assignment_id)
    if not competency_rows:
        return []

    # Normalise distribution keys to int (JSONB may give strings)
    norm_distribution: dict[int, int] = {
        int(k): int(v) for k, v in (difficulty_distribution or {}).items()
    }
    if not norm_distribution:
        from collections import Counter
        norm_distribution = dict(
            Counter(int(c.get("difficulty", 2)) for c in competency_rows)
        )

    from app.services.viva.question_selector import select_questions_ai
    try:
        return await select_questions_ai(
            gemini_api_key=settings.gemini_api_key,
            model=settings.gemini_grader_model,
            assignment_context=assignment_context,
            competencies=competency_rows,
            difficulty_distribution=norm_distribution,
        )
    except Exception as exc:
        logger.warning("regrade_select_fresh_failed", error=str(exc))
        return []


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

    graded_out = [
        GradedQAOut(
            sequence_num=g["sequence_num"],
            question_text=g["question_text"],
            response_text=g.get("response_text"),
            score=float(g["score"]) if g.get("score") is not None else None,
            max_score=float(g["max_score"]) if g.get("max_score") is not None else 10.0,
            score_justification=g.get("score_justification"),
        )
        for g in graded_rows
    ]

    voice_events = await db.list_voice_auth_events(session_id)

    return SessionDetailOut(
        session=SessionOut(**row),
        transcripts=[TranscriptOut(**t) for t in transcripts],
        graded_qa=graded_out,
        voice_auth_events=[
            VoiceAuthEventOut(**v) for v in voice_events
        ],
    )
