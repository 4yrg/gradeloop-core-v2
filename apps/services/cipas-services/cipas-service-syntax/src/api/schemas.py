"""
Pydantic schemas for request/response validation.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class LanguageEnum(str, Enum):
    """Supported programming languages."""

    PYTHON = "python"
    JAVA = "java"
    C = "c"


class CodeComparisonRequest(BaseModel):
    """Request schema for code comparison."""

    code1: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="First code snippet to compare",
        example="def hello():\n    print('Hello')",
    )
    code2: str = Field(
        ...,
        min_length=1,
        max_length=100000,
        description="Second code snippet to compare",
        example="def hi():\n    print('Hi')",
    )
    language: LanguageEnum = Field(
        default=LanguageEnum.JAVA,
        description="Programming language of the code snippets",
    )
    threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Classification threshold (0.0-1.0)",
        example=0.5,
    )

    @validator("code1", "code2")
    def validate_code_not_empty(cls, v):
        """Validate that code is not just whitespace."""
        if not v.strip():
            raise ValueError("Code cannot be empty or just whitespace")
        return v


class CodeFileComparisonRequest(BaseModel):
    """Request schema for file-based code comparison."""

    file1_path: str = Field(
        ...,
        description="Path to first file",
        example="/path/to/file1.java",
    )
    file2_path: str = Field(
        ...,
        description="Path to second file",
        example="/path/to/file2.java",
    )
    language: LanguageEnum = Field(
        default=LanguageEnum.JAVA,
        description="Programming language",
    )
    threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Classification threshold",
    )


class SimilarityMetrics(BaseModel):
    """Similarity metrics between two code samples."""

    levenshtein_distance: float = Field(..., description="Levenshtein distance")
    levenshtein_similarity: float = Field(
        ..., description="Levenshtein similarity (0-1)"
    )
    jaro_similarity: float = Field(..., description="Jaro similarity (0-1)")
    jaro_winkler_similarity: float = Field(
        ..., description="Jaro-Winkler similarity (0-1)"
    )
    jaccard_similarity: float = Field(..., description="Jaccard similarity (0-1)")
    dice_coefficient: float = Field(..., description="Dice coefficient (0-1)")
    average_similarity: float = Field(
        ..., description="Average of all similarity metrics"
    )


class PredictionResult(BaseModel):
    """Clone prediction result."""

    is_clone: bool = Field(..., description="Whether the code samples are clones")
    clone_probability: float = Field(
        ..., description="Probability of being a clone (0-1)"
    )
    threshold: float = Field(..., description="Threshold used for classification")


class CodeSampleInfo(BaseModel):
    """Information about a code sample."""

    name: str
    characters: int
    tokens: int


class CodeComparisonResponse(BaseModel):
    """Response schema for code comparison."""

    success: bool = Field(..., description="Whether the comparison was successful")
    sample1: CodeSampleInfo = Field(..., description="Information about first sample")
    sample2: CodeSampleInfo = Field(..., description="Information about second sample")
    similarity_metrics: SimilarityMetrics = Field(..., description="Similarity metrics")
    prediction: PredictionResult = Field(..., description="Clone prediction")
    feature_importances: Dict[str, float] = Field(
        ...,
        description="Feature importances from the model",
    )
    language: str = Field(..., description="Programming language used")
    message: Optional[str] = Field(None, description="Additional message")

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "sample1": {"name": "Sample 1", "characters": 57, "tokens": 6},
                "sample2": {"name": "Sample 2", "characters": 51, "tokens": 6},
                "similarity_metrics": {
                    "levenshtein_distance": 0.0,
                    "levenshtein_similarity": 1.0,
                    "jaro_similarity": 1.0,
                    "jaro_winkler_similarity": 1.0,
                    "jaccard_similarity": 1.0,
                    "dice_coefficient": 1.0,
                    "average_similarity": 1.0,
                },
                "prediction": {
                    "is_clone": True,
                    "clone_probability": 0.9998,
                    "threshold": 0.5,
                },
                "feature_importances": {
                    "jaro_winkler_similarity": 0.2532,
                    "jaro_similarity": 0.2222,
                    "levenshtein_ratio": 0.2221,
                    "levenshtein_distance": 0.2221,
                    "jaccard_similarity": 0.0447,
                    "dice_coefficient": 0.0357,
                },
                "language": "python",
                "message": "Clone detected with high confidence",
            }
        }


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: bool = Field(default=True)
    message: str
    detail: Optional[Any] = None
