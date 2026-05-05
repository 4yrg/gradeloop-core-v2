"""FastAPI application for IVAS Service."""

import signal
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging, get_logger
from app.queue.rabbitmq import NotificationPublisher
from app.routes.assignments import router as assignments_router
from app.routes.chat_ui import router as chat_ui_router
from app.routes.competencies import router as competencies_router
from app.routes.sessions import router as sessions_router
from app.routes.viva_ws import router as viva_ws_router
from app.routes.voice import router as voice_router
from app.services.storage.postgres_client import PostgresClient

logger = get_logger(__name__)

# Global state
postgres_client: PostgresClient | None = None
notification_publisher: NotificationPublisher | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan manager."""
    global postgres_client, notification_publisher

    settings = get_settings()
    configure_logging(settings.log_level, settings.environment)

    logger.info(
        "ivas_service_starting",
        service=settings.service_name,
        version="0.1.0",
        environment=settings.environment,
    )

    # Initialize PostgreSQL client (non-fatal — Gemini chat works without DB)
    try:
        postgres_client = PostgresClient(settings.database_dsn)
        await postgres_client.connect()
        await postgres_client.ensure_tables()
        logger.info("ivas_postgres_ready")
    except Exception as e:
        postgres_client = None
        logger.warning("ivas_postgres_unavailable", error=str(e))

    # Initialize notification publisher (non-fatal — viva grading works without it)
    try:
        notification_publisher = NotificationPublisher(
            url=settings.rabbitmq_url,
            iam_service_url=settings.iam_service_url,
        )
        await notification_publisher.connect()
        logger.info("ivas_notification_publisher_ready")
    except Exception as e:
        notification_publisher = None
        logger.warning("ivas_notification_publisher_unavailable", error=str(e))

    # Pre-load the Resemblyzer voice encoder model so first request doesn't time out
    try:
        from app.services.voice.speaker import _get_encoder
        _get_encoder()
        logger.info("ivas_voice_encoder_preloaded")
    except Exception as e:
        logger.warning("ivas_voice_encoder_preload_failed", error=str(e))

    logger.info("ivas_service_ready")

    yield

    # Shutdown
    logger.info("ivas_service_shutting_down")

    if notification_publisher:
        await notification_publisher.close()

    if postgres_client:
        await postgres_client.close()

    logger.info("ivas_service_shutdown_complete")


# Load settings early
settings = get_settings()

# Create API router with prefix
api_router = APIRouter(prefix="/api/v1/ivas")


@api_router.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    """Health check endpoint.

    Checks critical internal dependencies: PostgreSQL and voice encoder.
    Returns 503 if any critical component is unavailable.
    """
    checks = {}
    healthy = True

    if postgres_client:
        try:
            await postgres_client.ping()
            checks["postgres"] = "ok"
        except Exception as e:
            healthy = False
            checks["postgres"] = f"error: {e}"
    else:
        healthy = False
        checks["postgres"] = "not_initialized"

    try:
        from app.services.voice.speaker import _get_encoder
        encoder = _get_encoder()
        checks["voice_encoder"] = "ok" if encoder is not None else "not_loaded"
        if encoder is None:
            healthy = False
    except Exception as e:
        healthy = False
        checks["voice_encoder"] = f"error: {e}"

    status_code = status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if healthy else "degraded",
            "service": settings.service_name,
            "version": "0.1.0",
            "checks": checks,
        },
    )


@api_router.get("/ready", tags=["health"])
async def readiness_check() -> JSONResponse:
    """Readiness check endpoint.

    Checks PostgreSQL (critical) and reports status of other components.
    Returns 503 only if PostgreSQL is down (service cannot function without DB).
    """
    checks = {}

    if postgres_client:
        try:
            await postgres_client.ping()
            checks["postgres"] = "ok"
        except Exception as e:
            checks["postgres"] = f"error: {e}"
    else:
        checks["postgres"] = "not_initialized"

    checks["notifications"] = "ok" if notification_publisher else "unavailable"

    try:
        from app.services.voice.speaker import _get_encoder
        encoder = _get_encoder()
        checks["voice_encoder"] = "ok" if encoder is not None else "not_loaded"
    except Exception:
        checks["voice_encoder"] = "error"

    postgres_ok = checks["postgres"] == "ok"
    status_code = status.HTTP_200_OK if postgres_ok else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if postgres_ok else "not_ready",
            "checks": checks,
        },
    )


# Create FastAPI app
app = FastAPI(
    title="IVAS Service",
    description="Intelligent Viva Assessment System — AI-powered voice-based oral examination",
    version="0.1.0",
    lifespan=lifespan,
)

# Include routers — sub-routers first, then mount to app
api_router.include_router(assignments_router)
api_router.include_router(sessions_router)
api_router.include_router(competencies_router)
api_router.include_router(voice_router)
app.include_router(api_router)

# Standalone chat UI + WebSocket (no prefix)
app.include_router(chat_ui_router)
app.include_router(viva_ws_router)


def signal_handler(sig, frame) -> None:
    """Handle shutdown signals gracefully."""
    logger.info("shutdown_signal_received", signal=sig)
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        log_level=settings.log_level.lower(),
        reload=settings.environment == "development",
    )
