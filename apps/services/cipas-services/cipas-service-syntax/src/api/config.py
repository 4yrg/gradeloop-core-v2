"""
Application configuration settings.
"""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # App metadata
    TITLE: str = "Clone Detection Service"
    DESCRIPTION: str = (
        "API for code clone detection and comparison using Tree-sitter and ML"
    )
    VERSION: str = "1.0.0"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]
    ALLOW_CREDENTIALS: bool = True

    # Model settings
    MODEL_PATH: str = "data/models/clone_classifier.joblib"
    DEFAULT_LANGUAGE: str = "java"
    DEFAULT_THRESHOLD: float = 0.5

    # Comparison settings
    MAX_CODE_LENGTH: int = 100000  # Maximum characters per code snippet
    SUPPORTED_LANGUAGES: List[str] = ["python", "java", "c"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()
