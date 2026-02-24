# gradeloop-core-v2/apps/services/cipas-service/src/cipas/api/v1/deps/normalization.py
"""
FastAPI dependency provider for the CIPAS NormalizationService.

Follows the same pattern established in deps/db.py:
  - Reads the NormalizationService instance from app.state.
  - Raises HTTP 503 with a structured body if the service is not initialised
    (e.g. startup failed or the service is still warming up).
  - Exposes an Annotated type alias (NormalizationServiceDep) for concise
    route handler signatures.

The NormalizationService is stored on app.state.normalization_service by the
FastAPI lifespan in main.py, alongside the IngestionPipeline and DB pool.

Usage in route handlers:

    from cipas.api.v1.deps.normalization import NormalizationServiceDep

    @router.post("/normalize")
    async def normalize_granule(
        body: NormalizeRequest,
        svc: NormalizationServiceDep,
    ) -> NormalizedResultResponse:
        result = await svc.normalize(...)
        return result

Design notes:
  - The dependency is a plain async function (not a generator) because
    NormalizationService manages its own lifecycle — no per-request teardown
    is needed.
  - Version pinning and formatter configuration are baked into the service at
    startup time (via _normalization_worker_init).  Route handlers never touch
    formatter config directly.
  - The provider is kept deliberately thin: it only reads from app.state and
    raises on absence.  All normalisation logic lives in NormalizationService.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from cipas.normalization.service import NormalizationService

# ---------------------------------------------------------------------------
# Dependency provider
# ---------------------------------------------------------------------------


async def get_normalization_service(request: Request) -> NormalizationService:
    """
    FastAPI dependency: return the application-wide NormalizationService instance.

    The service is stored on app.state.normalization_service by the lifespan
    function in main.py.  If it is not present (startup failed or the service
    was not started), raises HTTP 503 with a structured error body.

    The returned service is guaranteed to have been started (i.e. its
    ProcessPoolExecutor and Redis publisher are live) because main.py calls
    await service.start() before yielding from the lifespan.

    Returns:
        NormalizationService — the running normalisation service instance.

    Raises:
        HTTP 503: If the service is not initialised on app.state.
    """
    service: NormalizationService | None = getattr(
        request.app.state, "normalization_service", None
    )
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "NORMALIZATION_SERVICE_UNAVAILABLE",
                "detail": (
                    "The normalisation service is not available. "
                    "The service may still be warming up its worker pool, "
                    "or startup failed. Retry after a few seconds."
                ),
            },
        )
    return service


# ---------------------------------------------------------------------------
# Annotated type alias
# ---------------------------------------------------------------------------

NormalizationServiceDep = Annotated[
    NormalizationService, Depends(get_normalization_service)
]


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "get_normalization_service",
    "NormalizationServiceDep",
]
