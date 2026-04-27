"""Configuration management for IVAS Service."""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_root_path() -> Path:
    """Find project root."""
    path = Path(__file__).resolve()
    for parent in path.parents:
        if (parent / "turbo.json").exists() or (parent / "package.json").exists():
            return parent
    # Fallback: return the first parent that looks like a service root or just /app
    return Path("/app") if Path("/app").exists() else path.parents[1]


class Settings(BaseSettings):
    """IVAS Service configuration.

    All secrets are supplied via environment variables injected from the
    root-level .env through docker-compose.
    """

    model_config = SettingsConfigDict(
        env_file=[
            get_root_path() / f".env.{os.getenv('APP_ENV', 'development')}",
            get_root_path() / ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    service_name: str = Field(default="ivas-service", alias="SERVICE_NAME")
    service_port: int = Field(default=8101, alias="SERVICE_PORT")
    service_host: str = Field(default="0.0.0.0", alias="SERVICE_HOST")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="APP_ENV")

    # PostgreSQL (dedicated ivas-postgres instance)
    database_url: PostgresDsn = Field(
        default="postgresql://ivas_user:ivas_pass@localhost:5434/ivas-db",
        alias="DATABASE_URL",
    )

    # Redis
    redis_url: str = Field(
        default="redis://localhost:6379/1",
        alias="REDIS_URL",
    )

    # MinIO
    minio_endpoint: str = Field(default="localhost:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minio", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minio123", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="ivas-audio", alias="MINIO_BUCKET")
    minio_use_ssl: bool = Field(default=False, alias="MINIO_USE_SSL")

    # Gemini Live API (IVAS-specific key)
    gemini_api_key: str = Field(
        default="SET_YOUR_API_KEY_HERE",
        alias="IVAS_GEMINI_API_KEY",
    )
    gemini_live_model: str = Field(
        default="gemini-2.0-flash-live-001",
        alias="IVAS_GEMINI_LIVE_MODEL",
    )
    gemini_grader_model: str = Field(
        default="gemini-3.1-flash-lite-preview",
        alias="IVAS_GEMINI_GRADER_MODEL",
    )

    # Voice Authentication
    voice_similarity_threshold: float = Field(
        default=0.75,
        alias="VOICE_SIMILARITY_THRESHOLD",
    )
    voice_enrollment_samples: int = Field(
        default=3,
        alias="VOICE_ENROLLMENT_SAMPLES",
    )
    voice_verify_interval_seconds: float = Field(
        default=3.0,
        alias="VOICE_VERIFY_INTERVAL_SECONDS",
    )

    @property
    def database_dsn(self) -> str:
        """Return database DSN as string."""
        return str(self.database_url)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
