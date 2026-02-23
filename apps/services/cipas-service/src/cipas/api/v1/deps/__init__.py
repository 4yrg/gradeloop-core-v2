from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Any, AsyncGenerator, Optional

from fastapi import Depends, Request
from loguru import logger
from pydantic import SecretStr

from cipas.core.config import Settings, get_settings

async def get_ai_model(settings: Settings = Depends(_settings)) -> _AIModel:
    """
    FastAPI dependency that returns a shared AI model instance.

    This is intentionally lightweight and safe to call during request handling.
    """
    # No async loading required for the stub; if your real loader needs async initialization,
    # wrap it with an async initializer and manage lifecycle at application startup.
    return _create_ai_model(settings)


__all__ = [
    "get_ai_model",
]
