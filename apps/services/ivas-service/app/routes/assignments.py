"""Assignment, grading criteria, and question management routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_db
from app.schemas import (
    AssignmentCreate,
    AssignmentDetailOut,
    AssignmentOut,
    AssignmentUpdate,
    GradingCriteriaCreate,
    GradingCriteriaOut,
    GradingCriteriaUpdate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
)
from app.services.storage.postgres_client import PostgresClient

router = APIRouter(prefix="/assignments", tags=["assignments"])


# =============================================================================
# Assignments
# =============================================================================


@router.post("", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_assignment(body: AssignmentCreate, db: PostgresClient = Depends(get_db)) -> AssignmentOut:
    """Create a new assignment."""
    row = await db.create_assignment(
        title=body.title,
        instructor_id=body.instructor_id,
        description=body.description,
        code_context=body.code_context,
        programming_language=body.programming_language,
        course_id=body.course_id,
    )
    return AssignmentOut(**row)


@router.get("", response_model=list[AssignmentOut])
async def list_assignments(
    instructor_id: str | None = Query(None),
    course_id: str | None = Query(None),
    db: PostgresClient = Depends(get_db),
) -> list[AssignmentOut]:
    """List assignments with optional filters."""
    rows = await db.list_assignments(instructor_id=instructor_id, course_id=course_id)
    return [AssignmentOut(**r) for r in rows]


@router.get("/{assignment_id}", response_model=AssignmentDetailOut)
async def get_assignment(assignment_id: UUID, db: PostgresClient = Depends(get_db)) -> AssignmentDetailOut:
    """Get assignment with criteria and questions."""
    row = await db.get_assignment(assignment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    criteria = await db.list_criteria(assignment_id)
    questions = await db.list_questions(assignment_id)

    return AssignmentDetailOut(
        **row,
        criteria=[GradingCriteriaOut(**c) for c in criteria],
        questions=[QuestionOut(**q) for q in questions],
    )


@router.put("/{assignment_id}", response_model=AssignmentOut)
async def update_assignment(assignment_id: UUID, body: AssignmentUpdate, db: PostgresClient = Depends(get_db)) -> AssignmentOut:
    """Update an assignment."""
    fields = body.model_dump(exclude_none=True)
    row = await db.update_assignment(assignment_id, **fields)
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return AssignmentOut(**row)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(assignment_id: UUID, db: PostgresClient = Depends(get_db)) -> None:
    """Delete an assignment and all related data."""
    deleted = await db.delete_assignment(assignment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found.")


# =============================================================================
# Grading Criteria (nested under assignment)
# =============================================================================


@router.post(
    "/{assignment_id}/criteria",
    response_model=GradingCriteriaOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_criteria(
    assignment_id: UUID, body: GradingCriteriaCreate, db: PostgresClient = Depends(get_db),
) -> GradingCriteriaOut:
    """Add grading criteria to an assignment."""
    # Verify assignment exists
    if not await db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")

    row = await db.create_criteria(
        assignment_id=assignment_id,
        competency=body.competency,
        description=body.description,
        max_score=body.max_score,
        weight=body.weight,
        difficulty=body.difficulty,
    )
    return GradingCriteriaOut(**row)


@router.get("/{assignment_id}/criteria", response_model=list[GradingCriteriaOut])
async def list_criteria(assignment_id: UUID, db: PostgresClient = Depends(get_db)) -> list[GradingCriteriaOut]:
    """List all grading criteria for an assignment."""
    rows = await db.list_criteria(assignment_id)
    return [GradingCriteriaOut(**r) for r in rows]


@router.put("/criteria/{criteria_id}", response_model=GradingCriteriaOut)
async def update_criteria(criteria_id: UUID, body: GradingCriteriaUpdate, db: PostgresClient = Depends(get_db)) -> GradingCriteriaOut:
    """Update a grading criteria."""
    fields = body.model_dump(exclude_none=True)
    row = await db.update_criteria(criteria_id, **fields)
    if not row:
        raise HTTPException(status_code=404, detail="Criteria not found.")
    return GradingCriteriaOut(**row)


@router.delete("/criteria/{criteria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_criteria(criteria_id: UUID, db: PostgresClient = Depends(get_db)) -> None:
    """Delete a grading criteria."""
    deleted = await db.delete_criteria(criteria_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Criteria not found.")


# =============================================================================
# Questions (nested under assignment)
# =============================================================================


@router.post(
    "/{assignment_id}/questions",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(assignment_id: UUID, body: QuestionCreate, db: PostgresClient = Depends(get_db)) -> QuestionOut:
    """Add a question to an assignment."""
    if not await db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")

    row = await db.create_question(
        assignment_id=assignment_id,
        question_text=body.question_text,
        criteria_id=body.criteria_id,
        competency=body.competency,
        difficulty=body.difficulty,
        expected_topics=body.expected_topics,
    )
    return QuestionOut(**row)


@router.get("/{assignment_id}/questions", response_model=list[QuestionOut])
async def list_questions(
    assignment_id: UUID,
    status_filter: str | None = Query(None, alias="status"),
    db: PostgresClient = Depends(get_db),
) -> list[QuestionOut]:
    """List questions for an assignment."""
    rows = await db.list_questions(assignment_id, status_filter=status_filter)
    return [QuestionOut(**r) for r in rows]


@router.put("/questions/{question_id}", response_model=QuestionOut)
async def update_question(question_id: UUID, body: QuestionUpdate, db: PostgresClient = Depends(get_db)) -> QuestionOut:
    """Update a question."""
    fields = body.model_dump(exclude_none=True)
    row = await db.update_question(question_id, **fields)
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")
    return QuestionOut(**row)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: UUID, db: PostgresClient = Depends(get_db)) -> None:
    """Delete a question."""
    deleted = await db.delete_question(question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found.")


@router.post(
    "/questions/bulk-status",
    summary="Bulk update question status",
)
async def bulk_update_status(
    question_ids: list[UUID],
    new_status: str = Query(..., pattern="^(draft|approved|rejected)$"),
    db: PostgresClient = Depends(get_db),
) -> dict:
    """Approve or reject multiple questions at once."""
    count = await db.bulk_update_question_status(question_ids, new_status)
    return {"updated": count, "status": new_status}