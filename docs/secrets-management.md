# Secrets Management with HashiCorp Vault

> **Centralized secrets management for GradeLoop V2**  
> Epic: [GRADLOOP-5](https://gradeloop.atlassian.net/browse/GRADLOOP-5)  
> User Story: [GRADLOOP-11](https://gradeloop.atlassian.net/browse/GRADLOOP-11)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Local Development Setup](#local-development-setup)
- [Using Secrets in Services](#using-secrets-in-services)
- [CI/CD Integration](#cicd-integration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

GradeLoop V2 uses **HashiCorp Vault** as the centralized secrets management system. All sensitive data (database passwords, API keys, JWT secrets, etc.) are stored in Vault and retrieved at runtime by services.

### Why Vault?

- **Zero secrets in Git**: No plaintext secrets in version control
- **No secrets in Docker images**: Verified with `docker history` and `dive`
- **Audit logging**: Every secret access is logged for compliance
- **Dynamic secrets**: Support for rotating credentials
- **Industry standard**: Open-source, proven, widely adopted

### Key Benefits

✅ **Security**: Secrets never exposed in code, config files, or container layers  
✅ **Compliance**: Meets institutional data handling requirements for PII systems  
✅ **Developer Experience**: Simple APIs for Go and Python services  
✅ **CI/CD Ready**: GitHub Actions OIDC integration for secure automation  
✅ **Audit Trail**: Complete logging of all secret access attempts

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     GradeLoop Services                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Academics   │  │  Assignment  │  │    CIPAS     │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼─────────┐                       │
│                   │  Secrets Client  │                       │
│                   │   (Go/Python)    │                       │
│                   └────────┬─────────┘                       │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  HashiCorp Vault │
                    │   (KV v2 Engine) │
                    └──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Audit Logs     │
                    └──────────────────┘
```

### Secret Organization

Vault secrets are organized hierarchically:

```
secret/
├── database/
│   └── postgres          # PostgreSQL credentials
├── cache/
│   └── redis             # Redis connection details
├── auth/
│   └── jwt               # JWT signing keys
├── api-keys/
│   ├── openai            # OpenAI API key
│   ├── sendgrid          # SendGrid API key
│   └── stripe            # Stripe API keys
├── email/
│   └── smtp              # SMTP configuration
└── services/
    ├── academics         # Service-specific config
    ├── assignment
    ├── cipas
    └── ivas
```

---

## Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Go 1.23+ (for Go services)
- Python 3.11+ (for Python services)
- `openssl` (for generating secrets)

### Step 1: Start Vault

```bash
# Start Docker Compose stack (includes Vault in dev mode)
docker compose -f infra/compose/compose.dev.yaml up -d vault

# Wait for Vault to be ready
docker compose -f infra/compose/compose.dev.yaml logs -f vault
```

**Expected output:**
```
vault    | ==> Vault server started! Log data will stream in below:
vault    | ==> Vault server configuration:
vault    |              Api Address: http://0.0.0.0:8200
vault    |          Dev Mode Root Token: dev-root-token
```

### Step 2: Initialize Secrets

Run the initialization script to seed Vault with development secrets:

```bash
# Interactive mode (prompts for secrets)
./scripts/vault-init.sh --interactive

# Auto mode (uses default development values)
./scripts/vault-init.sh

# CI mode
./scripts/vault-init.sh --ci
```

**Interactive mode example:**
```bash
$ ./scripts/vault-init.sh --interactive
[INFO] GradeLoop V2 - Vault Initialization Script
[INFO] Vault Address: http://localhost:8200
[SUCCESS] Vault is ready!

Enter PostgreSQL password (default: gradeloop_dev_pass): 
Enter Redis password (default: gradeloop_redis_dev): 
Enter JWT secret (leave empty to auto-generate): 

[SUCCESS] Vault initialization complete!
[INFO] Vault UI: http://localhost:8200
[INFO] Root Token: dev-root-token
```

### Step 3: Verify Setup

```bash
# Set environment variables
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="dev-root-token"

# Test Vault CLI
vault status

# Read a secret
vault kv get secret/database/postgres

# List all secrets
vault kv list secret/
```

### Step 4: Access Vault UI

Open http://localhost:8200 in your browser.

**Login credentials:**
- Token: `dev-root-token`

Navigate through the secret paths to verify everything is seeded correctly.

---

## Using Secrets in Services

### Go Services

#### 1. Add Dependency

```bash
cd apps/services/your-service
go get github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets
```

#### 2. Initialize Client

```go
// cmd/server/main.go
package main

import (
    "context"
    "log"
    "database/sql"
    
    "github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets"
    _ "github.com/lib/pq"
)

func main() {
    ctx := context.Background()
    
    // Initialize secrets client
    secretsClient, err := secrets.NewClient(nil)
    if err != nil {
        log.Fatalf("Failed to initialize secrets: %v", err)
    }
    defer secretsClient.Close()
    
    // Get database configuration
    dbConfig, err := secretsClient.GetDatabaseConfig(ctx)
    if err != nil {
        log.Fatalf("Failed to get database config: %v", err)
    }
    
    // Connect to database
    db, err := sql.Open("postgres", dbConfig.ConnectionString())
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()
    
    log.Println("Connected to database successfully!")
}
```

#### 3. Environment Variables

```bash
# Set in your service's docker-compose or .env
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=dev-root-token  # Dev mode only!
```

#### 4. Get Custom Secrets

```go
// Get API key
apiKey, err := secretsClient.GetSecret(ctx, "api-keys/openai", "api_key")
if err != nil {
    log.Fatal(err)
}

// Get all secrets at a path
serviceConfig, err := secretsClient.GetSecretMap(ctx, "services/academics")
if err != nil {
    log.Fatal(err)
}
```

### Python Services

#### 1. Add Dependency

```bash
cd apps/services/your-service
pip install -e ../../shared/libs/py/secrets
```

#### 2. Initialize Client

```python
# src/main.py
from secrets import VaultClient

def main():
    # Initialize secrets client
    vault_client = VaultClient()
    
    # Get database configuration
    db_config = vault_client.get_database_config()
    
    # Use with SQLAlchemy
    from sqlalchemy import create_engine
    engine = create_engine(db_config.url())
    
    print("Connected to database successfully!")

if __name__ == "__main__":
    main()
```

#### 3. Context Manager Usage

```python
from secrets import VaultClient

with VaultClient() as client:
    jwt_config = client.get_jwt_config()
    api_key = client.get_secret("api-keys/openai", "api_key")
```

---

## CI/CD Integration

### GitHub Actions OIDC Setup

GradeLoop uses GitHub Actions OIDC to authenticate with Vault, eliminating static tokens.

#### Use in GitHub Actions Workflow

```yaml
name: Build and Deploy

on:
  push:
    branches: [main, develop]

permissions:
  id-token: write  # Required for OIDC
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Authenticate with Vault
        uses: hashicorp/vault-action@v2
        with:
          url: ${{ secrets.VAULT_ADDR }}
          method: jwt
          role: github-actions
          secrets: |
            secret/data/database/postgres password | DB_PASSWORD
```

---

## Security Best Practices

### ✅ DO

1. **Use environment variables** for Vault address and token
2. **Rotate tokens regularly** in production
3. **Enable audit logging** (enabled by default)
4. **Use AppRole or OIDC** for service authentication
5. **Enable TLS/SSL** for Vault in production
6. **Monitor audit logs** for suspicious activity

### ❌ DON'T

1. **Never hardcode tokens** in source code
2. **Never commit secrets to Git**
3. **Never use dev-root-token** in production
4. **Never disable audit logging**
5. **Never log secret values**

---

## Troubleshooting

### Vault is not responding

```bash
# Check if Vault is running
docker compose -f infra/compose/compose.dev.yaml ps vault

# View logs
docker compose -f infra/compose/compose.dev.yaml logs vault

# Restart Vault
docker compose -f infra/compose/compose.dev.yaml restart vault
```

### Authentication failed

```bash
# Verify token
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="dev-root-token"
vault token lookup
```

### Secret not found

```bash
# List available secrets
vault kv list secret/

# Re-run initialization
./scripts/vault-init.sh
```

---

## FAQ

### Q: Can I use Vault in production?

**A:** Yes! Deploy in HA mode with TLS, use AppRole/OIDC, and implement auto-unseal.

### Q: How do I add new secrets?

**A:** Via Vault UI (http://localhost:8200) or CLI:
```bash
vault kv put secret/api-keys/newservice api_key="your-key"
```

### Q: How do I verify no secrets in Docker images?

**A:** Use `docker history` or the `dive` tool:
```bash
docker history gradeloop/service:latest --no-trunc | grep -i "password\|secret"
```

---

## Next Steps

- Review [Local Development Guide](local-dev-guide.md)
- Read [Service Communication](service-communication.md)
- Check [Observability](observability.md)

---

**Need help?** Contact `#gradeloop-dev` on Slack or open an issue.