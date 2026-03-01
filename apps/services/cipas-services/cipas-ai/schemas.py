"""
Pydantic schemas for CIPAS AI Detection Service.

Defines request/response models for the 2-tier hybrid code detection API.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SupportedLanguage(str, Enum):
    """Supported programming languages."""

    PYTHON = "python"
    JAVA = "java"
    C = "c"
    CPP = "cpp"


class DetectionTier(str, Enum):
    """Detection tier used for the prediction."""

    TIER1 = "tier1_catboost"
    TIER2 = "tier2_modernbert"
    HYBRID = "hybrid"


class Verdict(str, Enum):
    """Final verdict for code detection."""

    HUMAN_WRITTEN = "Human-written"
    AI_GENERATED = "AI-generated"
    AI_REFINED = "AI-refined"


# =============================================================================
# Request Models
# =============================================================================


class DetectRequest(BaseModel):
    """
    Request model for code detection.

    Attributes:
        code_snippet: The source code to analyze (1-100000 characters).
        language: Programming language (python, java, c, cpp).
        use_hybrid: Whether to use 2-tier hybrid detection (default: True).
                   If False, only Tier 1 (CatBoost) will be used.
    """

    code_snippet: str = Field(
        ...,
        description="The source code snippet to analyze",
        min_length=1,
        max_length=100000,  # Reasonable upper limit for code snippets
        examples=[
            "def hello_world():\n    print('Hello, World!')",
            'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}',
        ],
    )
    language: SupportedLanguage = Field(
        ...,
        description="Programming language of the code snippet",
        examples=["python", "java", "c"],
    )
    use_hybrid: bool = Field(
        default=True,
        description="Use 2-tier hybrid detection (Tier 1 + Tier 2 if uncertain)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "code_snippet": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
                "language": "python",
                "use_hybrid": True,
            }
        }


class BatchDetectRequest(BaseModel):
    """
    Request model for batch code detection.

    Attributes:
        snippets: List of code snippets to analyze (max 100).
        use_hybrid: Whether to use 2-tier hybrid detection.
    """

    snippets: list[DetectRequest] = Field(
        ...,
        description="List of code snippets to analyze",
        min_length=1,
        max_length=100,  # Maximum batch size
    )

    class Config:
        json_schema_extra = {
            "example": {
                "snippets": [
                    {
                        "code_snippet": "def hello(): pass",
                        "language": "python",
                    },
                    {
                        "code_snippet": "public void hello() {}",
                        "language": "java",
                    },
                ]
            }
        }


# =============================================================================
# Response Models
# =============================================================================


class Metadata(BaseModel):
    """
    Metadata about the detection process.

    Attributes:
        model: Model(s) used for detection.
        processing_time_ms: Time taken to process the request.
        token_count: Number of tokens processed (Tier 2 only).
        tier_used: Which tier made the final decision.
        tier1_confidence: Confidence score from Tier 1.
        tier2_confidence: Confidence score from Tier 2 (if used).
    """

    model: str = Field(
        ...,
        description="Model(s) used for detection",
        examples=["CatBoost + ModernBERT-Large (DroidDetect)"],
    )
    processing_time_ms: float = Field(
        ...,
        description="Processing time in milliseconds",
        ge=0,
        examples=[240.5],
    )
    token_count: Optional[int] = Field(
        default=None,
        description="Number of tokens processed (Tier 2 only)",
        ge=0,
    )
    tier_used: DetectionTier = Field(
        ...,
        description="Which tier made the final detection decision",
    )
    tier1_confidence: Optional[float] = Field(
        default=None,
        description="Confidence score from Tier 1 CatBoost classifier",
        ge=0,
        le=1,
    )
    tier2_confidence: Optional[float] = Field(
        default=None,
        description="Confidence score from Tier 2 ModernBERT classifier",
        ge=0,
        le=1,
    )


class DetectResponse(BaseModel):
    """
    Response model for code detection.

    Follows the Gradeloop API response schema with:
    - request_id: Unique identifier for the request
    - verdict: Final classification (Human-written, AI-generated, AI-refined)
    - confidence: Confidence score (0.0 to 1.0)
    - metadata: Additional information about the detection process
    """

    request_id: str = Field(
        ...,
        description="Unique request identifier (UUID)",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    verdict: Verdict = Field(
        ...,
        description="Final verdict for the code snippet",
    )
    confidence: float = Field(
        ...,
        description="Confidence score for the verdict (0.0 to 1.0)",
        ge=0,
        le=1,
        examples=[0.982],
    )
    metadata: Metadata = Field(
        ...,
        description="Metadata about the detection process",
    )
    all_scores: Optional[dict[str, float]] = Field(
        default=None,
        description="Confidence scores for all classes (Tier 2 only)",
        examples=[
            {
                "Human-written": 0.92,
                "AI-generated": 0.05,
                "AI-refined": 0.03,
            }
        ],
    )
    warning: Optional[str] = Field(
        default=None,
        description="Warning message if any (e.g., long input, low confidence)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "request_id": "550e8400-e29b-41d4-a716-446655440000",
                "verdict": "Human-written",
                "confidence": 0.982,
                "metadata": {
                    "model": "CatBoost + ModernBERT-Large (DroidDetect)",
                    "processing_time_ms": 240.5,
                    "token_count": 156,
                    "tier_used": "tier2_modernbert",
                    "tier1_confidence": 0.65,
                    "tier2_confidence": 0.982,
                },
                "all_scores": {
                    "Human-written": 0.982,
                    "AI-generated": 0.012,
                    "AI-refined": 0.006,
                },
                "warning": None,
            }
        }


class BatchDetectResult(BaseModel):
    """Result for a single snippet in batch detection."""

    request_id: str = Field(..., description="Unique identifier for this snippet")
    snippet_index: int = Field(..., description="Index of the snippet in the batch")
    verdict: Verdict
    confidence: float
    metadata: Metadata
    all_scores: Optional[dict[str, float]] = None
    error: Optional[str] = Field(
        default=None,
        description="Error message if processing failed",
    )


class BatchDetectResponse(BaseModel):
    """
    Response model for batch code detection.

    Attributes:
        request_id: Unique batch request identifier.
        results: List of individual detection results.
        total_processed: Number of snippets successfully processed.
        total_failed: Number of snippets that failed processing.
        total_processing_time_ms: Total time for batch processing.
    """

    request_id: str = Field(..., description="Unique batch request identifier")
    results: list[BatchDetectResult] = Field(
        ..., description="Individual detection results for each snippet"
    )
    total_processed: int = Field(
        ..., description="Number of snippets successfully processed"
    )
    total_failed: int = Field(
        ..., description="Number of snippets that failed processing"
    )
    total_processing_time_ms: float = Field(
        ..., description="Total processing time for the batch in milliseconds"
    )


# =============================================================================
# Health & Status Models
# =============================================================================


class ModelStatus(BaseModel):
    """Status of a single model."""

    name: str
    loaded: bool
    path_or_name: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """
    Health check response.

    Attributes:
        status: Overall service status (healthy, degraded, starting).
        tier1_model: Status of Tier 1 CatBoost model.
        tier2_model: Status of Tier 2 ModernBERT model.
        device: Device being used for inference.
        version: Service version.
    """

    status: str = Field(
        ...,
        description="Overall service health status",
        examples=["healthy", "degraded", "starting"],
    )
    tier1_model: ModelStatus
    tier2_model: ModelStatus
    device: str = Field(
        ...,
        description="Device used for inference",
        examples=["cuda", "cpu", "mps"],
    )
    version: str = Field(..., description="Service version")


class ReadyResponse(BaseModel):
    """
    Readiness check response.

    Indicates whether the service is ready to accept requests.
    """

    ready: bool = Field(..., description="Whether the service is ready")
    tier1_ready: bool = Field(..., description="Whether Tier 1 model is ready")
    tier2_ready: bool = Field(..., description="Whether Tier 2 model is ready")
    message: Optional[str] = Field(
        default=None, description="Additional status message"
    )


# =============================================================================
# Feature Extraction Models
# =============================================================================


class StructuralFeatures(BaseModel):
    """
    Structural features extracted from code.

    These features are used by Tier 1 CatBoost classifier.
    """

    whitespace_ratio: float = Field(..., description="Ratio of whitespace characters")
    avg_identifier_length: float = Field(
        ..., description="Average length of identifiers"
    )
    ast_density: float = Field(..., description="AST nodes per line of code")
    line_count: int = Field(..., description="Total number of lines")
    avg_line_length: float = Field(..., description="Average characters per line")
    comment_density: float = Field(..., description="Ratio of comment characters")
    max_nesting_depth: int = Field(..., description="Maximum nesting depth")
    unique_node_ratio: float = Field(
        ..., description="Ratio of unique node types to total nodes"
    )


class ExtractFeaturesRequest(BaseModel):
    """Request model for feature extraction endpoint."""

    code_snippet: str = Field(..., description="Source code to analyze")
    language: SupportedLanguage = Field(..., description="Programming language")


class ExtractFeaturesResponse(BaseModel):
    """Response model for feature extraction endpoint."""

    request_id: str
    features: StructuralFeatures
    feature_list: list[float] = Field(
        ...,
        description="Feature values as a list (for model input)",
        min_length=8,
        max_length=8,
    )


# =============================================================================
# Error Models
# =============================================================================


class ErrorResponse(BaseModel):
    """Standard error response model."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Detailed error message")
    request_id: Optional[str] = Field(
        default=None, description="Request ID for debugging"
    )
