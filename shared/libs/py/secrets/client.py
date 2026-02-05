"""
HashiCorp Vault client for Python services.
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

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
        """Build PostgreSQL URL."""
        return (
            f"postgresql://{self.username}:{self.password}"
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


class VaultClient:
    """
    HashiCorp Vault client for retrieving secrets.
    
    Usage:
        >>> client = VaultClient()
        >>> db_config = client.get_database_config()
        >>> print(db_config.connection_string())
    """
    
    def __init__(self, config: Optional[Config] = None):
        """
        Initialize Vault client.
        
        Args:
            config: Vault configuration. If None, uses environment variables.
        
        Raises:
            ValueError: If configuration is invalid.
            VaultError: If connection to Vault fails.
        """
        self.config = config or Config.from_env()
        
        if not self.config.address:
            raise ValueError("Vault address is required")
        
        # Create HVAC client
        self._client = hvac.Client(
            url=self.config.address,
            token=self.config.token,
            namespace=self.config.namespace,
            verify=self.config.verify,
            timeout=self.config.timeout,
        )
        
        # Verify authentication
        if self.config.token and not self._client.is_authenticated():
            raise VaultError("Failed to authenticate with Vault")
    
    def get_secret(self, path: str, key: str) -> str:
        """
        Retrieve a single secret value.
        
        Args:
            path: Secret path (relative to mount point)
            key: Secret key
        
        Returns:
            Secret value as string
        
        Raises:
            VaultError: If secret retrieval fails
            KeyError: If key doesn't exist in secret
        """
        secrets = self.get_secret_map(path)
        
        if key not in secrets:
            raise KeyError(f"Key '{key}' not found in secret path '{path}'")
        
        return str(secrets[key])
    
    def get_secret_map(self, path: str) -> Dict[str, Any]:
        """
        Retrieve all secrets at the given path.
        
        Args:
            path: Secret path (relative to mount point)
        
        Returns:
            Dictionary of secret key-value pairs
        
        Raises:
            VaultError: If secret retrieval fails
        """
        try:
            # KV v2 read
            response = self._client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point=self.config.mount_path,
            )
            
            if not response or "data" not in response:
                raise VaultError(f"No secret found at path '{path}'")
            
            data = response["data"].get("data", {})
            return data
            
        except Exception as e:
            raise VaultError(f"Failed to read secret at path '{path}': {str(e)}")
    
    def get_database_config(self) -> DatabaseConfig:
        """
        Retrieve database configuration from Vault.
        
        Returns:
            DatabaseConfig object
        
        Raises:
            VaultError: If configuration retrieval fails
        """
        path = "database/postgres"
        secrets = self.get_secret_map(path)
        
        return DatabaseConfig(
            username=secrets.get("username", ""),
            password=secrets.get("password", ""),
            host=secrets.get("host", ""),
            port=secrets.get("port", "5432"),
            database=secrets.get("database", ""),
            sslmode=secrets.get("sslmode", "disable"),
        )
    
    def get_jwt_config(self) -> JWTConfig:
        """
        Retrieve JWT configuration from Vault.
        
        Returns:
            JWTConfig object
        
        Raises:
            VaultError: If configuration retrieval fails
        """
        path = "auth/jwt"
        secrets = self.get_secret_map(path)
        
        return JWTConfig(
            secret=secrets.get("secret", ""),
            algorithm=secrets.get("algorithm", "HS256"),
            expiry=secrets.get("expiry", "24h"),
            refresh_expiry=secrets.get("refresh_expiry", "168h"),
        )
    
    def get_redis_config(self) -> RedisConfig:
        """
        Retrieve Redis configuration from Vault.
        
        Returns:
            RedisConfig object
        
        Raises:
            VaultError: If configuration retrieval fails
        """
        path = "cache/redis"
        secrets = self.get_secret_map(path)
        
        return RedisConfig(
            host=secrets.get("host", "localhost"),
            port=secrets.get("port", "6379"),
            password=secrets.get("password", ""),
            db=secrets.get("db", "0"),
        )
    
    def close(self):
        """Close the client and clean up resources."""
        # HVAC client doesn't require explicit cleanup
        pass
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
        return False
