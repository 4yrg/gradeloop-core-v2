"""
HashiCorp Vault client for Python services.
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

import hvac
from hvac.exceptions import VaultError


@dataclass
class Config:
    """Vault client configuration."""

    address: str = "http://localhost:8200"
    token: str = ""
    namespace: str = ""
    mount_path: str = "secret"
    timeout: int = 30
    verify: bool = False  # SSL verification

    @classmethod
    def from_env(cls) -> "Config":
        """Create configuration from environment variables."""
        return cls(
            address=os.getenv("VAULT_ADDR", "http://localhost:8200"),
            token=os.getenv("VAULT_TOKEN", ""),
            namespace=os.getenv("VAULT_NAMESPACE", ""),
            mount_path=os.getenv("VAULT_MOUNT_PATH", "secret"),
            timeout=int(os.getenv("VAULT_TIMEOUT", "30")),
            verify=os.getenv("VAULT_VERIFY_SSL", "false").lower() == "true",
        )


@dataclass
class DatabaseConfig:
    """Database connection configuration."""

    username: str
    password: str
    host: str
    port: str
    database: str
    sslmode: str = "disable"

    def connection_string(self) -> str:
        """Build PostgreSQL connection string."""
        return (
            f"host={self.host} port={self.port} "
            f"user={self.username} password={self.password} "
            f"dbname={self.database} sslmode={self.sslmode}"
        )

    def url(self) -> str:
        """Build PostgreSQL URL with properly encoded credentials."""
        encoded_username = quote_plus(self.username)
        encoded_password = quote_plus(self.password)
        return (
            f"postgresql://{encoded_username}:{encoded_password}"
            f"@{self.host}:{self.port}/{self.database}"
        )


@dataclass
class JWTConfig:
    """JWT authentication configuration."""

    secret: str
    algorithm: str
    expiry: str
    refresh_expiry: str


@dataclass
class RedisConfig:
    """Redis connection configuration."""

    host: str
    port: str
    password: str
    db: str = "0"

    def url(self) -> str:
        """Build Redis URL."""
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"


class SecretsClient:
    """
    Client for retrieving secrets from environment variables or Vault.
    """

    def __init__(self, config: Optional[Config] = None):
        """
        Initialize Secrets client.
        """
        self.config = config or Config.from_env()
        self._vault_client = None
        
        # Only try to initialize hvac if we have a vault address
        if self.config.address and os.getenv("USE_VAULT", "false").lower() == "true":
            try:
                self._vault_client = hvac.Client(
                    url=self.config.address,
                    token=self.config.token,
                    namespace=self.config.namespace,
                    verify=self.config.verify,
                    timeout=self.config.timeout,
                )
                if not self._vault_client.is_authenticated():
                    self._vault_client = None
            except Exception:
                self._vault_client = None

    def get_secret(self, path: str, key: str) -> str:
        """Retrieve a secret value."""
        # Check env first
        env_val = os.getenv(key)
        if env_val is not None:
            return env_val

        if self._vault_client:
            try:
                secrets = self.get_secret_map(path)
                return str(secrets.get(key, ""))
            except Exception:
                pass
        
        return ""

    def get_secret_map(self, path: str) -> Dict[str, Any]:
        """Retrieve all secrets at the given path."""
        if not self._vault_client:
            return {}

        try:
            response = self._vault_client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point=self.config.mount_path,
            )
            return response["data"].get("data", {}) if response else {}
        except Exception as e:
            return {}

    def get_database_config(self) -> DatabaseConfig:
        """Retrieve database configuration."""
        if os.getenv("POSTGRES_HOST"):
            return DatabaseConfig(
                username=os.getenv("POSTGRES_USER", "postgres"),
                password=os.getenv("POSTGRES_PASSWORD", "postgres"),
                host=os.getenv("POSTGRES_HOST", "localhost"),
                port=os.getenv("POSTGRES_PORT", "5432"),
                database=os.getenv("POSTGRES_DB", "gradeloop"),
                sslmode=os.getenv("POSTGRES_SSLMODE", "disable"),
            )

        secrets = self.get_secret_map("database/postgres")
        return DatabaseConfig(
            username=secrets.get("username", ""),
            password=secrets.get("password", ""),
            host=secrets.get("host", ""),
            port=secrets.get("port", "5432"),
            database=secrets.get("database", ""),
            sslmode=secrets.get("sslmode", "disable"),
        )

    def get_jwt_config(self) -> JWTConfig:
        """Retrieve JWT configuration."""
        if os.Getenv("JWT_ACCESS_SECRET"):
            return JWTConfig(
                secret=os.getenv("JWT_ACCESS_SECRET", ""),
                algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
                expiry=os.getenv("JWT_ACCESS_EXPIRY", "15m"),
                refresh_expiry=os.getenv("JWT_REFRESH_EXPIRY", "30d"),
            )

        secrets = self.get_secret_map("auth/jwt")
        return JWTConfig(
            secret=secrets.get("secret", ""),
            algorithm=secrets.get("algorithm", "HS256"),
            expiry=secrets.get("expiry", "24h"),
            refresh_expiry=secrets.get("refresh_expiry", "168h"),
        )

    def get_redis_config(self) -> RedisConfig:
        """Retrieve Redis configuration."""
        if os.getenv("REDIS_HOST"):
            return RedisConfig(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=os.getenv("REDIS_PORT", "6379"),
                password=os.getenv("REDIS_PASSWORD", ""),
                db=os.getenv("REDIS_DB", "0"),
            )

        secrets = self.get_secret_map("cache/redis")
        return RedisConfig(
            host=secrets.get("host", "localhost"),
            port=secrets.get("port", "6379"),
            password=secrets.get("password", ""),
            db=secrets.get("db", "0"),
        )

    @property
    def client(self) -> Optional[hvac.Client]:
        return self._vault_client

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False
