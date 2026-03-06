"""Health check endpoints"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any
import torch
import psutil
import time
from datetime import datetime

from ...config.settings import get_settings, Settings

router = APIRouter()

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: str
    version: str
    system: Dict[str, Any]
    gpu: Dict[str, Any]
    configuration: Dict[str, Any]

@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)):
    """Comprehensive health check endpoint"""
    
    # System information
    memory = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=1)
    
    system_info = {
        "cpu_count": psutil.cpu_count(),
        "cpu_percent": cpu_percent,
        "memory_total_gb": round(memory.total / (1024**3), 2),
        "memory_available_gb": round(memory.available / (1024**3), 2),
        "memory_percent": memory.percent
    }
    
    # GPU information
    gpu_info = {
        "cuda_available": torch.cuda.is_available(),
        "cuda_version": torch.version.cuda if torch.cuda.is_available() else None,
        "torch_version": torch.__version__,
        "device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
        "current_device": None,
        "device_name": None,
        "memory_allocated_mb": None,
        "memory_cached_mb": None
    }
    
    if torch.cuda.is_available() and torch.cuda.device_count() > 0:
        current_device = torch.cuda.current_device()
        gpu_info.update({
            "current_device": current_device,
            "device_name": torch.cuda.get_device_name(current_device),
            "memory_allocated_mb": round(torch.cuda.memory_allocated() / (1024**2), 2),
            "memory_cached_mb": round(torch.cuda.memory_reserved() / (1024**2), 2)
        })
    
    # Configuration summary
    config_info = {
        "device_setting": settings.system.device,
        "max_concurrent_jobs": settings.api.max_concurrent_jobs,
        "models_dir": settings.output.models_dir,
        "results_dir": settings.output.results_dir,
        "datasets_available": len(settings.datasets.available)
    }
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="2.0.0",
        system=system_info,
        gpu=gpu_info,
        configuration=config_info
    )

@router.get("/health/simple")
async def simple_health():
    """Simple health check for load balancers"""
    return {"status": "ok", "timestamp": time.time()}

@router.get("/health/ready")
async def readiness_check(settings: Settings = Depends(get_settings)):
    """Readiness check for Kubernetes"""
    
    # Check if required directories exist
    from pathlib import Path
    
    models_dir = Path(settings.output.models_dir)
    results_dir = Path(settings.output.results_dir)
    
    checks = {
        "models_dir_exists": models_dir.exists(),
        "results_dir_writable": True,  # Will be checked
        "cuda_available": torch.cuda.is_available(),
        "config_loaded": True
    }
    
    # Test write access to results directory
    try:
        results_dir.mkdir(exist_ok=True)
        test_file = results_dir / ".write_test"
        test_file.write_text("test")
        test_file.unlink()
    except Exception:
        checks["results_dir_writable"] = False
    
    all_ready = all(checks.values())
    
    return {
        "ready": all_ready,
        "checks": checks,
        "timestamp": datetime.now().isoformat()
    }