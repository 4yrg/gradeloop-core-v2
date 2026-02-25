"""
Code comparison API routes.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, status
from loguru import logger

from ..config import settings
from ..exceptions import (
    CodeValidationError,
    LanguageNotSupportedError,
    ModelNotLoadedError,
)
from ..schemas import (
    CodeComparisonRequest,
    CodeComparisonResponse,
    CodeSampleInfo,
    ErrorResponse,
    PredictionResult,
    SimilarityMetrics,
)
from ..services.comparison import CodeComparisonService, get_service

router = APIRouter()


def _get_service() -> CodeComparisonService:
    """Get comparison service with error handling."""
    try:
        return get_service(
            model_path=settings.MODEL_PATH,
            language=settings.DEFAULT_LANGUAGE,
        )
    except Exception as e:
        logger.error(f"Failed to initialize comparison service: {e}")
        raise ModelNotLoadedError(f"Failed to initialize service: {str(e)}")


@router.post(
    "/",
    response_model=CodeComparisonResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Bad Request - Invalid input"},
        403: {
            "model": ErrorResponse,
            "description": "Forbidden - Unsupported language",
        },
        503: {
            "model": ErrorResponse,
            "description": "Service Unavailable - Model not loaded",
        },
    },
)
async def compare_code_segments(request: CodeComparisonRequest):
    """
    Compare two code segments to detect if they are clones.

    This endpoint analyzes two code snippets using:
    - **ToMA feature extraction**: Converts code to token sequences
    - **6D similarity metrics**: Levenshtein, Jaro, Jaccard, Dice coefficients
    - **ML-based classification**: Random Forest classifier trained on code clones

    ## Features:
    - Supports Python, Java, and C
    - Returns detailed similarity metrics
    - Provides clone probability score
    - Shows feature importances for interpretability

    ## Example:
    ```json
    {
        "code1": "def hello():\\n    print('Hello')",
        "code2": "def hi():\\n    print('Hi')",
        "language": "python",
        "threshold": 0.5
    }
    ```
    """
    # Validate language
    if request.language.value not in settings.SUPPORTED_LANGUAGES:
        raise LanguageNotSupportedError(request.language.value)

    # Validate code length
    if len(request.code1) > settings.MAX_CODE_LENGTH:
        raise CodeValidationError(
            f"code1 exceeds maximum length of {settings.MAX_CODE_LENGTH} characters"
        )
    if len(request.code2) > settings.MAX_CODE_LENGTH:
        raise CodeValidationError(
            f"code2 exceeds maximum length of {settings.MAX_CODE_LENGTH} characters"
        )

    try:
        # Get service
        service = _get_service()

        # Perform comparison
        result = service.compare(
            code1=request.code1,
            code2=request.code2,
            language=request.language.value,
            threshold=request.threshold,
        )

        # Build response
        response = CodeComparisonResponse(
            success=True,
            sample1=CodeSampleInfo(**result["sample1"]),
            sample2=CodeSampleInfo(**result["sample2"]),
            similarity_metrics=SimilarityMetrics(**result["similarity_metrics"]),
            prediction=PredictionResult(**result["prediction"]),
            feature_importances=result["feature_importances"],
            language=result["language"],
            message=result["message"],
        )

        logger.info(
            f"Comparison completed: is_clone={response.prediction.is_clone}, "
            f"probability={response.prediction.clone_probability:.4f}"
        )

        return response

    except ModelNotLoadedError:
        raise
    except Exception as e:
        logger.error(f"Comparison failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {str(e)}",
        )


@router.post(
    "/quick",
    response_model=CodeComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Quick comparison with default settings",
)
async def quick_compare(
    code1: str = Query(..., min_length=1, description="First code snippet"),
    code2: str = Query(..., min_length=1, description="Second code snippet"),
    language: str = Query(
        default="java",
        description="Programming language (python, java, c)",
    ),
):
    """
    Quick code comparison with default threshold.

    Simplified endpoint for quick comparisons using query parameters.
    Uses default threshold of 0.5.
    """
    # Validate language
    if language not in settings.SUPPORTED_LANGUAGES:
        raise LanguageNotSupportedError(language)

    try:
        service = _get_service()

        result = service.compare(
            code1=code1,
            code2=code2,
            language=language,
            threshold=settings.DEFAULT_THRESHOLD,
        )

        return CodeComparisonResponse(
            success=True,
            sample1=CodeSampleInfo(**result["sample1"]),
            sample2=CodeSampleInfo(**result["sample2"]),
            similarity_metrics=SimilarityMetrics(**result["similarity_metrics"]),
            prediction=PredictionResult(**result["prediction"]),
            feature_importances=result["feature_importances"],
            language=result["language"],
            message=result["message"],
        )

    except Exception as e:
        logger.error(f"Quick comparison failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {str(e)}",
        )


@router.get(
    "/languages",
    response_model=list,
    status_code=status.HTTP_200_OK,
)
async def get_supported_languages():
    """Get list of supported programming languages."""
    return settings.SUPPORTED_LANGUAGES


@router.get(
    "/model/info",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def get_model_info():
    """Get information about the loaded model."""
    from ..ml import RandomForestClassifier

    try:
        model_path = Path(settings.MODEL_PATH)
        if not model_path.exists():
            return {
                "loaded": False,
                "message": "Model file not found",
                "model_path": str(model_path),
            }

        clf = RandomForestClassifier()
        clf.load(str(model_path))

        return {
            "loaded": clf.is_trained,
            "model_path": str(model_path),
            "feature_names": clf.feature_names,
            "feature_importances": clf.get_feature_importances()
            if clf.is_trained
            else None,
        }

    except Exception as e:
        return {
            "loaded": False,
            "error": str(e),
        }
