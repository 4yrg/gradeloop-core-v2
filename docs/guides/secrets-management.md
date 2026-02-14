# Secrets Management with HashiCorp Vault

> **Centralized secrets management for GradeLoop V2**  
> Epic: [GRADLOOP-5](https://gradeloop.atlassian.net/browse/GRADLOOP-5)  
> User Story: [GRADLOOP-11](https://gradeloop.atlassian.net/browse/GRADLOOP-11)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Local Development Setup](#local-development-setup)
- [Accessing Vault](#accessing-vault)
- [Working with Secrets](#working-with-secrets)
- [Using Secrets in Services](#using-secrets-in-services)
- [Service Authentication](#service-authentication)
- [CI/CD Integration](#cicd-integration)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Command Reference](#command-reference)
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
    ├── email-notify
    ├── cipas
    └── ivas
```

---

## Quick Start

### Start Vault

```bash
cd infra/compose
docker compose -f compose.dev.yaml up -d vault vault-init
```

### Access Vault UI

Open http://localhost:8200

**Login:**
- Method: Token
- Token: `dev-root-token`

### Verify Secrets

```bash
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='dev-root-token'

# List all secrets
vault kv list secret/

# Get database credentials
vault kv get secret/database/postgres
```

---

## Local Development Setup

### Prerequisites

- Docker & Docker Compose
- Go 1.23+ (for Go services)
- Python 3.11+ (for Python services)
- Vault CLI (optional, for manual operations)

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

The `vault-init` container automatically seeds Vault with development secrets on startup:

```bash
# Check initialization logs
docker compose -f infra/compose/compose.dev.yaml logs vault-init
```

**Manual initialization (if needed):**

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

### Step 4: Add to Shell Profile

Add to `~/.bashrc`, `~/.zshrc`, etc.:

```bash
# HashiCorp Vault (Development)
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='dev-root-token'
```

---

## Accessing Vault

### Vault UI

Open your browser to: **http://localhost:8200**

**Login Credentials:**
- Method: Token
- Token: `dev-root-token`

### Vault CLI (from host)

```bash
# Export environment variables
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='dev-root-token'

# Test connection
vault status

# List secrets
vault kv list secret/
```

### Vault CLI (inside container)

```bash
# Execute commands inside the container
docker exec -e VAULT_TOKEN=dev-root-token gradeloop-vault-dev vault <command>

# Example: List secrets
docker exec -e VAULT_TOKEN=dev-root-token gradeloop-vault-dev vault kv list secret/

# Example: Get database password
docker exec -e VAULT_TOKEN=dev-root-token gradeloop-vault-dev \
  vault kv get -field=password secret/database/postgres
```

---

## Working with Secrets

### Pre-Configured Secrets

The initialization script automatically creates the following secrets:

#### Database Secrets
```bash
vault kv get secret/database/postgres
```
**Fields:** `username`, `password`, `host`, `port`, `database`, `sslmode`

#### Redis Cache Secrets
```bash
vault kv get secret/cache/redis
```
**Fields:** `host`, `port`, `password`, `db`

#### JWT Auth Secrets
```bash
vault kv get secret/auth/jwt
```
**Fields:** `secret`, `algorithm`, `expiry`, `refresh_expiry`

#### Email/SMTP Secrets
```bash
vault kv get secret/email/smtp
```
**Fields:** `host`, `port`, `username`, `password`, `from`, `tls`

#### API Keys
```bash
vault kv get secret/api-keys/openai
vault kv get secret/api-keys/sendgrid
vault kv get secret/api-keys/stripe
```

#### Service-Specific Configuration
```bash
vault kv get secret/services/academics
vault kv get secret/services/assignment
vault kv get secret/services/email-notify
vault kv get secret/services/cipas
vault kv get secret/services/ivas
```

### Reading Secrets

#### Read Complete Secret
```bash
# Full output with metadata
vault kv get secret/database/postgres

# JSON output
vault kv get -format=json secret/database/postgres

# Specific field only
vault kv get -field=password secret/database/postgres
```

#### Example: Get Database Password
```bash
DB_PASSWORD=$(vault kv get -field=password secret/database/postgres)
echo $DB_PASSWORD
```

### Writing Secrets

#### Create/Update a Secret
```bash
# Single key-value
vault kv put secret/myapp/config api_key="sk_test_12345"

# Multiple key-values
vault kv put secret/database/postgres \
  username="gradeloop" \
  password="new_secure_password" \
  host="postgres" \
  port="5432" \
  database="gradeloop_dev" \
  sslmode="disable"
```

#### Update Single Field (patch)
```bash
vault kv patch secret/database/postgres password="updated_password"
```

#### Write from JSON File
```bash
vault kv put secret/myapp/config @config.json
```

### Managing Secrets

#### List Secret Paths
```bash
# Top level
vault kv list secret/

# Specific path
vault kv list secret/database/
vault kv list secret/services/
```

#### View Secret Metadata
```bash
vault kv metadata get secret/database/postgres
```

#### Delete a Secret
```bash
vault kv delete secret/path/to/secret
```

#### Undelete a Secret (restore previous version)
```bash
vault kv undelete -versions=1 secret/path/to/secret
```

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

### Integration Examples

#### Node.js/TypeScript
```typescript
import vault from 'node-vault';

const client = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
  token: process.env.VAULT_TOKEN || 'dev-root-token'
});

// Read secret
const { data } = await client.read('secret/data/database/postgres');
console.log(data.data); // { username: '...', password: '...' }
```

#### Curl
```bash
curl -H "X-Vault-Token: dev-root-token" \
  http://localhost:8200/v1/secret/data/database/postgres
```

### Docker Compose Environment

```yaml
services:
  myapp:
    environment:
      VAULT_ADDR: "http://vault:8200"
      VAULT_TOKEN: "dev-root-token"
```

---

## Service Authentication

### AppRole Authentication (for services)

AppRole is the recommended authentication method for service-to-service communication.

#### Available AppRoles

The following AppRoles are pre-configured:
- `academics-service`
- `assignment-service`
- `email-service`
- `cipas-service`
- `ivas-service`

#### Get Role ID and Secret ID

```bash
# Get Role ID
vault read -field=role_id auth/approle/role/academics-service/role-id

# Generate Secret ID
vault write -field=secret_id -f auth/approle/role/academics-service/secret-id
```

#### Login with AppRole (get token)

```bash
vault write auth/approle/login \
  role_id="<role-id>" \
  secret_id="<secret-id>"
```

#### View AppRole Policies

```bash
vault policy read academics-service
```

Each service has its own policy that restricts access to only the secrets it needs:

**Example: academics-service policy**
```hcl
path "secret/data/database/*" {
  capabilities = ["read"]
}
path "secret/data/cache/*" {
  capabilities = ["read"]
}
path "secret/data/auth/*" {
  capabilities = ["read"]
}
path "secret/data/services/academics" {
  capabilities = ["read"]
}
```

---

## CI/CD Integration

### GitHub Actions OIDC Setup

GradeLoop uses GitHub Actions OIDC to authenticate with Vault, eliminating static tokens.

#### Pre-Configuration

The `vault-init.sh` script automatically configures:
- JWT auth method
- GitHub Actions OIDC integration
- `github-actions` role with appropriate permissions
- `github-actions` policy for CI/CD access

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
            secret/data/api-keys/openai api_key | OPENAI_API_KEY
      
      - name: Use secrets
        run: |
          echo "Database password is configured"
          echo "OpenAI API key is configured"
```

---

## Security Best Practices

### Development ✅ DO

- ✅ Use dev mode for local development
- ✅ Use AppRole authentication for service-to-service
- ✅ Keep secrets out of version control
- ✅ Use `.env` files for local overrides (gitignored)
- ✅ Enable audit logging (enabled by default)
- ✅ Use environment variables for Vault address and token

### Production ✅ DO

- ✅ Use proper unsealing mechanisms (auto-unseal)
- ✅ Enable TLS/SSL for Vault
- ✅ Use namespaces for multi-tenancy
- ✅ Implement proper access policies
- ✅ Rotate secrets regularly
- ✅ Monitor audit logs for suspicious activity
- ✅ Use AppRole or OIDC for service authentication

### ❌ DON'T

- ❌ Never use dev mode in production
- ❌ Never use the root token for applications
- ❌ Never expose Vault on public networks without TLS
- ❌ Never hardcode tokens in source code
- ❌ Never commit secrets to Git
- ❌ Never disable audit logging
- ❌ Never log secret values

### Verification

#### Verify No Secrets in Docker Images

```bash
# Using docker history
docker history gradeloop/service:latest --no-trunc | grep -i "password\|secret\|token"

# Using dive (https://github.com/wagoodman/dive)
dive gradeloop/service:latest
```

---

## Troubleshooting

### Vault Not Starting

```bash
# Check logs
docker compose -f compose.dev.yaml logs vault

# Common issues:
# 1. Port 8200 already in use
sudo lsof -i :8200

# 2. Container crashed
docker compose -f compose.dev.yaml ps vault
docker compose -f compose.dev.yaml restart vault
```

### Vault Sealed

```bash
# Check status
vault status

# In dev mode, Vault auto-unseals, but if sealed:
vault operator unseal <unseal-key>
```

### Authentication Failed

```bash
# Verify token
echo $VAULT_TOKEN

# Re-export token
export VAULT_TOKEN='dev-root-token'

# Or use explicit token
vault login dev-root-token

# Check token validity
vault token lookup
```

### Secrets Not Found

```bash
# List available paths
vault kv list secret/

# Re-run initialization
docker compose -f compose.dev.yaml restart vault-init
docker compose -f compose.dev.yaml logs vault-init
```

### Connection Refused

```bash
# Check if Vault is running
docker compose -f compose.dev.yaml ps vault

# Verify VAULT_ADDR is correct
echo $VAULT_ADDR

# Test connectivity
curl http://localhost:8200/v1/sys/health
```

### Reset Vault (Clean Start)

```bash
# WARNING: This deletes all data!
docker compose -f compose.dev.yaml down -v
docker compose -f compose.dev.yaml up -d vault vault-init

# Verify initialization
docker compose -f compose.dev.yaml logs vault-init
```

---

## Command Reference

### Status and Health

```bash
# Check Vault status
vault status

# Check cluster members
vault operator members
```

### Secrets Management

```bash
# List secrets
vault kv list secret/
vault kv list secret/database/

# Get secret
vault kv get secret/path
vault kv get -format=json secret/path
vault kv get -field=key secret/path

# Put secret
vault kv put secret/path key=value
vault kv put secret/path key1=value1 key2=value2

# Patch secret (update single field)
vault kv patch secret/path key=newvalue

# Delete secret
vault kv delete secret/path

# View metadata
vault kv metadata get secret/path

# Undelete secret
vault kv undelete -versions=1 secret/path
```

### Authentication

```bash
# Login with token
vault login <token>

# Check current token
vault token lookup

# Renew token
vault token renew

# Revoke token
vault token revoke <token>
```

### Policies

```bash
# List policies
vault policy list

# Read policy
vault policy read <policy-name>

# Write policy
vault policy write <policy-name> policy.hcl

# Delete policy
vault policy delete <policy-name>
```

### Auth Methods

```bash
# List auth methods
vault auth list

# Enable auth method
vault auth enable <method>

# Disable auth method
vault auth disable <path>
```

### Audit

```bash
# List audit devices
vault audit list

# Enable audit device
vault audit enable file file_path=/vault/logs/audit.log

# Disable audit device
vault audit disable <path>
```

### Secrets Engines

```bash
# List secrets engines
vault secrets list

# Enable secrets engine
vault secrets enable -path=<path> <type>

# Disable secrets engine
vault secrets disable <path>
```

### Docker Container Commands

```bash
# Start Vault
docker compose -f compose.dev.yaml up -d vault vault-init

# Check status
docker compose -f compose.dev.yaml ps vault

# View logs
docker compose -f compose.dev.yaml logs vault
docker compose -f compose.dev.yaml logs vault-init

# Restart
docker compose -f compose.dev.yaml restart vault

# Stop
docker compose -f compose.dev.yaml down vault

# Execute command in container
docker exec -e VAULT_TOKEN=dev-root-token gradeloop-vault-dev vault <command>
```

---

## FAQ

### Q: Can I use Vault in production?

**A:** Yes! Deploy in HA mode with TLS, use AppRole/OIDC authentication, and implement auto-unseal. Never use dev mode in production.

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

### Q: What happens if Vault is down?

**A:** Services that need secrets will fail to start. Always ensure Vault is running before starting services. In production, deploy Vault in HA mode for redundancy.

### Q: How do I rotate secrets?

**A:** Update the secret in Vault, then restart services to pick up the new value:
```bash
vault kv patch secret/database/postgres password="new_password"
docker compose restart academics-service
```

### Q: Can I use different secrets for different environments?

**A:** Yes! Use namespaces in production Vault, or use different secret paths:
```
secret/dev/database/postgres
secret/staging/database/postgres
secret/prod/database/postgres
```

### Q: How do I back up Vault data?

**A:** In dev mode (in-memory storage), data is lost on restart. In production, use Raft integrated storage or external storage backends, and take regular snapshots:
```bash
vault operator raft snapshot save backup.snap
```

### Q: Why am I getting permission denied errors?

**A:** Check your token's policy:
```bash
vault token lookup
vault policy read <policy-name>
```

Ensure the policy grants the necessary capabilities (`read`, `create`, `update`, `delete`, `list`) for the path you're accessing.

---

## Additional Resources

- [Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [Vault API Reference](https://developer.hashicorp.com/vault/api-docs)
- [KV Secrets Engine v2](https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2)
- [AppRole Auth Method](https://developer.hashicorp.com/vault/docs/auth/approle)
- [Vault CLI Reference](https://developer.hashicorp.com/vault/docs/commands)
- [GitHub Actions OIDC with Vault](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-hashicorp-vault)

---

## Next Steps

- Review [Local Development Guide](local-dev-guide.md)
- Read [Service Communication](service-communication.md)
- Check [Observability](observability.md)
- See [Vault Setup Fixes](VAULT_SETUP_FIXES.md) for troubleshooting common issues

---

**Need help?** Contact `#gradeloop-dev` on Slack or check the logs:
```bash
docker compose -f compose.dev.yaml logs vault vault-init
```
