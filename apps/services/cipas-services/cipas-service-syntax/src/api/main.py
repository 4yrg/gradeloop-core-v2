"""
Clone Detection Service API

FastAPI-based API for code clone detection and comparison.
"""

import sys

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import settings
from .exceptions import AppException, AppExceptionMiddleware
from .routes import compare, health


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    # Initialize FastAPI app
    app = FastAPI(
        title=settings.TITLE,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=settings.ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add exception handler
    app.add_middleware(AppExceptionMiddleware)

    # Include routers
    app.include_router(health.router, tags=["Health"])
    app.include_router(
        compare.router, prefix="/api/v1/compare", tags=["Code Comparison"]
    )

    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        level="DEBUG" if settings.DEBUG else "INFO",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        backtrace=True,
        diagnose=True,
    )

    # Startup event
    @app.on_event("startup")
    async def startup_event():
        logger.info(f"Starting {settings.TITLE} v{settings.VERSION}")
        logger.info(f"Debug mode: {settings.DEBUG}")
        logger.info(f"Allowed origins: {settings.ALLOWED_ORIGINS}")

    # Shutdown event
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info(f"Shutting down {settings.TITLE}")

    return app


# Create app instance
app = create_app()
