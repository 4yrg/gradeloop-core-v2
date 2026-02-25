"""
Health check endpoints.
"""

from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    timestamp: datetime
    version: str
    service: str


class DetailedHealthResponse(HealthResponse):
    """Detailed health check with additional info."""

    model_loaded: bool = False
    supported_languages: list = []


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check endpoint."""
    from ..config import settings

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version=settings.VERSION,
        service=settings.TITLE,
    )


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health_check():
    """Detailed health check with model and language info."""
    from pathlib import Path

    from ..config import settings
    from ..ml import RandomForestClassifier

    model_loaded = False
    try:
        model_path = Path(settings.MODEL_PATH)
        if model_path.exists():
            clf = RandomForestClassifier()
            clf.load(str(model_path))
            model_loaded = clf.is_trained
    except Exception:
        model_loaded = False

    return DetailedHealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version=settings.VERSION,
        service=settings.TITLE,
        model_loaded=model_loaded,
        supported_languages=settings.SUPPORTED_LANGUAGES,
    )
