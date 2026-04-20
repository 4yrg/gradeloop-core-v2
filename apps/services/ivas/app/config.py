"""Configuration management for IVAS Service."""

from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """IVAS Service configuration.

    All secrets are supplied via environment variables injected from the
    root-level .env through docker-compose.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    service_name: str = Field(default="ivas-service", alias="SERVICE_NAME")
    service_port: int = Field(default=8101, alias="SERVICE_PORT")
    service_host: str = Field(default="0.0.0.0", alias="SERVICE_HOST")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")

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

    # Voice Authentication
    voice_similarity_threshold: float = Field(
        default=0.75,
        alias="VOICE_SIMILARITY_THRESHOLD",
    )
    voice_enrollment_samples: int = Field(
        default=3,
        alias="VOICE_ENROLLMENT_SAMPLES",
    )

    @property
    def database_dsn(self) -> str:
        """Return database DSN as string."""
        return str(self.database_url)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
