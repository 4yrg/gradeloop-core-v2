"""
Unit tests for Vault secrets client.
"""

import pytest
from unittest.mock import Mock, patch

from .client import (
    VaultClient,
    Config,
    DatabaseConfig,
    JWTConfig,
    RedisConfig,
)


def test_config_from_env():
    """Test configuration creation from environment variables."""
    with patch.dict('os.environ', {
        'VAULT_ADDR': 'http://vault.example.com:8200',
        'VAULT_TOKEN': 'test-token',
        'VAULT_NAMESPACE': 'gradeloop',
    }):
        config = Config.from_env()
        assert config.address == 'http://vault.example.com:8200'
        assert config.token == 'test-token'
        assert config.namespace == 'gradeloop'


def test_database_config_connection_string():
    """Test database connection string generation."""
    db_config = DatabaseConfig(
        username='testuser',
        password='testpass',
        host='localhost',
        port='5432',
        database='testdb',
        sslmode='disable',
    )
    
    conn_str = db_config.connection_string()
    assert 'host=localhost' in conn_str
    assert 'user=testuser' in conn_str
    assert 'password=testpass' in conn_str
    assert 'dbname=testdb' in conn_str


def test_database_config_url():
    """Test database URL generation."""
    db_config = DatabaseConfig(
        username='testuser',
        password='testpass',
        host='localhost',
        port='5432',
        database='testdb',
    )
    
    url = db_config.url()
    assert url == 'postgresql://testuser:testpass@localhost:5432/testdb'


def test_redis_config_url():
    """Test Redis URL generation."""
    redis_config = RedisConfig(
        host='localhost',
        port='6379',
        password='testpass',
        db='0',
    )
    
    url = redis_config.url()
    assert url == 'redis://:testpass@localhost:6379/0'


def test_redis_config_url_no_password():
    """Test Redis URL generation without password."""
    redis_config = RedisConfig(
        host='localhost',
        port='6379',
        password='',
        db='0',
    )
    
    url = redis_config.url()
    assert url == 'redis://localhost:6379/0'


def test_vault_client_init_without_address():
    """Test that client initialization fails without address."""
    config = Config(address='', token='test-token')
    
    with pytest.raises(ValueError, match='Vault address is required'):
        VaultClient(config)


@pytest.fixture
def mock_hvac_client():
    """Create a mock HVAC client."""
    with patch('secrets.client.hvac.Client') as mock_client:
        instance = Mock()
        instance.is_authenticated.return_value = True
        instance.secrets.kv.v2.read_secret_version.return_value = {
            'data': {
                'data': {
                    'username': 'testuser',
                    'password': 'testpass',
                }
            }
        }
        mock_client.return_value = instance
        yield instance


def test_get_secret_map(mock_hvac_client):
    """Test retrieving secret map."""
    config = Config(address='http://localhost:8200', token='test-token')
    client = VaultClient(config)
    
    secrets = client.get_secret_map('test/path')
    assert secrets['username'] == 'testuser'
    assert secrets['password'] == 'testpass'


def test_get_secret(mock_hvac_client):
    """Test retrieving a single secret."""
    config = Config(address='http://localhost:8200', token='test-token')
    client = VaultClient(config)
    
    value = client.get_secret('test/path', 'username')
    assert value == 'testuser'


def test_get_secret_key_not_found(mock_hvac_client):
    """Test that missing key raises KeyError."""
    config = Config(address='http://localhost:8200', token='test-token')
    client = VaultClient(config)
    
    with pytest.raises(KeyError, match="Key 'nonexistent' not found"):
        client.get_secret('test/path', 'nonexistent')


def test_context_manager():
    """Test client as context manager."""
    with patch('secrets.client.hvac.Client') as mock_client:
        instance = Mock()
        instance.is_authenticated.return_value = True
        mock_client.return_value = instance
        
        config = Config(address='http://localhost:8200', token='test-token')
        
        with VaultClient(config) as client:
            assert client is not None
