# gradeloop-core-v2/apps/services/cipas-service/src/cipas/api/v1/routes/normalization.py
"""
Normalization route handlers for the CIPAS syntactic normalization API (E10/US02).

Endpoints:
  POST   /api/v1/cipas/normalize
      Normalize a single source code granule through the full Type-1 + Type-2
      pipeline. Returns both normalized forms and their SHA-256 hashes.

  POST   /api/v1/cipas/normalize/batch
      Normalize a list of granules concurrently (up to NORMALIZATION_BATCH_SIZE).
      Returns results in the same order as the input list.

  GET    /api/v1/cipas/normalize/health
      Return the health status of the NormalizationService (executor + Redis).

Design principles:
  - Route handlers are thin: validate HTTP inputs, delegate to NormalizationService,
    shape the response. No pipeline logic lives here.
  - source_bytes is derived from source_text.encode("utf-8") so callers do not
    need to POST raw binary data. The JSON body always carries source_text (str).
  - Empty source_text is rejected at the request validation layer (min_length=1)
    to avoid unnecessary worker round-trips for empty granules.
  - Batch endpoint enforces NORMALIZATION_BATCH_SIZE at request validation time
    (validator on NormalizeBatchRequest) so oversized batches get HTTP 422 before
    any worker is touched.
  - NormalizationError from the service is caught here and translated to a
    structured HTTP 422/500 response matching the RFC 7807 ProblemDetail schema
    used by all CIPAS endpoints.

Request/response schemas:
  NormalizeRequest           — single-granule input (JSON body)
  NormalizeBatchRequest      — batch input (JSON body, list of NormalizeRequest)
  NormalizedResultResponse   — single-granule output (mirrors NormalizedResult)
  NormalizeBatchResponse     — batch output

Route prefix:
  The router uses prefix="/cipas" and is mounted under /api/v1 in main.py,
  giving full paths of /api/v1/cipas/normalize and /api/v1/cipas/normalize/batch.
  This is consistent with the existing /api/v1/cipas/submissions prefix.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from cipas.api.v1.deps.normalization import NormalizationServiceDep
from cipas.core.config import get_settings
from cipas.normalization.models import (
    SUPPORTED_LANGUAGES,
    NormalizationError,
    NormalizationRequest,
    NormalizedResult,
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/cipas",
    tags=["normalization"],
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "NormalizationService is unavailable (still warming up or failed)"
        },
        status.HTTP_422_UNPROCESSABLE_ENTITY: {
            "description": "Request validation failed (bad language, empty source, etc.)"
        },
    },
)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class NormalizeRequest(BaseModel):
    """
    Single-granule normalization request body.

    source_text is the decoded source code of the granule (UTF-8 string).
    source_bytes are derived automatically from source_text.encode("utf-8"),
    so callers do not need to transmit raw bytes over the HTTP boundary.

    Fields
    ──────
    granule_id   Opaque identifier for this granule (UUID or composite key).
                 Drives the Redis cache key: cipas:normalized:{granule_id}.
    language     Source language: "python" | "java" | "c" (case-insensitive).
    source_text  Decoded UTF-8 source code of the granule.
                 Must be non-empty; whitespace-only sources are accepted (the
                 pipeline will produce empty normalized output and skip with
                 a debug log).
    """

    model_config = ConfigDict(frozen=True)

    granule_id: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Opaque granule identifier (UUID string or composite key)",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    language: str = Field(
        ...,
        description="Source language: python | java | c (case-insensitive)",
        examples=["python"],
    )
    source_text: str = Field(
        ...,
        min_length=1,
        description="Decoded UTF-8 source code of the granule",
        examples=["def add(a, b):\n    # returns sum\n    return a + b\n"],
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        lowered = v.lower().strip()
        if lowered not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language {v!r}. "
                f"Supported languages: {sorted(SUPPORTED_LANGUAGES)}"
            )
        return lowered

    @field_validator("granule_id")
    @classmethod
    def validate_granule_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("granule_id must not be blank or whitespace-only")
        return stripped

    def to_normalization_request(self) -> NormalizationRequest:
        """
        Convert to the pipeline-internal NormalizationRequest model.

        Derives source_bytes by encoding source_text as UTF-8.  This matches
        the production ingestion path where source bytes come directly from the
        uploaded file content.
        """
        source_bytes = self.source_text.encode("utf-8")
        return NormalizationRequest(
            granule_id=self.granule_id,
            language=self.language,
            source_text=self.source_text,
            source_bytes=source_bytes,
        )


class NormalizeBatchRequest(BaseModel):
    """
    Batch normalization request body.

    Wraps a list of NormalizeRequest items.  The batch size is validated
    against the service's NORMALIZATION_BATCH_SIZE setting at request time.
    The limit is enforced here via the validator rather than in the service
    so oversized batches get HTTP 422 before any worker is consumed.

    Results are returned in the same order as the input granules list.
    """

    model_config = ConfigDict(frozen=True)

    granules: list[NormalizeRequest] = Field(
        ...,
        min_length=1,
        description="List of granules to normalize (1 to NORMALIZATION_BATCH_SIZE items)",
    )

    @model_validator(mode="after")
    def validate_batch_size(self) -> NormalizeBatchRequest:
        """
        Guard against oversized batches.

        Reads NORMALIZATION_BATCH_SIZE from settings at validation time.
        Using get_settings() (cached singleton) here is safe — it is the same
        approach used by other route validators in the ingestion module.
        """
        try:
            settings = get_settings()
            limit = settings.NORMALIZATION_BATCH_SIZE
        except Exception:
            # If settings is unavailable at validation time (e.g. in tests
            # with no env vars set), fall back to a sane default.
            limit = 64

        if len(self.granules) > limit:
            raise ValueError(
                f"Batch size {len(self.granules)} exceeds the maximum of {limit} "
                f"granules per request (NORMALIZATION_BATCH_SIZE={limit}). "
                f"Split into smaller batches and retry."
            )
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class NormalizedResultResponse(BaseModel):
    """
    HTTP response body for a successfully normalized granule.

    Mirrors NormalizedResult but is a separate Pydantic model so we can
    add API-specific fields (e.g. processing_ms) without polluting the
    pipeline's internal model.

    All hash fields are 64-character lowercase SHA-256 hex strings.
    """

    model_config = ConfigDict(frozen=True)

    granule_id: str = Field(
        ..., description="Opaque granule identifier (echoed from request)"
    )
    language: str = Field(..., description="Source language (echoed from request)")
    type1: str = Field(
        ...,
        description="Type-1 normalized source: comments stripped, pretty-printed",
    )
    type2: str = Field(
        ...,
        description=(
            "Type-2 normalized source: Type-1 output with identifiers and "
            "literals replaced by canonical tokens (VAR_N, PARAM_N, FUNC_N, LIT_<sha1>)"
        ),
    )
    hash_type1: str = Field(
        ...,
        description="SHA-256 hex digest of the type1 field (64 lowercase hex chars)",
    )
    hash_type2: str = Field(
        ...,
        description="SHA-256 hex digest of the type2 field (64 lowercase hex chars)",
    )
    normalized_at: str = Field(
        ...,
        description="ISO-8601 UTC timestamp when normalization completed",
    )
    processing_ms: float = Field(
        ...,
        description="Wall-clock time in milliseconds from request receipt to response (includes Redis I/O)",
        ge=0.0,
    )

    @classmethod
    def from_normalized_result(
        cls,
        result: NormalizedResult,
        processing_ms: float,
    ) -> NormalizedResultResponse:
        """
        Build a response from a pipeline NormalizedResult.

        Args:
            result:        The NormalizedResult produced by NormalizationService.
            processing_ms: Wall-clock duration of the entire request in ms.

        Returns:
            NormalizedResultResponse ready for JSON serialisation.
        """
        return cls(
            granule_id=result.granule_id,
            language=result.language,
            type1=result.type1,
            type2=result.type2,
            hash_type1=result.hash_type1,
            hash_type2=result.hash_type2,
            normalized_at=result.normalized_at,
            processing_ms=round(processing_ms, 3),
        )


class NormalizeBatchResponse(BaseModel):
    """
    HTTP response body for a batch normalization request.

    results is in the same order as the input granules list.
    total, succeeded, and failed provide a quick summary without requiring
    the client to iterate all results.
    """

    model_config = ConfigDict(frozen=True)

    total: int = Field(..., description="Number of granules in the request batch", ge=0)
    succeeded: int = Field(
        ..., description="Number of granules successfully normalized", ge=0
    )
    failed: int = Field(
        ..., description="Number of granules that failed normalization", ge=0
    )
    processing_ms: float = Field(
        ...,
        description="Total wall-clock time for the entire batch in milliseconds",
        ge=0.0,
    )
    results: list[NormalizedResultResponse | None] = Field(
        ...,
        description=(
            "Normalized results in input order. "
            "Failed granules are represented as null entries."
        ),
    )


# ---------------------------------------------------------------------------
# POST /api/v1/cipas/normalize  (single granule)
# ---------------------------------------------------------------------------


@router.post(
    "/normalize",
    summary="Normalize a single code granule (Type-1 + Type-2)",
    response_model=NormalizedResultResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": (
                "Granule successfully normalized. "
                "Response contains both normalized forms and their SHA-256 hashes."
            )
        },
        422: {
            "description": "Validation error: unsupported language, empty source, or bad granule_id"
        },
        500: {"description": "Internal normalization error (worker crash or timeout)"},
        503: {"description": "NormalizationService unavailable"},
    },
)
async def normalize_granule(
    body: NormalizeRequest,
    svc: NormalizationServiceDep,
) -> NormalizedResultResponse:
    """
    Normalize a single source code granule through the CIPAS Type-1 + Type-2 pipeline.

    **Type-1 normalization** (cosmetic):
    - Strips all comments and docstrings using tree-sitter CST analysis.
    - Pretty-prints using the language-canonical formatter:
      - Python → black (≥24.x)
      - Java   → google-java-format
      - C      → clang-format (GNU/K&R style)
    - Produces `type1` and `hash_type1`.

    **Type-2 normalization** (structural):
    - Runs on the Type-1 output.
    - Replaces user-defined identifiers with canonical tokens:
      - Function names → `FUNC_1`, `FUNC_2`, …
      - Parameters     → `PARAM_1`, `PARAM_2`, …
      - Variables      → `VAR_1`, `VAR_2`, …
      - Literals       → `LIT_<sha1_6hex>` (e.g., `42` → `LIT_a3b4c5`)
    - Preserves language keywords and built-ins unchanged.
    - Produces `type2` and `hash_type2`.

    **Caching**: Results are cached in Redis under `cipas:normalized:{granule_id}`
    with a TTL of `NORMALIZATION_TTL_SECONDS` (default 1 hour).
    Subsequent requests with the same `granule_id` return the cached result immediately.

    **Determinism**: For identical inputs, this endpoint always returns identical
    `type1`, `type2`, `hash_type1`, and `hash_type2` values.
    """
    t0 = time.perf_counter()

    normalization_request = body.to_normalization_request()

    try:
        result: NormalizedResult = await svc.normalize(normalization_request)
    except NormalizationError as exc:
        logger.warning(
            "Normalization request failed",
            granule_id=body.granule_id,
            language=body.language,
            stage=exc.stage.value,
            reason=exc.reason,
        )
        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "urn:cipas:error:normalization-failed",
                "title": "Normalization failed",
                "status": 500,
                "detail": exc.reason,
                "granule_id": exc.granule_id,
                "language": exc.language,
                "stage": exc.stage.value,
            },
        )

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    logger.debug(
        "Granule normalized via HTTP",
        granule_id=result.granule_id,
        language=result.language,
        processing_ms=round(elapsed_ms, 2),
        hash_type1=result.hash_type1[:12],
        hash_type2=result.hash_type2[:12],
    )

    return NormalizedResultResponse.from_normalized_result(result, elapsed_ms)


# ---------------------------------------------------------------------------
# POST /api/v1/cipas/normalize/batch  (batch)
# ---------------------------------------------------------------------------


@router.post(
    "/normalize/batch",
    summary="Normalize a batch of code granules concurrently (Type-1 + Type-2)",
    response_model=NormalizeBatchResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": (
                "Batch processed. Results are in the same order as the input list. "
                "Failed granules have a null result entry."
            )
        },
        422: {
            "description": (
                "Validation error: batch is empty, exceeds NORMALIZATION_BATCH_SIZE, "
                "or contains an invalid granule entry."
            )
        },
        503: {"description": "NormalizationService unavailable"},
    },
)
async def normalize_batch(
    body: NormalizeBatchRequest,
    svc: NormalizationServiceDep,
) -> NormalizeBatchResponse:
    """
    Normalize a batch of source code granules concurrently.

    All granules are submitted to the ProcessPoolExecutor concurrently.
    Results are returned in the same order as the input `granules` list.

    **Batch size limit**: Up to `NORMALIZATION_BATCH_SIZE` granules per request
    (default 64). Larger batches should be split and retried.

    **Caching**: Each granule's result is independently cached in Redis.
    Cache hits short-circuit the worker dispatch for that granule.
    A single MGET round-trip is used for the entire batch cache lookup.

    **Partial failure**: If one or more granules fail, the remaining results
    are still returned. Failed granule slots in `results` contain `null`.
    The `failed` field in the response counts the number of failures.

    **Performance**: Target ≤ 100ms per granule on a 4-core VM. Concurrent
    execution across granules means total batch time is bounded by the
    slowest granule, not the sum of all granule times.
    """
    t0 = time.perf_counter()

    # Convert HTTP request objects to pipeline-internal NormalizationRequest models.
    normalization_requests = [g.to_normalization_request() for g in body.granules]

    # Run the batch through the NormalizationService.
    # normalize_batch() raises NormalizationError only on total failure
    # (all granules fail). Partial failures are represented as None in results.
    raw_results: list[NormalizedResult | None]
    try:
        raw_results = await svc.normalize_batch(normalization_requests)  # type: ignore[assignment]
    except NormalizationError as exc:
        logger.error(
            "Batch normalization completely failed",
            batch_size=len(body.granules),
            stage=exc.stage.value,
            reason=exc.reason,
        )
        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "urn:cipas:error:batch-normalization-failed",
                "title": "Batch normalization failed",
                "status": 500,
                "detail": exc.reason,
                "granule_id": exc.granule_id,
                "language": exc.language,
                "stage": exc.stage.value,
            },
        )

    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # Build per-granule response objects (None for failed slots).
    response_results: list[NormalizedResultResponse | None] = []
    succeeded = 0
    failed = 0

    for result in raw_results:
        if result is None:
            response_results.append(None)
            failed += 1
        else:
            response_results.append(
                NormalizedResultResponse.from_normalized_result(result, elapsed_ms)
            )
            succeeded += 1

    logger.debug(
        "Batch normalized via HTTP",
        batch_size=len(body.granules),
        succeeded=succeeded,
        failed=failed,
        processing_ms=round(elapsed_ms, 2),
    )

    return NormalizeBatchResponse(
        total=len(body.granules),
        succeeded=succeeded,
        failed=failed,
        processing_ms=round(elapsed_ms, 3),
        results=response_results,
    )


# ---------------------------------------------------------------------------
# GET /api/v1/cipas/normalize/health  (service health sub-probe)
# ---------------------------------------------------------------------------


@router.get(
    "/normalize/health",
    summary="NormalizationService health check",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "NormalizationService is healthy (executor + Redis live)"},
        503: {"description": "NormalizationService is degraded or unavailable"},
    },
)
async def normalization_health(
    svc: NormalizationServiceDep,
) -> JSONResponse:
    """
    Check the health of the NormalizationService.

    Inspects:
    - **executor_ok**: Is the ProcessPoolExecutor alive and not broken?
    - **redis_ok**: Can we PING the Redis instance?
    - **worker_count**: Number of worker processes in the executor.
    - **pending_tasks**: Number of granules currently in-flight in the executor.

    Returns HTTP 200 if both executor and Redis are healthy.
    Returns HTTP 503 if either is degraded.

    This sub-probe is surfaced separately from `/api/v1/cipas/ready` so that
    monitoring dashboards can track the normalization pipeline independently
    of the ingestion pipeline.
    """
    health: dict[str, Any] = await svc.health_check()

    executor_ok: bool = bool(health.get("executor_ok", False))
    redis_ok: bool = bool(health.get("redis_ok", False))

    overall_ok = executor_ok and redis_ok
    http_status = (
        status.HTTP_200_OK if overall_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return JSONResponse(
        status_code=http_status,
        content={
            "status": "ok" if overall_ok else "degraded",
            "executor_ok": executor_ok,
            "redis_ok": redis_ok,
            "worker_count": health.get("worker_count", 0),
            "pending_tasks": health.get("pending_tasks", 0),
        },
    )
