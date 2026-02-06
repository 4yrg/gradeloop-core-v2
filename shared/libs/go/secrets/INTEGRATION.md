# Vault Integration Guide

Complete guide for integrating HashiCorp Vault secrets management into GradeLoop services.

## Quick Start

### 1. Start Vault

```bash
# Use the quickstart script
./scripts/quickstart-vault.sh

# Or manually
docker compose -f infra/compose/compose.dev.yaml up -d vault
docker compose -f infra/compose/compose.dev.yaml up vault-init
```

### 2. Add to Your Service

**Go Service:**
```bash
cd apps/services/your-service
go get github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets
```

**Python Service:**
```bash
cd apps/services/your-service
pip install -e ../../../shared/libs/py/secrets
```

### 3. Use in Your Code

See examples in:
- `docs/examples/vault-integration/go-service-example.go`
- `docs/examples/vault-integration/python-service-example.py`

## Environment Variables

Set these in your service's environment:

```bash
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=dev-root-token  # Dev only! Use AppRole/OIDC in production
```

## Testing

**Go:**
```bash
cd shared/libs/go/secrets
go test -v
```

**Python:**
```bash
cd shared/libs/py/secrets
pytest -v
```

## Documentation

- [Full Documentation](../../../../docs/secrets-management.md)
- [Go Client README](README.md)
- [Python Client README](../py/secrets/README.md)

## Troubleshooting

### Vault not responding

```bash
docker compose -f infra/compose/compose.dev.yaml logs vault
docker compose -f infra/compose/compose.dev.yaml restart vault
```

### Secrets not found

```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=dev-root-token
vault kv list secret/
./scripts/vault-init.sh
```

## Support

- Documentation: `docs/secrets-management.md`
- Issues: GitHub Issues
- Slack: `#gradeloop-dev`
