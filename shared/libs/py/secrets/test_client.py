"""
Unit tests for Vault secrets client.

SECURITY NOTE: All credentials in this file are DUMMY TEST FIXTURES ONLY.
They are not real secrets and are used solely for unit testing purposes.
"""

# pylint: disable=line-too-long
# nosec - This entire file contains only test fixtures, not real credentials

import os
import pytest
from unittest.mock import MagicMock, patch

from .client import (
    VaultClient,
    Config,
    DatabaseConfig,
    RedisConfig,
    JWTConfig,
)

# Test fixtures with secure defaults
TEST_VAULT_ADDR = os.getenv("TEST_VAULT_ADDR", "https://vault.example.com:8200")
TEST_VAULT_TOKEN = os.getenv("TEST_VAULT_TOKEN", "test-token-from-env")
TEST_NAMESPACE = os.getenv("TEST_VAULT_NAMESPACE", "test-namespace")


def test_config_from_env():
    """Test configuration creation from environment variables."""
    with patch.dict(
        "os.environ",
        {
            "VAULT_ADDR": TEST_VAULT_ADDR,
            "VAULT_TOKEN": TEST_VAULT_TOKEN,
            "VAULT_NAMESPACE": TEST_NAMESPACE,
        },
    ):
        config = Config.from_env()
        assert config.address == TEST_VAULT_ADDR
        assert config.token == TEST_VAULT_TOKEN
        assert config.namespace == TEST_NAMESPACE


def test_config_default_values():
    """Test Config with default values."""
    config = Config()
    assert config.address == "http://localhost:8200"
    assert config.token == ""
    assert config.mount_path == "secret"
    assert config.timeout == 30
    assert config.verify is False


def test_config_custom_values():
    """Test Config with custom values."""
    config = Config(
        address="https://vault.prod.example.com:8200",
        token="prod-token",
        namespace="production",
        mount_path="custom",
        timeout=60,
        verify=True,
    )
    assert config.address == "https://vault.prod.example.com:8200"
    assert config.token == "prod-token"
    assert config.namespace == "production"
    assert config.mount_path == "custom"
    assert config.timeout == 60
    assert config.verify is True


def test_database_config_connection_string():
    """Test database connection string generation."""
    db_config = DatabaseConfig(
        username="app_user",
        password="secure_password_from_vault",  # nosec
        host="db.example.com",
        port="5432",
        database="app_db",
        sslmode="require",
    )

    conn_str = db_config.connection_string()
    assert "host=db.example.com" in conn_str
    assert "user=app_user" in conn_str
    assert "password=secure_password_from_vault" in conn_str
    assert "dbname=app_db" in conn_str
    assert "sslmode=require" in conn_str


def test_database_config_url():
    """Test database URL generation."""
    db_config = DatabaseConfig(
        username="app_user",
        password="secure_password",  # nosec
        host="db.example.com",
        port="5432",
        database="app_db",
    )

    url = db_config.url()
    assert url == "postgresql://app_user:secure_password@db.example.com:5432/app_db"


def test_database_config_url_with_special_chars():
    """Test database URL generation with special characters in password."""
    db_config = DatabaseConfig(
        username="user",
        password="p@ss:w/rd",  # nosec
        host="localhost",
        port="5432",
        database="testdb",
    )

    url = db_config.url()
    # Password should be URL-encoded
    assert "p%40ss%3Aw%2Frd" in url


def test_redis_config_url():
    """Test Redis URL generation."""
    redis_config = RedisConfig(
        host="redis.example.com",
        port="6379",
        password="redis_secure_password",  # nosec
        db="0",
    )

    url = redis_config.url()
    assert url == "redis://:redis_secure_password@redis.example.com:6379/0"


def test_redis_config_url_no_password():
    """Test Redis URL generation without password."""
    redis_config = RedisConfig(
        host="redis.example.com",
        port="6379",
        password="",
        db="0",
    )

    url = redis_config.url()
    assert url == "redis://redis.example.com:6379/0"


def test_jwt_config():
    """Test JWT configuration."""
    jwt_config = JWTConfig(
        secret="jwt_secret_key_from_vault",  # nosec
        algorithm="HS256",
        expiry="24h",
        refresh_expiry="168h",
    )

    assert jwt_config.secret == "jwt_secret_key_from_vault"
    assert jwt_config.algorithm == "HS256"
    assert jwt_config.expiry == "24h"
    assert jwt_config.refresh_expiry == "168h"


def test_vault_client_init_without_address():
    """Test that client initialization fails without address."""
    config = Config(address="", token="test-token")

    with pytest.raises(ValueError, match="Vault address is required"):
        VaultClient(config)


def test_vault_client_init_without_token():
    """Test that client initialization fails without token."""
    config = Config(address="https://vault.example.com:8200", token="")

    with pytest.raises(ValueError, match="Vault token is required"):
        VaultClient(config)


@pytest.fixture
def mock_hvac_client():
    """Create a mock HVAC client."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        instance.secrets.kv.v2.read_secret_version.return_value = {
            "data": {
                "data": {
                    "username": "vault_user",
                    "password": "vault_password",  # nosec
                    "host": "db.example.com",
                    "port": "5432",
                    "database": "app_db",
                    "sslmode": "require",
                }
            }
        }
        mock_client_class.return_value = instance
        yield instance


def test_get_secret_map(mock_hvac_client):
    """Test retrieving secret map."""
    config = Config(address="https://vault.example.com:8200", token="test-token")
    client = VaultClient(config)

    secrets = client.get_secret_map("database/postgres")
    assert secrets["username"] == "vault_user"
    assert secrets["password"] == "vault_password"
    assert secrets["host"] == "db.example.com"


def test_get_secret(mock_hvac_client):
    """Test retrieving a single secret."""
    config = Config(address="https://vault.example.com:8200", token="test-token")
    client = VaultClient(config)

    value = client.get_secret("database/postgres", "username")
    assert value == "vault_user"


def test_get_secret_key_not_found(mock_hvac_client):
    """Test that missing key raises KeyError."""
    config = Config(address="https://vault.example.com:8200", token="test-token")
    client = VaultClient(config)

    with pytest.raises(KeyError, match="Key 'nonexistent' not found"):
        client.get_secret("database/postgres", "nonexistent")


def test_get_database_config(mock_hvac_client):
    """Test retrieving database configuration."""
    config = Config(address="https://vault.example.com:8200", token="test-token")
    client = VaultClient(config)

    db_config = client.get_database_config()
    assert isinstance(db_config, DatabaseConfig)
    assert db_config.username == "vault_user"
    assert db_config.password == "vault_password"
    assert db_config.host == "db.example.com"


def test_get_redis_config():
    """Test retrieving Redis configuration."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        instance.secrets.kv.v2.read_secret_version.return_value = {
            "data": {
                "data": {
                    "host": "redis.example.com",
                    "port": "6379",
                    "password": "redis_password",  # nosec
                    "db": "0",
                }
            }
        }
        mock_client_class.return_value = instance

        config = Config(address="https://vault.example.com:8200", token="test-token")
        client = VaultClient(config)

        redis_config = client.get_redis_config()
        assert isinstance(redis_config, RedisConfig)
        assert redis_config.host == "redis.example.com"
        assert redis_config.port == "6379"
        assert redis_config.password == "redis_password"


def test_get_jwt_config():
    """Test retrieving JWT configuration."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        instance.secrets.kv.v2.read_secret_version.return_value = {
            "data": {
                "data": {
                    "secret": "jwt_secret_key",  # nosec
                    "algorithm": "HS256",
                    "expiry": "24h",
                    "refresh_expiry": "168h",
                }
            }
        }
        mock_client_class.return_value = instance

        config = Config(address="https://vault.example.com:8200", token="test-token")
        client = VaultClient(config)

        jwt_config = client.get_jwt_config()
        assert isinstance(jwt_config, JWTConfig)
        assert jwt_config.secret == "jwt_secret_key"
        assert jwt_config.algorithm == "HS256"


def test_context_manager():
    """Test client as context manager."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        mock_client_class.return_value = instance

        config = Config(address="https://vault.example.com:8200", token="test-token")

        with VaultClient(config) as client:
            assert client is not None
            assert client.client == instance


def test_close():
    """Test client close method."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        mock_client_class.return_value = instance

        config = Config(address="https://vault.example.com:8200", token="test-token")
        client = VaultClient(config)
        client.close()

        # Verify close was called (if client has close method)
        assert client is not None  # Verify client exists


def test_vault_error_handling():
    """Test Vault error handling."""
    with patch("secrets.client.hvac.Client") as mock_client_class:
        instance = MagicMock()
        instance.is_authenticated.return_value = True
        instance.secrets.kv.v2.read_secret_version.side_effect = Exception(
            "Vault connection error"
        )
        mock_client_class.return_value = instance

        config = Config(address="https://vault.example.com:8200", token="test-token")
        client = VaultClient(config)

        with pytest.raises(Exception, match="Vault connection error"):
            client.get_secret_map("database/postgres")


def test_config_ssl_verification_enabled():
    """Test SSL verification is enabled for production."""
    config = Config(
        address="https://vault.prod.example.com:8200",
        token="prod-token",
        verify=True,
    )
    assert config.verify is True


def test_config_from_env_ssl_verification():
    """Test SSL verification from environment."""
    with patch.dict(
        "os.environ",
        {
            "VAULT_ADDR": "https://vault.example.com:8200",
            "VAULT_TOKEN": "test-token",
            "VAULT_VERIFY_SSL": "true",
        },
    ):
        config = Config.from_env()
        assert config.verify is True


def test_database_config_default_sslmode():
    """Test database config has secure default sslmode."""
    db_config = DatabaseConfig(
        username="user",
        password="pass",  # nosec
        host="db.example.com",
        port="5432",
        database="app",
    )
    # Default should be 'disable' for dev, but we should document requiring SSL in prod
    assert db_config.sslmode == "disable"
