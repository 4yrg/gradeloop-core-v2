"""FastAPI application for IVAS Service."""

import signal
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging, get_logger
from app.routes.assignments import router as assignments_router
from app.routes.chat_ui import router as chat_ui_router
from app.routes.competencies import router as competencies_router
from app.routes.sessions import router as sessions_router
from app.routes.voice import router as voice_router
from app.routes.viva_ws import router as viva_ws_router
from app.services.storage.postgres_client import PostgresClient

logger = get_logger(__name__)

# Global state
postgres_client: PostgresClient | None = None
minio_client = None


async def get_db() -> PostgresClient:
    """FastAPI dependency that yields the postgres client."""
    if postgres_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready.",
        )
    return postgres_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan manager."""
    global postgres_client

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

    # Initialize voice enrollment staging backend
    try:
        import redis.asyncio as aioredis
        from app.routes.voice import enrollment_staging as _voice_staging_module
        from app.services.voice.enrollment_staging import RedisEnrollmentStaging

        redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
        await redis_client.ping()
        _voice_staging_module.enrollment_staging = RedisEnrollmentStaging(redis_client)
        logger.info("ivas_enrollment_staging_redis_ready")
    except Exception as e:
        from app.routes.voice import enrollment_staging as _voice_staging_module
        from app.services.voice.enrollment_staging import InMemoryEnrollmentStaging

        _voice_staging_module.enrollment_staging = InMemoryEnrollmentStaging()
        logger.warning("ivas_enrollment_staging_fallback_inmemory", error=str(e))

    # Initialize MinIO client for voice audio storage (non-fatal)
    try:
        from app.services.storage.minio_client import MinioClient

        minio_client = MinioClient(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            bucket=settings.minio_bucket,
            use_ssl=settings.minio_use_ssl,
        )
        minio_client.connect()
        logger.info("ivas_minio_ready")
    except Exception as e:
        minio_client = None
        logger.warning("ivas_minio_unavailable", error=str(e))

    # Warn if Gemini API key is not configured
    if not settings.gemini_api_key or settings.gemini_api_key == "SET_YOUR_API_KEY_HERE":
        logger.warning(
            "ivas_gemini_key_missing",
            detail="Gemini API key not configured. Viva and grading endpoints will fail.",
        )

    logger.info("ivas_service_ready")

    yield

    # Shutdown
    logger.info("ivas_service_shutting_down")

    if postgres_client:
        await postgres_client.close()

    logger.info("ivas_service_shutdown_complete")


# Load settings early
settings = get_settings()

# Create API router with prefix
api_router = APIRouter(prefix="/api/v1/ivas")


@api_router.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "healthy",
            "service": settings.service_name,
            "version": "0.1.0",
        },
    )


@api_router.get("/ready", tags=["health"])
async def readiness_check() -> JSONResponse:
    """Readiness check endpoint."""
    healthy = True
    checks = {}

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

    # Check Gemini API key
    settings = get_settings()
    if not settings.gemini_api_key or settings.gemini_api_key == "SET_YOUR_API_KEY_HERE":
        checks["gemini"] = "misconfigured"
    else:
        checks["gemini"] = "ok"

    status_code = status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if healthy else "not_ready",
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
