#!/bin/bash
# Quick start script for Vault secrets management
# This script sets up Vault for local development in one command

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 GradeLoop V2 - Vault Quickstart"
echo "===================================="
echo ""

# Step 1: Start Vault
echo "📦 Step 1/4: Starting Vault container..."
cd "$PROJECT_ROOT"
docker compose -f infra/compose/compose.dev.yaml up -d vault

echo "⏳ Waiting for Vault to be ready..."
sleep 5

# Step 2: Check Vault health
echo "🏥 Step 2/4: Checking Vault health..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker compose -f infra/compose/compose.dev.yaml exec -T vault vault status > /dev/null 2>&1; then
        echo "✅ Vault is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Vault failed to become healthy"
    exit 1
fi

# Step 3: Initialize secrets
echo "🔐 Step 3/4: Initializing secrets..."
docker compose -f infra/compose/compose.dev.yaml up vault-init

# Step 4: Verify setup
echo "✅ Step 4/4: Verifying setup..."
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="dev-root-token"

if command -v vault >/dev/null 2>&1; then
    echo ""
    echo "Testing Vault access..."
    vault kv list secret/ || echo "Vault CLI not available, skipping verification"
fi

echo ""
echo "========================================" 
echo "✨ Vault is ready!"
echo "========================================" 
echo ""
echo "Vault UI: http://localhost:8200"
echo "Root Token: dev-root-token"
echo ""
echo "Next steps:"
echo "  1. Open Vault UI: http://localhost:8200"
echo "  2. Read docs: docs/secrets-management.md"
echo "  3. Start using secrets in your services!"
echo ""
echo "Environment variables to set:"
echo "  export VAULT_ADDR=http://localhost:8200"
echo "  export VAULT_TOKEN=dev-root-token"
echo ""
