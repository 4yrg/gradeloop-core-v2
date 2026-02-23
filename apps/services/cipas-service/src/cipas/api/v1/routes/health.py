from __future__ import annotations

import asyncio
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from cipas.api.v1.deps import get_ai_model
from cipas.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service health check", response_model=dict)
async def health(
    settings: Settings = Depends(get_settings),
    # include AI model dependency to assert loader availability (stubbed)
    ai_model=Depends(get_ai_model),
) -> Dict[str, Any]:
    """
    Health endpoint for CIPAS service.
    """
    timeout = float(settings.HEALTH_CHECK_TIMEOUT_SECONDS)

    # Basic aggregated status
    all_ok = True

    # probe AI model simple call (non-blocking / extremely cheap)
    ai_status: Dict[str, Any] = {"ok": True}
    try:
        # call a tiny async analysis to ensure the stubbed loader is callable
        res = await asyncio.wait_for(ai_model.analyze(""), timeout=timeout)
        ai_status["ok"] = True
        ai_status["info"] = {"result_preview": {"length": res.get("length")}}
    except Exception as exc:
        logger.exception("AI model lightweight check failed: %s", exc)
        ai_status = {"ok": False, "error": str(exc)}
        all_ok = False

    result = {
        "status": "ok" if all_ok else "unhealthy",
        "checks": {
            "ai_model": ai_status,
        },
    }

    if not all_ok:
        # Return 503 so orchestrators and load-balancers can detect degraded instances
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=result
        )

    return result
