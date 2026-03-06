"""
CIPAS AI - UniXcoder-based AI Code Detection Service.

A FastAPI microservice for AI-generated code detection using:
- UniXcoder-base (microsoft/unixcoder-base) - 125M parameter unified code model
- Multi-modal input: code + docstring + AST sequence
- Binary classification: Human-written (0) vs AI-generated (1)
- DroidDetect loss: CrossEntropy + Triplet Loss

Training:
- 4 datasets: AIGCodeSet, HumanVsAICode, DroidCollection, Zendoo
- MC Dropout uncertainty filtering (removes noisy labels)
- Supports C, C#, Python, Java
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from model_engine import UniXcoderEngine, load_unixcoder_model
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
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# Application Lifespan
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Loads UniXcoder model on startup and performs cleanup on shutdown.
    """
    # Startup
    logger.info("=" * 60)
    logger.info("CIPAS AI - UniXcoder Code Detection Service")
    logger.info(f"Version: {settings.service_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info("=" * 60)

    logger.info("Loading UniXcoder model...")
    start_time = time.time()

    try:
        # Load UniXcoder model
        engine = load_unixcoder_model(
            model_path=settings.unixcoder_model_path,
            device=settings.device,
        )

        load_time = time.time() - start_time
        logger.info(f"Model loaded successfully in {load_time:.2f}s")
        logger.info(f"  - UniXcoder: {'Ready' if engine.is_loaded() else 'Failed'}")
        logger.info(f"  - Device: {settings.device}")

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
    title="CIPAS AI - Code Detection Service",
    description="""
## 2-Tier Hybrid Code Detection

CIPAS AI provides intelligent code origin detection using a two-tier architecture:

### Tier 1: Structural Analysis (CatBoost)
**Fast gatekeeper** that analyzes structural AST features:
- Whitespace ratio
- Identifier patterns
- AST density
- Nesting depth
- Comment density

**Response time:** ~5-10ms

### Tier 2: Semantic Analysis (ModernBERT-Large)
**Deep analysis** using a 396M parameter transformer:
- 8192 token context window
- Semantic understanding
- Adversarial detection

**Response time:** ~100-500ms

### Routing Logic
- If Tier 1 confidence > 92% or < 8% → Return Tier 1 result
- Otherwise → Escalate to Tier 2 for deep analysis

### Supported Languages
- Python
- Java
- C/C++

## Quick Start

### Detect Code Origin
```bash
POST /api/v1/cipas-ai/detect
{
    "code_snippet": "def hello(): print('world')",
    "language": "python",
    "use_hybrid": true
}
```

### Batch Detection
```bash
POST /api/v1/cipas-ai/detect/batch
{
    "snippets": [
        {"code_snippet": "...", "language": "python"},
        {"code_snippet": "...", "language": "java"}
    ]
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


def _create_warning_message(
    tier_used: DetectionTier,
    confidence: float,
    token_count: Optional[int] = None,
) -> Optional[str]:
    """Create warning message based on detection results."""
    warnings = []

    if tier_used == DetectionTier.TIER2 and token_count:
        if token_count > settings.sliding_window_size:
            warnings.append(
                f"Input exceeds {settings.sliding_window_size} tokens "
                f"(got {token_count}). Sliding window was used."
            )

    if confidence < 0.6:
        warnings.append(
            f"Low confidence detection ({confidence:.2f}). Consider manual review."
        )

    return " ".join(warnings) if warnings else None


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
        "service": "CIPAS AI - 2-Tier Hybrid Code Detection",
        "version": settings.service_version,
        "tier1": "CatBoost Classifier (Structural Features)",
        "tier2": "ModernBERT-Large / DroidDetect-Large (Semantic Analysis)",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "ready": "/ready",
            "detect": "/api/v1/cipas-ai/detect (POST)",
            "detect_batch": "/api/v1/cipas-ai/detect/batch (POST)",
            "extract_features": "/api/v1/cipas-ai/features (POST)",
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

    Returns the status of both Tier 1 and Tier 2 models.
    """
    engine = get_model_engine()

    tier1_status = ModelStatus(
        name="CatBoost Classifier",
        loaded=engine.is_tier1_loaded(),
        path_or_name=settings.tier1_model_path,
    )

    tier2_status = ModelStatus(
        name="ModernBERT-Large (DroidDetect)",
        loaded=engine.is_tier2_loaded(),
        path_or_name=settings.tier2_model_name,
    )

    # Determine overall health
    if tier1_status.loaded and tier2_status.loaded:
        health_status = "healthy"
    elif tier1_status.loaded or tier2_status.loaded:
        health_status = "degraded"
    else:
        health_status = "starting"

    return HealthResponse(
        status=health_status,
        tier1_model=tier1_status,
        tier2_model=tier2_status,
        device=str(engine._device) if hasattr(engine, "_device") else "unknown",
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

    Both models must be loaded for the service to be ready.
    """
    engine = get_model_engine()

    tier1_ready = engine.is_tier1_loaded()
    tier2_ready = engine.is_tier2_loaded()

    if tier1_ready and tier2_ready:
        return ReadyResponse(
            ready=True,
            tier1_ready=True,
            tier2_ready=True,
            message="Service is ready to accept requests",
        )
    elif tier1_ready:
        return ReadyResponse(
            ready=False,
            tier1_ready=True,
            tier2_ready=False,
            message="Tier 2 model is still loading",
        )
    else:
        return ReadyResponse(
            ready=False,
            tier1_ready=False,
            tier2_ready=False,
            message="Models are still loading",
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
    Detect whether code is human-written, AI-generated, or AI-refined.

    ## 2-Tier Architecture:

    **Tier 1 (CatBoost):** Fast structural analysis (~5-10ms)
    - Analyzes 8 structural AST features
    - If confidence > 92% or < 8%, returns immediately

    **Tier 2 (ModernBERT-Large):** Deep semantic analysis (~100-500ms)
    - Used when Tier 1 is uncertain
    - 8192 token context window
    - 3-class classification

    ## Example:
    ```json
    {
        "code_snippet": "def fibonacci(n):\\n    if n <= 1: return n\\n    return fibonacci(n-1) + fibonacci(n-2)",
        "language": "python",
        "use_hybrid": true
    }
    ```
    """
    request_id = _generate_request_id()
    start_time = time.time()

    # Validate models are loaded
    engine = get_model_engine()

    if not engine.is_tier1_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tier 1 model not loaded. Please wait for initialization.",
        )

    if request.use_hybrid and not engine.is_tier2_loaded():
        logger.warning(
            f"Request {request_id}: Hybrid requested but Tier 2 not loaded, "
            "falling back to Tier 1 only"
        )

    try:
        # Extract structural features
        features_obj = extract_features(
            request.code_snippet,
            request.language.value,
        )
        features = features_obj.to_list()

        # Run detection
        if request.use_hybrid and engine.is_tier2_loaded():
            # Use async hybrid detection
            if settings.enable_async_inference:
                result = await engine.predict_hybrid_async(
                    code=request.code_snippet,
                    language=request.language.value,
                    features=features,
                )
            else:
                result = engine.predict_hybrid(
                    code=request.code_snippet,
                    language=request.language.value,
                    features=features,
                )
        else:
            # Tier 1 only
            tier1_result = engine.predict_tier1(features)
            processing_time = (time.time() - start_time) * 1000

            result = HybridResult(
                label=tier1_result.label,
                confidence=tier1_result.confidence,
                tier_used=TierEnum.TIER1,
                tier1_confidence=tier1_result.confidence,
                processing_time_ms=processing_time,
            )

        # Build response
        processing_time = (time.time() - start_time) * 1000

        metadata = Metadata(
            model="CatBoost + ModernBERT-Large (DroidDetect)",
            processing_time_ms=processing_time,
            token_count=result.token_count,
            tier_used=DetectionTier(result.tier_used.value),
            tier1_confidence=result.tier1_confidence,
            tier2_confidence=result.tier2_confidence,
        )

        warning = _create_warning_message(
            DetectionTier(result.tier_used.value),
            result.confidence,
            result.token_count,
        )

        return DetectResponse(
            request_id=request_id,
            verdict=Verdict(result.label),
            confidence=result.confidence,
            metadata=metadata,
            all_scores=result.all_scores,
            warning=warning,
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

    # Validate models are loaded
    engine = get_model_engine()

    if not engine.is_tier1_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tier 1 model not loaded. Please wait for initialization.",
        )

    results = []
    total_processed = 0
    total_failed = 0

    for idx, snippet in enumerate(request.snippets):
        snippet_request_id = f"{batch_id}-{idx}"

        try:
            # Extract features
            features_obj = extract_features(
                snippet.code_snippet,
                snippet.language.value,
            )
            features = features_obj.to_list()

            # Run detection
            if snippet.use_hybrid and engine.is_tier2_loaded():
                if settings.enable_async_inference:
                    result = await engine.predict_hybrid_async(
                        code=snippet.code_snippet,
                        language=snippet.language.value,
                        features=features,
                    )
                else:
                    result = engine.predict_hybrid(
                        code=snippet.code_snippet,
                        language=snippet.language.value,
                        features=features,
                    )
            else:
                tier1_result = engine.predict_tier1(features)
                result = HybridResult(
                    label=tier1_result.label,
                    confidence=tier1_result.confidence,
                    tier_used=TierEnum.TIER1,
                    tier1_confidence=tier1_result.confidence,
                )

            metadata = Metadata(
                model="CatBoost + ModernBERT-Large (DroidDetect)",
                processing_time_ms=result.processing_time_ms or 0,
                token_count=result.token_count,
                tier_used=DetectionTier(result.tier_used.value),
                tier1_confidence=result.tier1_confidence,
                tier2_confidence=result.tier2_confidence,
            )

            results.append(
                BatchDetectResult(
                    request_id=snippet_request_id,
                    snippet_index=idx,
                    verdict=Verdict(result.label),
                    confidence=result.confidence,
                    metadata=metadata,
                    all_scores=result.all_scores,
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
                    metadata=Metadata(
                        model="N/A",
                        processing_time_ms=0,
                        tier_used=DetectionTier.TIER1,
                    ),
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


@app.post(
    "/api/v1/cipas-ai/features",
    response_model=ExtractFeaturesResponse,
    tags=["Features"],
    summary="Extract structural features",
)
async def extract_features_endpoint(request: ExtractFeaturesRequest):
    """
    Extract structural AST features from code.

    Returns the 8 features used by Tier 1 CatBoost classifier:
    - whitespace_ratio
    - avg_identifier_length
    - ast_density
    - line_count
    - avg_line_length
    - comment_density
    - max_nesting_depth
    - unique_node_ratio

    Useful for debugging and understanding what Tier 1 sees.
    """
    request_id = _generate_request_id()

    try:
        features_obj = extract_features(
            request.code_snippet,
            request.language.value,
        )

        return ExtractFeaturesResponse(
            request_id=request_id,
            features=StructuralFeatures(
                whitespace_ratio=features_obj.whitespace_ratio,
                avg_identifier_length=features_obj.avg_identifier_length,
                ast_density=features_obj.ast_density,
                line_count=features_obj.line_count,
                avg_line_length=features_obj.avg_line_length,
                comment_density=features_obj.comment_density,
                max_nesting_depth=features_obj.max_nesting_depth,
                unique_node_ratio=features_obj.unique_node_ratio,
            ),
            feature_list=features_obj.to_list(),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Request {request_id}: Feature extraction failed - {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feature extraction failed: {str(e)}",
        )


# =============================================================================
# Main Entry Point
# =============================================================================


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        workers=settings.worker_count,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
    )
