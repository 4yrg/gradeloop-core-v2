"""Configuration management for ACAFS Engine."""

from functools import lru_cache
from typing import Optional

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """ACAFS Engine configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    service_name: str = Field(default="acafs-service", alias="SERVICE_NAME")
    service_port: int = Field(default=8086, alias="SERVICE_PORT")
    service_host: str = Field(default="0.0.0.0", alias="SERVICE_HOST")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")

    # RabbitMQ
    rabbitmq_url: str = Field(
        default="amqp://guest:guest@localhost:5672/",
        alias="RABBITMQ_URL",
    )
    rabbitmq_exchange: str = Field(default="submissions", alias="RABBITMQ_EXCHANGE")
    rabbitmq_queue: str = Field(default="acafs.evaluation", alias="RABBITMQ_QUEUE")
    rabbitmq_routing_key: str = Field(
        default="submission.created",
        alias="RABBITMQ_ROUTING_KEY",
    )
    rabbitmq_concurrency: int = Field(default=4, alias="RABBITMQ_CONCURRENCY")

    # PostgreSQL
    database_url: PostgresDsn = Field(
        default="postgresql://postgres:postgres@localhost:5432/acafs_db",
        alias="DATABASE_URL",
    )

    # MinIO
    minio_endpoint: str = Field(default="localhost:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minio", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minio123", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="submissions", alias="MINIO_BUCKET")
    minio_use_ssl: bool = Field(default=False, alias="MINIO_USE_SSL")

    # AST Parser
    ast_max_lines: int = Field(default=5000, alias="AST_MAX_LINES")
    ast_timeout_seconds: int = Field(default=2, alias="AST_TIMEOUT_SECONDS")

    # LLM Configuration
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_model: str = Field(default="gpt-4", alias="LLM_MODEL")
    llm_base_url: str = Field(default="", alias="LLM_BASE_URL")

    @property
    def database_dsn(self) -> str:
        """Return database DSN as string."""
        return str(self.database_url)


# Default ACAFS Blueprint Rubric Configuration
DEFAULT_RUBRIC_CONFIG = {
    "execution": {
        "weight": 30,
        "fixed": True,
        "test_cases": [],
    },
    "dimensions": [
        {
            "id": "logical_correctness",
            "name": "Logical Correctness",
            "weight": 25,
            "description": "Algorithmic accuracy and logical flow of the solution",
        },
        {
            "id": "best_practices",
            "name": "Best Practices",
            "weight": 20,
            "description": "Bounds checking, initialization, error handling, and defensive programming",
        },
        {
            "id": "code_quality",
            "name": "Code Quality",
            "weight": 15,
            "description": "Readability, modularity, naming conventions, and code organization",
        },
        {
            "id": "conceptual_understanding",
            "name": "Conceptual Understanding",
            "weight": 10,
            "description": "Appropriate use of programming paradigms (recursion vs iteration, etc.)",
        },
    ],
}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
