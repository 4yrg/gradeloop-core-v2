# GradeLoop Secrets Client (Python)

A Python library for securely retrieving secrets from HashiCorp Vault.

## Features

- KV v2 secrets engine support
- Type-safe configuration with dataclasses
- Context manager support
- Connection string/URL builders for databases and Redis
- Environment variable configuration
- Type hints throughout

## Installation

```bash
pip install -e shared/libs/py/secrets
```

Or with poetry:

```bash
poetry add -e shared/libs/py/secrets
```

## Usage

### Basic Usage

```python
from secrets import VaultClient

# Create client with default config (reads from environment)
client = VaultClient()

# Get a single secret value
api_key = client.get_secret("api-keys/openai", "api_key")
print(f"Retrieved API key: {api_key[:10]}...")

# Get all secrets at a path
secrets = client.get_secret_map("services/my-service")
for key, value in secrets.items():
    print(f"{key}: {value}")
```

### Using Context Manager

```python
from secrets import VaultClient

with VaultClient() as client:
    db_config = client.get_database_config()
    print(db_config.connection_string())
```

### Database Configuration

```python
from secrets import VaultClient

client = VaultClient()

# Get database configuration
db_config = client.get_database_config()

# Use with psycopg2
import psycopg2
conn = psycopg2.connect(db_config.connection_string())

# Or use the URL format
from sqlalchemy import create_engine
engine = create_engine(db_config.url())
```

### Redis Configuration

```python
from secrets import VaultClient
import redis

client = VaultClient()

# Get Redis configuration
redis_config = client.get_redis_config()

# Use with redis-py
r = redis.from_url(redis_config.url())
```

### Custom Configuration

```python
from secrets import VaultClient, Config

config = Config(
    address="http://vault.example.com:8200",
    token="s.your-vault-token",
    namespace="gradeloop",
    mount_path="secret",
    timeout=30,
    verify=True,  # Enable SSL verification
)

client = VaultClient(config)
```

### JWT Configuration

```python
from secrets import VaultClient

client = VaultClient()
jwt_config = client.get_jwt_config()

# Use with PyJWT
import jwt

token = jwt.encode(
    {"user_id": 123},
    jwt_config.secret,
    algorithm=jwt_config.algorithm
)
```

## Environment Variables

The client reads the following environment variables:

- `VAULT_ADDR`: Vault server address (default: `http://localhost:8200`)
- `VAULT_TOKEN`: Vault authentication token
- `VAULT_NAMESPACE`: Vault namespace (optional)
- `VAULT_MOUNT_PATH`: KV secrets engine mount path (default: `secret`)
- `VAULT_TIMEOUT`: Request timeout in seconds (default: `30`)
- `VAULT_VERIFY_SSL`: Enable SSL verification (default: `false`)

## Error Handling

```python
from secrets import VaultClient
from hvac.exceptions import VaultError

client = VaultClient()

try:
    secret = client.get_secret("path/to/secret", "key")
except KeyError as e:
    print(f"Secret key not found: {e}")
except VaultError as e:
    print(f"Vault error: {e}")
```

## Testing

```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest

# Run with coverage
pytest --cov=secrets --cov-report=html
```

## Integration with FastAPI

```python
from fastapi import FastAPI, Depends
from secrets import VaultClient
from functools import lru_cache

@lru_cache()
def get_secrets_client():
    return VaultClient()

app = FastAPI()

@app.on_event("startup")
async def startup():
    client = get_secrets_client()
    db_config = client.get_database_config()
    # Initialize database connection pool with db_config

@app.get("/health")
async def health(client: VaultClient = Depends(get_secrets_client)):
    # Client available for dependency injection
    return {"status": "healthy"}
```

## Integration with Django

```python
# settings.py
from secrets import VaultClient

client = VaultClient()
db_config = client.get_database_config()

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': db_config.database,
        'USER': db_config.username,
        'PASSWORD': db_config.password,
        'HOST': db_config.host,
        'PORT': db_config.port,
    }
}
```

## Security Considerations

1. **Never hardcode tokens**: Always use environment variables
2. **Use AppRole or OIDC**: In production, use AppRole or OIDC instead of static tokens
3. **Enable SSL verification**: Set `verify=True` in production
4. **Rotate tokens regularly**: Implement token renewal for long-running services
5. **Audit logging**: Ensure Vault audit logging is enabled

## License

Copyright © 2024 GradeLoop
