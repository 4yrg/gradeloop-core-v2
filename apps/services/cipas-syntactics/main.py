"""
CIPAS Syntactics Service - Syntactic Code Clone Detection API.

A FastAPI-based service for detecting syntactic code clones (Type-1/2/3) using:
- Pipeline: Syntactic similarity with automatic cascade detection
- Tree-sitter based CST parsing
- Machine learning classifier (XGBoost for Type-3)

Features:
- Multi-language support (Java, C, Python)
- Tree-sitter based CST parsing
- NiCad-style normalization for Type-1/2 detection
- TOMA approach with XGBoost for Type-3 detection
- Fast (~65x faster than neural approaches)
"""

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from clone_detection.utils.common_setup import setup_logging
from routes import (
    cluster_assignment,
    compare_codes,
    compare_codes_batch,
    get_collusion_report,
    get_feature_importance,
    get_health,
    get_index_status,
    ingest_submission,
    register_template,
    tokenize_code,
    get_similarity_report,
    create_annotation,
    get_annotations,
    update_annotation,
    get_annotation_stats,
    export_similarity_report_csv,
    get_similarity_report,
    create_annotation,
    get_annotations,
    update_annotation,
    get_annotation_stats,
    export_similarity_report_csv,
)
from schemas import (
    AssignmentClusterRequest,
    AssignmentClusterResponse,
    BatchComparisonRequest,
    BatchComparisonResult,
    CollusionReportResponse,
    ComparisonRequest,
    ComparisonResult,
    FeatureImportanceResponse,
    HealthResponse,
    IndexStatusResponse,
    IngestionResponse,
    SubmissionIngestRequest,
    TemplateRegisterRequest,
    TemplateRegisterResponse,
    TokenizeRequest,
    TokenizeResponse,
    CreateAnnotationRequest,
    UpdateAnnotationRequest,
    AnnotationResponse,
    AnnotationStatsResponse,
    SimilarityReportMetadata,
    CreateAnnotationRequest,
    UpdateAnnotationRequest,
    AnnotationResponse,
    AnnotationStatsResponse,
    SimilarityReportMetadata,
)

# Configure logging
logger = setup_logging(__name__)


# ---------------------------------------------------------------------------
# All DDL statements are idempotent (CREATE … IF NOT EXISTS / CREATE OR REPLACE).
# No external migration files are required — the schema is self-contained here.
# ---------------------------------------------------------------------------
_SCHEMA_DDL: list[tuple[str, str]] = [
    # ── assignment_templates ────────────────────────────────────────────────
    ("table:assignment_templates", """
        CREATE TABLE IF NOT EXISTS assignment_templates (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id     TEXT        NOT NULL,
            template_fragment_hashes  JSONB  NOT NULL DEFAULT '[]',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_assignment_templates_assignment_id", """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_templates_assignment_id
            ON assignment_templates (assignment_id)
    """),
    # ── fragments ───────────────────────────────────────────────────────────
    ("table:fragments", """
        CREATE TABLE IF NOT EXISTS fragments (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            submission_id     TEXT        NOT NULL,
            student_id        TEXT        NOT NULL,
            assignment_id     TEXT        NOT NULL,
            language          TEXT        NOT NULL CHECK (language IN ('java','python','c','csharp')),
            lsh_signature     BYTEA,
            abstract_tokens   JSONB       NOT NULL DEFAULT '[]',
            raw_source        TEXT        NOT NULL,
            token_count       INT         NOT NULL DEFAULT 0,
            byte_offset       INT         NOT NULL DEFAULT 0,
            fragment_type     TEXT        NOT NULL DEFAULT 'structural'
                                          CHECK (fragment_type IN ('structural','window','whole_file','regex_block')),
            node_type         TEXT,
            is_template       BOOLEAN     NOT NULL DEFAULT FALSE,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_fragments_submission_id",  "CREATE INDEX IF NOT EXISTS idx_fragments_submission_id  ON fragments (submission_id)"),
    ("index:idx_fragments_student_id",     "CREATE INDEX IF NOT EXISTS idx_fragments_student_id     ON fragments (student_id)"),
    ("index:idx_fragments_assignment_id",  "CREATE INDEX IF NOT EXISTS idx_fragments_assignment_id  ON fragments (assignment_id)"),
    ("index:idx_fragments_assignment_student", "CREATE INDEX IF NOT EXISTS idx_fragments_assignment_student ON fragments (assignment_id, student_id)"),
    # ── plagiarism_groups (must exist before clone_matches FK) ──────────────
    ("table:plagiarism_groups", """
        CREATE TABLE IF NOT EXISTS plagiarism_groups (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id     TEXT        NOT NULL,
            group_index       INT         NOT NULL,
            member_ids        JSONB       NOT NULL,
            edge_summary      JSONB,
            member_count      INT         NOT NULL DEFAULT 0,
            max_confidence    FLOAT       NOT NULL DEFAULT 0.0,
            dominant_type     TEXT        NOT NULL DEFAULT 'Unknown',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_plagiarism_groups_assignment", "CREATE INDEX IF NOT EXISTS idx_plagiarism_groups_assignment ON plagiarism_groups (assignment_id, group_index)"),
    # ── clone_matches ───────────────────────────────────────────────────────
    ("table:clone_matches", """
        CREATE TABLE IF NOT EXISTS clone_matches (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            frag_a_id         UUID        NOT NULL REFERENCES fragments(id) ON DELETE CASCADE,
            frag_b_id         UUID        NOT NULL REFERENCES fragments(id) ON DELETE CASCADE,
            student_a         TEXT        NOT NULL,
            student_b         TEXT        NOT NULL,
            assignment_id     TEXT        NOT NULL,
            clone_type        TEXT        NOT NULL DEFAULT 'Non-Syntactic'
                                          CHECK (clone_type IN ('Type-1','Type-2','Type-3','Non-Syntactic')),
            confidence        FLOAT       NOT NULL DEFAULT 0.0
                                          CHECK (confidence >= 0.0 AND confidence <= 1.0),
            is_clone          BOOLEAN     NOT NULL DEFAULT FALSE,
            features          JSONB,
            normalized_code_a TEXT,
            normalized_code_b TEXT,
            detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_clone_matches_pair UNIQUE (frag_a_id, frag_b_id)
        )
    """),
    ("index:idx_clone_matches_assignment",  "CREATE INDEX IF NOT EXISTS idx_clone_matches_assignment  ON clone_matches (assignment_id)"),
    ("index:idx_clone_matches_students",    "CREATE INDEX IF NOT EXISTS idx_clone_matches_students    ON clone_matches (student_a, student_b, assignment_id)"),
    ("index:idx_clone_matches_is_clone",    "CREATE INDEX IF NOT EXISTS idx_clone_matches_is_clone    ON clone_matches (assignment_id, is_clone) WHERE is_clone = TRUE"),
    ("index:idx_clone_matches_confidence",  "CREATE INDEX IF NOT EXISTS idx_clone_matches_confidence  ON clone_matches (assignment_id, confidence DESC) WHERE is_clone = TRUE"),
    # ── lsh_bucket_metadata ─────────────────────────────────────────────────
    ("table:lsh_bucket_metadata", """
        CREATE TABLE IF NOT EXISTS lsh_bucket_metadata (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            fragment_id       UUID        NOT NULL REFERENCES fragments(id) ON DELETE CASCADE,
            bucket_keys       JSONB       NOT NULL DEFAULT '[]',
            num_perm          INT         NOT NULL DEFAULT 128,
            threshold         FLOAT       NOT NULL DEFAULT 0.3,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_lsh_bucket_metadata_fragment", "CREATE INDEX IF NOT EXISTS idx_lsh_bucket_metadata_fragment ON lsh_bucket_metadata (fragment_id)"),
    # ── similarity_reports ──────────────────────────────────────────────────
    ("table:similarity_reports", """
        CREATE TABLE IF NOT EXISTS similarity_reports (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id     TEXT        NOT NULL,
            language          TEXT        NOT NULL CHECK (language IN ('java','python','c','csharp')),
            submission_count  INT         NOT NULL DEFAULT 0,
            processed_count   INT         NOT NULL DEFAULT 0,
            failed_count      INT         NOT NULL DEFAULT 0,
            total_clone_pairs INT         NOT NULL DEFAULT 0,
            report_data       JSONB       NOT NULL,
            lsh_threshold     FLOAT       NOT NULL DEFAULT 0.3,
            min_confidence    FLOAT       NOT NULL DEFAULT 0.0,
            processing_time_seconds FLOAT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_similarity_reports_assignment", "CREATE UNIQUE INDEX IF NOT EXISTS idx_similarity_reports_assignment ON similarity_reports (assignment_id)"),
    ("index:idx_similarity_reports_created",    "CREATE INDEX IF NOT EXISTS idx_similarity_reports_created    ON similarity_reports (created_at DESC)"),
    # ── instructor_annotations ──────────────────────────────────────────────
    ("table:instructor_annotations", """
        CREATE TABLE IF NOT EXISTS instructor_annotations (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            match_id          UUID        REFERENCES clone_matches(id) ON DELETE CASCADE,
            group_id          UUID        REFERENCES plagiarism_groups(id) ON DELETE CASCADE,
            assignment_id     TEXT        NOT NULL,
            instructor_id     TEXT        NOT NULL,
            status            TEXT        NOT NULL DEFAULT 'pending_review'
                                          CHECK (status IN (
                                              'pending_review',
                                              'confirmed_plagiarism',
                                              'false_positive',
                                              'acceptable_collaboration',
                                              'requires_investigation'
                                          )),
            comments          TEXT,
            action_taken      TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_annotation_target CHECK (match_id IS NOT NULL OR group_id IS NOT NULL)
        )
    """),
    ("index:idx_instructor_annotations_match",      "CREATE INDEX IF NOT EXISTS idx_instructor_annotations_match      ON instructor_annotations (match_id)"),
    ("index:idx_instructor_annotations_group",      "CREATE INDEX IF NOT EXISTS idx_instructor_annotations_group      ON instructor_annotations (group_id)"),
    ("index:idx_instructor_annotations_assignment", "CREATE INDEX IF NOT EXISTS idx_instructor_annotations_assignment ON instructor_annotations (assignment_id)"),
    ("index:idx_instructor_annotations_status",     "CREATE INDEX IF NOT EXISTS idx_instructor_annotations_status     ON instructor_annotations (assignment_id, status)"),
    # ── report_exports ──────────────────────────────────────────────────────
    ("table:report_exports", """
        CREATE TABLE IF NOT EXISTS report_exports (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            report_id         UUID        NOT NULL REFERENCES similarity_reports(id) ON DELETE CASCADE,
            assignment_id     TEXT        NOT NULL,
            instructor_id     TEXT        NOT NULL,
            export_format     TEXT        NOT NULL CHECK (export_format IN ('pdf', 'csv', 'json')),
            include_annotations BOOLEAN   NOT NULL DEFAULT TRUE,
            include_code      BOOLEAN     NOT NULL DEFAULT FALSE,
            export_filters    JSONB,
            exported_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """),
    ("index:idx_report_exports_report",     "CREATE INDEX IF NOT EXISTS idx_report_exports_report     ON report_exports (report_id)"),
    ("index:idx_report_exports_assignment", "CREATE INDEX IF NOT EXISTS idx_report_exports_assignment ON report_exports (assignment_id)"),
    # ── views ───────────────────────────────────────────────────────────────
    ("view:confirmed_clones_summary", """
        CREATE OR REPLACE VIEW confirmed_clones_summary AS
        SELECT cm.assignment_id, cm.student_a, cm.student_b, cm.clone_type, cm.confidence,
               cm.detected_at, f_a.submission_id AS submission_a, f_b.submission_id AS submission_b
        FROM clone_matches cm
        JOIN fragments f_a ON f_a.id = cm.frag_a_id
        JOIN fragments f_b ON f_b.id = cm.frag_b_id
        WHERE cm.is_clone = TRUE
        ORDER BY cm.assignment_id, cm.confidence DESC
    """),
    ("view:annotated_clones_summary", """
        CREATE OR REPLACE VIEW annotated_clones_summary AS
        SELECT cm.id AS match_id, cm.assignment_id, cm.student_a, cm.student_b,
               cm.clone_type, cm.confidence, ia.status AS annotation_status,
               ia.comments AS annotation_comments, ia.instructor_id,
               ia.updated_at AS annotated_at, cm.detected_at
        FROM clone_matches cm
        LEFT JOIN instructor_annotations ia ON ia.match_id = cm.id
        WHERE cm.is_clone = TRUE
        ORDER BY cm.assignment_id, cm.confidence DESC
    """),
    # ── helper function ──────────────────────────────────────────────────────
    ("function:get_cluster_stats", """
        CREATE OR REPLACE FUNCTION get_cluster_stats(p_assignment_id TEXT)
        RETURNS TABLE (
            total_submissions BIGINT, total_clones BIGINT,
            high_risk_count BIGINT, medium_risk_count BIGINT,
            low_risk_count BIGINT, flagged_students BIGINT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                COUNT(DISTINCT f.submission_id),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence >= 0.85),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence >= 0.75 AND cm.confidence < 0.85),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence < 0.75),
                COUNT(DISTINCT CASE WHEN cm.is_clone = TRUE THEN cm.student_a END) +
                COUNT(DISTINCT CASE WHEN cm.is_clone = TRUE THEN cm.student_b END)
            FROM fragments f
            LEFT JOIN clone_matches cm ON (cm.frag_a_id = f.id OR cm.frag_b_id = f.id)
                AND cm.assignment_id = p_assignment_id
            WHERE f.assignment_id = p_assignment_id;
        END;
        $$ LANGUAGE plpgsql
    """),
]


async def _auto_migrate() -> None:
    """Apply all schema DDL inline (idempotent). No external SQL files needed."""
    try:
        from database import get_db_connection
    except RuntimeError:
        return
    for name, ddl in _SCHEMA_DDL:
        try:
            async with get_db_connection() as conn:
                await conn.execute(ddl)
            logger.debug("Schema applied: %s", name)
        except Exception as exc:
            logger.warning("Schema step %s skipped: %s", name, exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Runs setup on startup and cleanup on shutdown.
    """
    # Startup: Load models and initialize database
    # Startup: Load models and initialize database
    logger.info("Starting CIPAS Syntactics Service...")
    logger.info("Loading pre-trained syntactic model...")

    from routes import _get_model_status, _load_syntactic_model
    from database import init_db_pool, close_db_pool

    # Initialize database connection pool and run migrations
    try:
        await init_db_pool()
        logger.info("Database connection pool initialized successfully")
        await _auto_migrate()
    except Exception as e:
        logger.warning(
            f"Failed to initialize database pool: {e}. Running without persistence."
        )

    # Force load syntactic model
    _load_syntactic_model()

    models = _get_model_status()
    for model_name, model_status in models.items():
        if model_status.available:
            logger.info(
                f"Model {model_name}: available={model_status.available}, loaded={model_status.loaded}"
            )
        else:
            logger.warning(f"Model {model_name}: not available ({model_status.error})")

    yield

    # Shutdown: Cleanup
    logger.info("Shutting down CIPAS Syntactics Service...")
    try:
        await close_db_pool()
        logger.info("Database connection pool closed successfully")
    except Exception as e:
        logger.warning(f"Error closing database pool: {e}")
    try:
        await close_db_pool()
        logger.info("Database connection pool closed successfully")
    except Exception as e:
        logger.warning(f"Error closing database pool: {e}")


app = FastAPI(
    title="CIPAS Syntactics Service",
    description="""
## Syntactic Code Clone Detection Service

CIPAS Syntactics provides syntactic code clone detection for **Type-1, Type-2, and Type-3 clones**
using an automatic cascade detection pipeline.

### Automatic Cascade Detection

The service uses a three-tier cascade strategy:

**Phase One: NiCad-Style Normalization**
- **Pass A**: Literal comparison (Type-1, threshold ≥ 0.98)
- **Pass B**: Blinded comparison (Type-2, threshold ≥ 0.95)

**Phase Two: TOMA Approach (Type-3)**
- Token Frequency Vector + Token Sequence Stream
- XGBoost classification with 6 syntactic features

### Detection Characteristics

| Clone Type | Detection Method | Confidence |
|------------|-----------------|------------|
| **Type-1** | Literal CST comparison | 1.0 (exact) |
| **Type-2** | Blinded CST comparison | ~0.95-0.99 |
| **Type-3** | TOMA + XGBoost | XGBoost probability |

### Supported Languages
- Java
- C
- Python

### Performance
- **Fast**: ~65x faster than neural network approaches
- **Accurate**: F1 score 90%+ for Type-3 clones
- **Early Exit**: Type-1/2 clones detected in <10ms

## Quick Start

1. **Compare two code snippets**:
   ```
   POST /api/v1/syntactics/compare
   ```

2. **Check service health**:
   ```
   GET /api/v1/syntactics/health
   ```

3. **Tokenize code**:
   ```
   POST /api/v1/syntactics/tokenize
   ```
    """,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: gateway (Traefik) adds headers when deployed; app middleware for standalone dev
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Create router with prefix
api_router = APIRouter(prefix="/api/v1/syntactics")


@api_router.get(
    "/",
    response_model=dict,
    tags=["Root"],
    summary="Root endpoint",
)
async def root():
    """Root endpoint with service information."""
    return {
        "service": "CIPAS Syntactics - Syntactic Code Clone Detection Service",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@api_router.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health check",
)
async def health_check():
    """
    Check service health and model availability.

    Returns the status of the service and syntactic ML model.
    """
    return get_health()


@api_router.post(
    "/compare",
    response_model=ComparisonResult,
    tags=["Comparison"],
    summary="Compare two code snippets",
    responses={
        200: {"description": "Successful comparison"},
        503: {"description": "Model not available"},
        500: {"description": "Comparison failed"},
    },
)
async def compare_two_codes(request: ComparisonRequest):
    """
    Compare two code snippets to detect if they are syntactic clones.

    ## Features:
    - **Multi-language**: Java, C, Python
    - **Automatic cascade**: Type-1 → Type-2 → Type-3 detection
    - **Confidence score**: ML-based probability
    - **Clone type**: Automatic classification (Type-1/2/3)

    ## Example:
    ```json
    {
        "code1": "public int foo(int x) { return x + 1; }",
        "code2": "public int bar(int y) { return y + 1; }",
        "language": "java"
    }
    ```
    """
    return compare_codes(request)


@api_router.post(
    "/compare/batch",
    response_model=BatchComparisonResult,
    tags=["Comparison"],
    summary="Batch compare multiple code pairs",
)
async def compare_codes_batch_endpoint(request: BatchComparisonRequest):
    """
    Compare multiple code pairs in a single request.

    Useful for bulk analysis or dataset processing.
    Each pair is processed independently, and errors in one pair
    won't affect others.
    """
    return compare_codes_batch(request)


@api_router.get(
    "/feature-importance",
    response_model=FeatureImportanceResponse,
    tags=["Models"],
    summary="Get feature importance scores",
)
async def get_importance():
    """
    Get feature importance from the syntactic model.

    Shows which features contribute most to Type-3 clone detection decisions.
    Features include: Jaccard, Dice, Levenshtein distance/ratio, Jaro, Jaro-Winkler.
    """
    return get_feature_importance()


@api_router.post(
    "/tokenize",
    response_model=TokenizeResponse,
    tags=["Utilities"],
    summary="Tokenize source code",
)
async def tokenize_code_endpoint(request: TokenizeRequest):
    """
    Tokenize source code using Tree-sitter CST parsing.

    ## Features:
    - Language-aware tokenization
    - Optional identifier abstraction (variables → 'V')
    - Handles Java, C, and Python

    ## Example:
    ```json
    {
        "code": "int x = calculate(a, b);",
        "language": "java",
        "abstract_identifiers": true
    }
    ```

    Returns: `["int", "V", "=", "V", "(", "V", ",", "V", ")"]`
    """
    return tokenize_code(request)


# Additional helper endpoints
@api_router.get(
    "/models",
    response_model=dict,
    tags=["Models"],
    summary="Get model status",
)
async def get_models_status():
    """Get detailed status of all ML models."""
    from routes import _get_model_status

    return {"models": _get_model_status()}


@api_router.get(
    "/ready",
    response_model=dict,
    tags=["Health"],
    summary="Readiness check",
)
async def readiness_check():
    """
    Check if the service is ready to accept requests.

    This endpoint verifies that:
    - The application is running
    - Syntactic ML model is loaded
    - All dependencies are available
    """
    from routes import _get_model_status

    models = _get_model_status()
    all_models_ready = all(
        model_status.available and model_status.loaded
        for model_status in models.values()
    )

    if all_models_ready:
        return {"status": "ready", "models_loaded": True}
    else:
        return {
            "status": "starting",
            "models_loaded": False,
            "details": models,
        }


# ── Phase 1–4 Pipeline Endpoints ────────────────────────────────────────────


@api_router.post(
    "/submissions/ingest",
    response_model=IngestionResponse,
    tags=["Pipeline"],
    summary="Ingest a student submission",
    responses={
        200: {"description": "Submission processed successfully"},
        500: {"description": "Ingestion failed"},
    },
)
async def ingest_submission_endpoint(request: SubmissionIngestRequest):
    """
    Run a student submission through the full Phase 1–4 pipeline:

    1. **Segmentation** — structural blocks + sliding windows
    2. **Template Filtering** — discard instructor skeleton fragments
    3. **LSH Indexing** — 128-permutation MinHash signature + bucket insertion
    4. **Candidate Retrieval** — query LSH buckets (O(1), ~95 % reduction)
    5. **Cascade Detection** — Type-1 → Type-2 → Type-3 (XGBoost)
    6. **Graph Update** — add confirmed edges to the collusion graph

    Returns fragment count, candidate pairs, and confirmed clone matches.
    """
    return ingest_submission(request)


@api_router.post(
    "/templates/register",
    response_model=TemplateRegisterResponse,
    tags=["Pipeline"],
    summary="Register instructor skeleton code",
)
async def register_template_endpoint(request: TemplateRegisterRequest):
    """
    Register instructor-provided skeleton / starter code for an assignment.

    Student fragments whose abstract token Jaccard similarity against any
    template fragment is ≥ 0.90 are silently discarded during ingestion,
    preventing false positives from shared starter code.
    """
    return register_template(request)


@api_router.get(
    "/collusion-report",
    response_model=CollusionReportResponse,
    tags=["Pipeline"],
    summary="Get collusion groups (connected components)",
)
async def collusion_report_endpoint(
    assignment_id: str | None = None,
    min_confidence: float = 0.0,
):
    """
    Compute connected components of the student clone graph.

    Each group represents a **potential collusion ring**: students whose
    submissions share confirmed clone fragments (Type-1, 2, or 3).

    Groups are ordered by size (largest first) then by maximum edge confidence.

    - ``min_confidence`` — filter out low-confidence edges (e.g. set 0.7 to
      see only high-confidence Type-3 matches).
    """
    return get_collusion_report(
        assignment_id=assignment_id, min_confidence=min_confidence
    )


@api_router.get(
    "/index/status",
    response_model=IndexStatusResponse,
    tags=["Pipeline"],
    summary="MinHash LSH index statistics",
)
async def index_status_endpoint():
    """
    Return statistics about the in-memory MinHash LSH index.

    Shows how many fragments are indexed, the Jaccard threshold used for
    bucketing, and the number of permutations in each signature.
    """
    return get_index_status()


@api_router.post(
    "/assignments/cluster",
    response_model=AssignmentClusterResponse,
    tags=["Pipeline"],
    summary="Cluster all submissions for an assignment",
    responses={
        200: {"description": "Clustering completed successfully"},
        500: {"description": "Clustering failed"},
    },
)
async def cluster_assignment_endpoint(request: AssignmentClusterRequest):
    """
    Send all student submissions for one assignment and receive back
    the **clone clusters** (potential collusion groups).

    ## Pipeline (per submission)
    1. **Segmentation** — split into structural blocks + sliding windows
    2. **Template Filtering** — discard fragments matching the instructor template
    3. **LSH Indexing** — 128-permutation MinHash + bucket insertion
    4. **Candidate Retrieval** — O(1) LSH query (~95 % workload reduction)
    5. **Cascade Detection** — Type-1 → Type-2 → Type-3 (XGBoost)
    6. **Graph Update** — confirmed pairs added to an isolated collusion graph

    Each call uses a **fresh, isolated pipeline** — results are self-contained
    and do not affect the global incremental-ingestion index.

    ## Example
    ```json
    {
      "assignment_id": "hw3",
      "language": "java",
      "instructor_template": "public class Solution { /* starter */ }",
      "submissions": [
        { "submission_id": "s1", "student_id": "alice", "source_code": "..." },
        { "submission_id": "s2", "student_id": "bob",   "source_code": "..." }
      ]
    }
    ```

    ## Response
    - `collusion_groups` — connected components of the clone graph; each group
      lists the students and the clone edges between them.
    - `per_submission` — fragment / candidate / clone counts per student.
    """
    start = time.monotonic()
    response = await asyncio.to_thread(cluster_assignment, request)
    processing_time = time.monotonic() - start
    try:
        from repositories import SimilarityReportRepository

        await SimilarityReportRepository.save_report(
            report=response,
            lsh_threshold=request.lsh_threshold,
            min_confidence=request.min_confidence,
            processing_time=processing_time,
        )
        logger.info(
            "Persisted similarity report for assignment %s", request.assignment_id
        )
    except Exception as exc:
        logger.warning(
            "Failed to persist similarity report for %s: %s. Report still returned.",
            request.assignment_id,
            exc,
        )
    return response


# ── Similarity Reports & Annotations ────────────────────────────────────────


@api_router.get(
    "/reports/{assignment_id}",
    response_model=AssignmentClusterResponse,
    tags=["Reports"],
    summary="Get cached similarity report",
    responses={
        200: {"description": "Cached report retrieved successfully"},
        404: {"description": "Report not found"},
        500: {"description": "Database error"},
    },
)
async def get_similarity_report_endpoint(assignment_id: str):
    """
    Retrieve a cached similarity report for an assignment.

    Returns the full AssignmentClusterResponse if a report has been
    previously generated and persisted. If no report exists, returns 404.

    Use this endpoint to avoid re-running expensive clustering analysis
    when displaying the similarity dashboard to instructors.
    """
    return await get_similarity_report(assignment_id)


@api_router.get(
    "/reports/{assignment_id}/metadata",
    response_model=SimilarityReportMetadata,
    tags=["Reports"],
    summary="Get similarity report metadata",
    responses={
        200: {"description": "Report metadata retrieved"},
        404: {"description": "Report not found"},
    },
)
async def get_report_metadata_endpoint(assignment_id: str):
    """
    Get metadata about a cached similarity report without loading
    the full report data.

    Returns summary information like submission count, clone pairs,
    processing time, etc. Useful for dashboard previews.
    """
    from repositories import SimilarityReportRepository

    metadata = await SimilarityReportRepository.get_report_metadata(assignment_id)
    if metadata is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No similarity report found for assignment {assignment_id}",
        )
    return metadata


@api_router.post(
    "/annotations",
    response_model=AnnotationResponse,
    tags=["Annotations"],
    summary="Create instructor annotation",
    responses={
        201: {"description": "Annotation created successfully"},
        400: {"description": "Invalid request"},
        500: {"description": "Database error"},
    },
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation_endpoint(request: CreateAnnotationRequest):
    """
    Create a new instructor annotation for a clone match or plagiarism group.

    Instructors can mark matches as:
    - **Pending Review**: Needs further investigation
    - **Confirmed Plagiarism**: Academic integrity violation confirmed
    - **False Positive**: Not actually plagiarism
    - **Acceptable Collaboration**: Within allowed collaboration guidelines
    - **Requires Investigation**: Flagged for deeper review

    Either `match_id` or `group_id` must be provided.
    """
    return await create_annotation(request)


@api_router.patch(
    "/annotations/{annotation_id}",
    response_model=AnnotationResponse,
    tags=["Annotations"],
    summary="Update instructor annotation",
    responses={
        200: {"description": "Annotation updated successfully"},
        404: {"description": "Annotation not found"},
        500: {"description": "Database error"},
    },
)
async def update_annotation_endpoint(
    annotation_id: str, request: UpdateAnnotationRequest
):
    """
    Update an existing instructor annotation.

    Can update status, comments, and/or action taken.
    """
    return await update_annotation(annotation_id, request)


@api_router.get(
    "/annotations/assignment/{assignment_id}",
    response_model=list[AnnotationResponse],
    tags=["Annotations"],
    summary="Get annotations for assignment",
    responses={
        200: {"description": "Annotations retrieved successfully"},
        500: {"description": "Database error"},
    },
)
async def get_annotations_for_assignment_endpoint(
    assignment_id: str, status: str | None = None
):
    """
    Get all instructor annotations for an assignment.

    Optionally filter by annotation status (e.g., 'confirmed_plagiarism').
    """
    return await get_annotations(assignment_id, status)


@api_router.get(
    "/annotations/assignment/{assignment_id}/stats",
    response_model=AnnotationStatsResponse,
    tags=["Annotations"],
    summary="Get annotation statistics",
    responses={
        200: {"description": "Statistics retrieved successfully"},
        500: {"description": "Database error"},
    },
)
async def get_annotation_stats_endpoint(assignment_id: str):
    """
    Get statistics about annotations for an assignment.

    Returns counts by status: pending_review, confirmed_plagiarism,
    false_positive, acceptable_collaboration, requires_investigation.
    """
    return await get_annotation_stats(assignment_id)


@api_router.get(
    "/reports/{assignment_id}/export.csv",
    summary="Export similarity report as CSV",
    tags=["Similarity Reports"],
    responses={
        200: {"description": "CSV file downloaded", "content": {"text/csv": {}}},
        404: {"description": "Report not found"},
        500: {"description": "Export failed"},
    },
)
async def export_report_csv_endpoint(assignment_id: str):
    """
    Export the similarity report for an assignment as a CSV file.

    The CSV includes cluster information and all edges with their
    similarity scores, clone types, and related metadata.
    """
    return await export_similarity_report_csv(assignment_id)


# Include router in app
app.include_router(api_router)


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.getenv("CIPAS_SYNTACTICS_PORT", 8086))
    host = os.getenv("CIPAS_SYNTACTICS_HOST", "0.0.0.0")

    uvicorn.run(app, host=host, port=port)
