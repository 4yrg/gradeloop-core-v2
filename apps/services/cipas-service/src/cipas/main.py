from __future__ import annotations

import sys
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI
from loguru import logger
from prometheus_fastapi_instrumentator import Instrumentator

from cipas.api.v1.deps import (
    get_ai_model,  # used to ensure DI wiring in startup if needed
)
from cipas.api.v1.routes.health import router as health_router
from cipas.core.config import Settings, configure_logging, get_settings


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """
    Application factory.

    - Configures structured JSON logging (Loguru).
    - Installs Prometheus instrumentation (exposes /metrics).
    - Includes API routers (health, future v1 endpoints).
    """
    settings = settings or get_settings()

    # Configure logging once early
    configure_logging(settings)

    app = FastAPI(
        title="CIPAS - Code Integrity Analysis Service",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # Instrumentation: Prometheus metrics on /metrics (prometheus-fastapi-instrumentator)
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

    # Include API v1 routers
    app.include_router(health_router, prefix="/api/v1")

    # attach settings for easy access in handlers / tests
    app.state.settings = settings

    @app.on_event("startup")
    async def _startup() -> None:
        """
        Initialize long-lived async clients and validate connectivity where appropriate.
        Clients are stored on `app.state`:
            - app.state.s3_client : aioboto3 S3 client (async)
            - app.state.redis     : redis.asyncio client (set in deps or elsewhere)
        """
        logger.info("cipas starting up (env=%s)", settings.ENV)

        # Ensure AI model is initialized (if it performs expensive setup it should be handled in deps)
        try:
            # get_ai_model returns an initialized model instance (it may be cached)
            _ = await get_ai_model(settings=settings)  # type: ignore[arg-type]
            logger.info("AI model dependency is available")
        except Exception:
            # don't necessarily fail startup for AI model, but log prominently
            logger.exception(
                "AI model dependency initialization failed; continuing without it"
            )

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        """Tear down clients created during startup."""
        logger.info("cipas shutting down")

        pass

    # simple root for quick sanity checks
    @app.get("/", include_in_schema=False)
    async def _root() -> dict[str, Any]:
        return {"service": "cipas", "status": "starting", "version": "0.1.0"}

    return app


# create top-level app for Uvicorn
app = create_app()


# Optional: allow running with `python -m cipas.main`
if __name__ == "__main__":  # pragma: no cover - manual run
    settings = get_settings()
    # ensure logging configured for CLI run
    configure_logging(settings)
    uvicorn.run("cipas.main:app", host="0.0.0.0", port=8000, log_config=None)
