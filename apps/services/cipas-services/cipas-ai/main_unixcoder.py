"""
CIPAS AI - UniXcoder-based AI Code Detection Service (Simplified API).

A FastAPI microservice for AI-generated code detection using:
- UniXcoder-base (microsoft/unixcoder-base) 
- Multi-modal input: code + docstring + AST sequence
- Binary classification: Human-written (0) vs AI-generated (1)
- DroidDetect training methodology

This is a simplified version of main.py for quick deployment with UniXcoder only.
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from model_engine import UniXcoderEngine
from models import create_unixcoder_detector
from schemas import (
    BatchDetectRequest,
    BatchDetectResponse,
    BatchDetectResult,
    DetectRequest,
    DetectResponse,
    ErrorResponse,
    HealthResponse,
    ModelStatus,
    ReadyResponse,
    Verdict,
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global model engine
_engine: Optional[UniXcoderEngine] = None


# =============================================================================
# Application Lifespan
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Loads UniXcoder model on startup and performs cleanup on shutdown.
    """
    global _engine

    # Startup
    logger.info("=" * 60)
    logger.info("CIPAS AI - UniXcoder Code Detection Service")
    logger.info(f"Version: {settings.service_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info("=" * 60)

    logger.info("Loading UniXcoder model...")
    start_time = time.time()

    try:
        import torch

        device = torch.device(settings.device if hasattr(settings, 'device') else 'cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load UniXcoder model
        model = create_unixcoder_detector(
            model_name="microsoft/unixcoder-base",
            num_classes=2,
            embedding_dim=256,
            dropout=0.1,
            max_length=512,
            device=device,
        )
        
        # Load checkpoint if available
        model_path = getattr(settings, 'unixcoder_model_path', None)
        if model_path:
            import pathlib
            model_path = pathlib.Path(model_path)
            if model_path.exists():
                checkpoint = torch.load(model_path, map_location=device)
                model.load_state_dict(checkpoint.get("model_state_dict", checkpoint))
                logger.info(f"Loaded checkpoint from {model_path}")
            else:
                logger.warning(f"Model path {model_path} not found, using random weights")
        else:
            logger.warning("No model path configured, using random weights")
        
        # Create engine
        _engine = UniXcoderEngine(model, device)

        load_time = time.time() - start_time
        logger.info(f"Model loaded successfully in {load_time:.2f}s")
        logger.info(f"  - UniXcoder: Ready")
        logger.info(f"  - Device: {device}")

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down CIPAS AI service...")


# =============================================================================
# FastAPI Application
# =============================================================================


app = FastAPI(
    title="CIPAS AI - UniXcoder Code Detection Service",
    description="""
## UniXcoder-based AI Code Detection

CIPAS AI provides binary code origin detection using UniXcoder:

### Model Architecture
- **Base Model:** microsoft/unixcoder-base (125M params)
- **Input:** Multi-modal (code + docstring + AST)
- **Output:** Binary classification (Human vs AI-generated)
- **Training:** DroidDetect loss (CrossEntropy + Triplet)

### Supported Languages
- C
- C#
- Python
- Java

### Training Datasets
- AIGCodeSet (15K samples)
- HumanVsAICode (507K samples)  
- DroidCollection (multi-generator)
- Zendoo (Java/Python)

### Evaluation
- AICD-bench Task 1 (2M+ samples)
- Target F1 Score: ≥ 0.95

## Quick Start
```bash
POST /api/v1/cipas-ai/detect
{
    "code_snippet": "def fibonacci(n):\\n    if n <= 1: return n\\n    return fibonacci(n-1) + fibonacci(n-2)",
    "language": "python"
}
```
    """,
    version=settings.service_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Helper Functions
# =============================================================================


def _generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())


def get_engine() -> UniXcoderEngine:
    """Get the global model engine."""
    if _engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded. Service is starting up.",
        )
    return _engine


# =============================================================================
# API Endpoints
# =============================================================================


@app.get(
    "/",
    response_model=dict,
    tags=["Root"],
    summary="Root endpoint",
)
async def root():
    """Root endpoint with service information."""
    return {
        "service": "CIPAS AI - UniXcoder Code Detection",
        "version": settings.service_version,
        "model": "microsoft/unixcoder-base",
        "classification": "Binary (Human vs AI-generated)",
        "languages": ["C", "C#", "Python", "Java"],
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "ready": "/ready",
            "detect": "/api/v1/cipas-ai/detect (POST)",
            "detect_batch": "/api/v1/cipas-ai/detect/batch (POST)",
        },
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health check",
    responses={
        200: {"description": "Service is healthy"},
        503: {"description": "Service is degraded"},
    },
)
async def health_check():
    """
    Check service health and model availability.
    """
    try:
        engine = get_engine()
        is_loaded = engine.is_loaded()
    except:
        is_loaded = False
    
    model_status = ModelStatus(
        name="UniXcoder-base",
        loaded=is_loaded,
        path_or_name="microsoft/unixcoder-base",
    )

    return HealthResponse(
        status="healthy" if is_loaded else "starting",
        model=model_status,
        device=str(engine.device) if is_loaded else "unknown",
        version=settings.service_version,
    )


@app.get(
    "/ready",
    response_model=ReadyResponse,
    tags=["Health"],
    summary="Readiness check",
)
async def readiness_check():
    """
    Check if the service is ready to accept requests.
    """
    try:
        engine = get_engine()
        is_ready = engine.is_loaded()
    except:
        is_ready = False
    
    return ReadyResponse(
        ready=is_ready,
        message="Service is ready to accept requests" if is_ready else "Model is still loading",
    )


@app.post(
    "/api/v1/cipas-ai/detect",
    response_model=DetectResponse,
    tags=["Detection"],
    summary="Detect code origin",
    responses={
        200: {"description": "Successful detection"},
        400: {"description": "Invalid request"},
        503: {"description": "Model not available"},
    },
)
async def detect_code(request: DetectRequest):
    """
    Detect whether code is human-written or AI-generated.

    Uses UniXcoder-base with multi-modal input (code + docstring + AST).

    ## Example:
    ```json
    {
        "code_snippet": "def fibonacci(n):\\n    if n <= 1: return n\\n    return fibonacci(n-1) + fibonacci(n-2)",
        "language": "python"
    }
    ```
    """
    request_id = _generate_request_id()
    start_time = time.time()

    # Get model engine
    engine = get_engine()

    try:
        # Run prediction
        result = engine.predict(
            code=request.code_snippet,
            language=request.language.value,
        )

        # Build response
        processing_time = (time.time() - start_time) * 1000

        return DetectResponse(
            request_id=request_id,
            verdict=Verdict.HUMAN_WRITTEN if result["label"] == 0 else Verdict.AI_GENERATED,
            confidence=result["confidence"],
            processing_time_ms=processing_time,
            token_count=result.get("token_count"),
            all_scores={
                "human": result.get("human_prob", 1 - result["confidence"]),
                "ai_generated": result.get("ai_prob", result["confidence"]),
            },
        )

    except ValueError as e:
        logger.error(f"Request {request_id}: Validation error - {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Request {request_id}: Detection failed - {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detection failed: {str(e)}",
        )


@app.post(
    "/api/v1/cipas-ai/detect/batch",
    response_model=BatchDetectResponse,
    tags=["Detection"],
    summary="Batch detect code origin",
    responses={
        200: {"description": "Successful batch detection"},
        400: {"description": "Invalid request"},
        503: {"description": "Model not available"},
    },
)
async def detect_code_batch(request: BatchDetectRequest):
    """
    Detect code origin for multiple snippets in a single request.

    Each snippet is processed independently. Errors in one snippet
    won't affect others.

    Maximum batch size: 100 snippets.
    """
    batch_id = _generate_request_id()
    start_time = time.time()

    # Get model engine
    engine = get_engine()

    results = []
    total_processed = 0
    total_failed = 0

    for idx, snippet in enumerate(request.snippets):
        snippet_request_id = f"{batch_id}-{idx}"

        try:
            # Run prediction
            result = engine.predict(
                code=snippet.code_snippet,
                language=snippet.language.value,
            )

            results.append(
                BatchDetectResult(
                    request_id=snippet_request_id,
                    snippet_index=idx,
                    verdict=Verdict.HUMAN_WRITTEN if result["label"] == 0 else Verdict.AI_GENERATED,
                    confidence=result["confidence"],
                    processing_time_ms=result.get("processing_time_ms", 0),
                    token_count=result.get("token_count"),
                    all_scores={
                        "human": result.get("human_prob", 1 - result["confidence"]),
                        "ai_generated": result.get("ai_prob", result["confidence"]),
                    },
                )
            )
            total_processed += 1

        except Exception as e:
            logger.exception(
                f"Batch {batch_id}, snippet {idx}: Processing failed - {e}"
            )
            results.append(
                BatchDetectResult(
                    request_id=snippet_request_id,
                    snippet_index=idx,
                    verdict=Verdict.HUMAN_WRITTEN,  # Default
                    confidence=0.0,
                    processing_time_ms=0,
                    error=str(e),
                )
            )
            total_failed += 1

    total_processing_time = (time.time() - start_time) * 1000

    return BatchDetectResponse(
        request_id=batch_id,
        results=results,
        total_processed=total_processed,
        total_failed=total_failed,
        total_processing_time_ms=total_processing_time,
    )


# =============================================================================
# Main Entry Point
# =============================================================================


if __name__ == "__main__":
    uvicorn.run(
        "main_unixcoder:app",
        host=getattr(settings, 'host', '0.0.0.0'),
        port=getattr(settings, 'port', 8000),
        workers=getattr(settings, 'worker_count', 1),
        reload=getattr(settings, 'is_development', False),
        log_level=getattr(settings, 'log_level', 'info').lower(),
    )
