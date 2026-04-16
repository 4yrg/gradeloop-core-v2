"""Competency management routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import get_settings
from app.dependencies import get_db
from app.schemas.competency import (
    CompetencyAssignmentLinkOut,
    CompetencyOut,
    CompetencyScoreOut,
    CompetencyScoreSummary,
    CreateCompetencyRequest,
    GenerateCompetenciesRequest,
    GenerateCompetenciesResponse,
    GeneratedCompetency,
    OverrideScoreRequest,
    SetCompetenciesRequest,
)
from app.services.storage.postgres_client import PostgresClient

router = APIRouter(prefix="/competencies", tags=["competencies"])


# =============================================================================
# Competency CRUD (global)
# =============================================================================

@router.get("", response_model=list[CompetencyOut])
async def list_competencies(db: PostgresClient = Depends(get_db)) -> list[CompetencyOut]:
    """Return all available competencies."""
    rows = await db.list_competencies()
    return [CompetencyOut(**r) for r in rows]


@router.post("", response_model=CompetencyOut, status_code=status.HTTP_201_CREATED)
async def create_competency(body: CreateCompetencyRequest, db: PostgresClient = Depends(get_db)) -> CompetencyOut:
    """Create a new competency."""
    row = await db.upsert_competency(
        name=body.name,
        description=body.description,
        difficulty=body.difficulty,
        max_score=body.max_score,
    )
    return CompetencyOut(**row)


@router.delete("/{competency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_competency(competency_id: UUID, db: PostgresClient = Depends(get_db)) -> None:
    """Delete a competency and unlink it from all assignments."""
    deleted = await db.delete_competency(competency_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Competency not found.")


@router.put("/{competency_id}", response_model=CompetencyOut)
async def update_competency(competency_id: UUID, body: CreateCompetencyRequest, db: PostgresClient = Depends(get_db)) -> CompetencyOut:
    """Update an existing competency by ID."""
    row = await db.update_competency(
        competency_id=competency_id,
        name=body.name,
        description=body.description,
        difficulty=body.difficulty,
        max_score=body.max_score,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Competency not found.")
    return CompetencyOut(**row)


# =============================================================================
# Competency-Assignment linking
# =============================================================================

@router.get("/assignment/{assignment_id}", response_model=list[CompetencyAssignmentLinkOut])
async def list_assignment_competencies(assignment_id: UUID, db: PostgresClient = Depends(get_db)) -> list[CompetencyAssignmentLinkOut]:
    """Return all competencies configured for a given assignment."""
    rows = await db.list_assignment_competencies(assignment_id)
    return [CompetencyAssignmentLinkOut(**r) for r in rows]


@router.post("/assignment/{assignment_id}/set", response_model=list[CompetencyAssignmentLinkOut])
async def set_assignment_competencies(
    assignment_id: UUID,
    body: SetCompetenciesRequest,
    db: PostgresClient = Depends(get_db),
) -> list[CompetencyAssignmentLinkOut]:
    """Replace all competencies for an assignment.

    Each entry must reference a competency_id that already exists.
    """
    await db.set_assignment_competencies(
        assignment_id,
        [{"competency_id": e.competency_id, "weight": e.weight} for e in body.competencies],
    )
    # Re-fetch with the JOIN to include competency details (name, difficulty, etc.)
    rows = await db.list_assignment_competencies(assignment_id)
    return [CompetencyAssignmentLinkOut(**r) for r in rows]


# =============================================================================
# AI competency generation
# =============================================================================

@router.post("/generate", response_model=GenerateCompetenciesResponse)
async def generate_competencies(
    body: GenerateCompetenciesRequest,
) -> GenerateCompetenciesResponse:
    """Generate competency suggestions from an assignment's code and description.

    Calls the AI model to suggest relevant competencies based on the
    assignment context.
    """
    settings = get_settings()

    from app.services.viva.competency_generator import generate_competencies_ai

    try:
        generated = await generate_competencies_ai(
            gemini_api_key=settings.gemini_api_key,
            model=settings.gemini_grader_model,
            code_context=body.code_context or "",
            description=body.description or "",
            title=body.title or "",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI competency generation failed: {exc}",
        )

    return GenerateCompetenciesResponse(competencies=generated)


# =============================================================================
# Competency scores
# =============================================================================

@router.get("/scores/student/{student_id}", response_model=list[CompetencyScoreOut])
async def list_student_competency_scores(
    student_id: str,
    assignment_id: UUID | None = Query(default=None),
    db: PostgresClient = Depends(get_db),
) -> list[CompetencyScoreOut]:
    """Return competency scores for a student, optionally filtered by assignment."""
    rows = await db.list_student_competency_scores(student_id, assignment_id=assignment_id)
    return [CompetencyScoreOut(**r) for r in rows]


@router.get("/scores/assignment/{assignment_id}", response_model=list[CompetencyScoreSummary])
async def list_competency_scores_for_assignment(
    assignment_id: UUID,
    db: PostgresClient = Depends(get_db),
) -> list[CompetencyScoreSummary]:
    """Return competency scores per student for a given assignment.

    Aggregates across sessions and shows who needs help in which area.
    """
    rows = await db.list_competency_scores_for_assignment(assignment_id)
    return [CompetencyScoreSummary(**r) for r in rows]


@router.get("/scores/competency/{competency_id}", response_model=list[dict])
async def list_students_by_competency(
    competency_id: UUID,
    assignment_id: UUID | None = Query(default=None),
    db: PostgresClient = Depends(get_db),
) -> list[dict]:
    """Return all students with their scores for a given competency.

    Optionally filter by assignment. Results are sorted by avg_score ascending
    (lowest-scoring students first — those who need most help).
    """
    rows = await db.list_students_by_competency(competency_id, assignment_id)
    return rows


@router.post("/scores/override", response_model=CompetencyScoreOut)
async def override_competency_score(body: OverrideScoreRequest, db: PostgresClient = Depends(get_db)) -> CompetencyScoreOut:
    """Override a competency score for a student (instructor manual correction)."""
    row = await db.override_competency_score(
        student_id=body.student_id,
        competency_id=body.competency_id,
        new_score=body.new_score,
        override_by=body.override_by,
    )
    return CompetencyScoreOut(**row)