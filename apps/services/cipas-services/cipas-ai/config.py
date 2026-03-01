"""
Configuration for CIPAS AI Detection Service.

Uses pydantic-settings for environment-based configuration.
"""

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Environment variables are prefixed with CIPAS_AI_
    """

    model_config = SettingsConfigDict(
        env_prefix="CIPAS_AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ======================================================================
    # Service Configuration
    # ======================================================================
    service_name: str = Field(
        default="cipas-ai",
        description="Service name",
    )
    service_version: str = Field(
        default="0.2.0",
        description="Service version",
    )
    host: str = Field(
        default="0.0.0.0",
        description="Host to bind the server",
    )
    port: int = Field(
        default=8087,
        description="Port to bind the server",
    )

    # ======================================================================
    # Model Configuration
    # ======================================================================
    tier1_model_path: str = Field(
        default="models/catboost_classifier.cbm",
        description="Path to Tier 1 CatBoost model file",
    )
    tier2_model_name: str = Field(
        default="project-droid/DroidDetect-Large",
        description="HuggingFace model name for Tier 2",
    )
    modernbert_base_name: str = Field(
        default="answerdotai/ModernBERT-large",
        description="HuggingFace model name for ModernBERT base encoder",
    )

    # ======================================================================
    # Quantization Configuration
    # ======================================================================
    enable_4bit_quantization: bool = Field(
        default=False,
        description="Enable 4-bit quantization for Tier 2 model",
    )
    enable_8bit_quantization: bool = Field(
        default=False,
        description="Enable 8-bit quantization for Tier 2 model",
    )

    # ======================================================================
    # Inference Configuration
    # ======================================================================
    tier1_high_threshold: float = Field(
        default=0.92,
        description="Tier 1 confidence threshold for immediate human verdict",
        ge=0.5,
        le=1.0,
    )
    tier1_low_threshold: float = Field(
        default=0.08,
        description="Tier 1 confidence threshold for immediate AI verdict",
        ge=0.0,
        le=0.5,
    )
    max_tokens: int = Field(
        default=8192,
        description="Maximum token count for ModernBERT",
    )
    sliding_window_size: int = Field(
        default=4096,
        description="Sliding window size for long inputs",
    )
    sliding_window_overlap: int = Field(
        default=256,
        description="Overlap between sliding windows",
    )

    # ======================================================================
    # Performance Configuration
    # ======================================================================
    worker_count: int = Field(
        default=1,
        description="Number of worker processes",
    )
    enable_async_inference: bool = Field(
        default=True,
        description="Enable async inference for Tier 2",
    )
    request_timeout_seconds: float = Field(
        default=60.0,
        description="Maximum request timeout in seconds",
    )

    # ======================================================================
    # Logging Configuration
    # ======================================================================
    log_level: str = Field(
        default="INFO",
        description="Logging level",
    )
    log_format: str = Field(
        default="json",
        description="Log format (json or text)",
    )

    # ======================================================================
    # Redis Configuration (for async task handling)
    # ======================================================================
    redis_url: Optional[str] = Field(
        default=None,
        description="Redis URL for async task handling",
        examples=["redis://localhost:6379/0"],
    )
    redis_max_connections: int = Field(
        default=10,
        description="Maximum Redis connections",
    )

    # ======================================================================
    # Batch Processing Configuration
    # ======================================================================
    max_batch_size: int = Field(
        default=100,
        description="Maximum number of snippets per batch request",
    )
    max_concurrent_batches: int = Field(
        default=4,
        description="Maximum concurrent batch processing",
    )

    # ======================================================================
    # Grammar/Parser Configuration
    # ======================================================================
    grammar_path: str = Field(
        default="models",
        description="Path to tree-sitter grammar files",
    )

    # ======================================================================
    # Environment
    # ======================================================================
    environment: str = Field(
        default="development",
        description="Deployment environment",
    )

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment.lower() == "development"

    def validate_quantization(self) -> None:
        """Validate quantization settings."""
        if self.enable_4bit_quantization and self.enable_8bit_quantization:
            raise ValueError(
                "Cannot enable both 4-bit and 8-bit quantization simultaneously"
            )


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Returns:
        Settings instance with loaded configuration.
    """
    settings = Settings()
    settings.validate_quantization()
    return settings


# Convenience function for accessing settings
settings = get_settings()
