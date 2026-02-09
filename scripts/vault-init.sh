#!/bin/sh
# Vault Initialization Script for GradeLoop V2
# Seeds initial secrets into Vault for local development
# Usage: ./vault-init.sh [--interactive|--ci|--from-file <path>]

set -e

# Configuration
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-dev-root-token}"
VAULT_NAMESPACE="${VAULT_NAMESPACE:-}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    printf "${BLUE}[INFO]${NC} %s\n" "$1"
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"
}

log_warn() {
    printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1"
}

# Wait for Vault to be ready
wait_for_vault() {
    log_info "Waiting for Vault to be ready..."
    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if vault status > /dev/null 2>&1; then
            log_success "Vault is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        log_info "Attempt $attempt/$max_attempts - Vault not ready yet, waiting..."
        sleep 2
    done

    log_error "Vault did not become ready in time"
    return 1
}

# Enable KV v2 secrets engine
enable_kv_engine() {
    local mount_path=$1
    log_info "Enabling KV v2 secrets engine at: $mount_path"

    if vault secrets list | grep -q "^${mount_path}/"; then
        log_warn "Secrets engine already enabled at $mount_path"
    else
        vault secrets enable -path="$mount_path" -version=2 kv
        log_success "KV v2 secrets engine enabled at $mount_path"
    fi
}

# Enable audit logging
enable_audit_logging() {
    log_info "Enabling audit logging..."

    if vault audit list | grep -q "file/"; then
        log_warn "Audit logging already enabled"
    else
        vault audit enable file file_path=/vault/logs/audit.log
        log_success "Audit logging enabled to /vault/logs/audit.log"
    fi
}

# Write a secret to Vault
write_secret() {
    local path=$1
    shift
    local args=""
    while [ "$#" -gt 0 ]; do
        # Build the command arguments key=value
        args="$args $1=$2"
        shift 2
    done
    log_info "Writing secret to $path..."
    # shellcheck disable=SC2086
    if ! vault kv put "$path" $args > /dev/null; then
        log_error "Failed to write secret to $path"
        return 1
    fi
}

# Seed database secrets
seed_database_secrets() {
    log_info "Seeding database secrets..."

    local db_mount="secret/database"

    # PostgreSQL secrets (Aligned with compose.dev.yaml)
    write_secret "$db_mount/postgres" \
        username "postgres" \
        password "postgres" \
        host "postgres" \
        port "5432" \
        database "gradeloop" \
        sslmode "disable"

    log_success "Database secrets seeded"

    # Seed GradeLoop Core Secrets (US02 Requirements)
    log_info "Seeding GradeLoop Core secrets..."

    # secret/gradeloop/postgres -> password
    write_secret "secret/gradeloop/postgres" \
        password "postgres"

    # secret/gradeloop/iam -> initial_admin_password
    write_secret "secret/gradeloop/iam" \
        initial_admin_password "admin_dev_password_123"

    # secret/gradeloop/vault -> token (Local dev access)
    write_secret "secret/gradeloop/vault" \
        token "$VAULT_TOKEN"

    log_success "GradeLoop Core secrets seeded"
}

# Seed Redis secrets
seed_redis_secrets() {
    log_info "Seeding Redis secrets..."

    local redis_mount="secret/cache"

    write_secret "$redis_mount/redis" \
        host "redis" \
        port "6379" \
        password "gradeloop_redis_dev" \
        db "0"

    log_success "Redis secrets seeded"
}

# Seed JWT secrets
seed_jwt_secrets() {
    log_info "Seeding JWT secrets..."

    local jwt_mount="secret/auth"

    # Generate a random JWT secret if not provided
    JWT_SECRET="${JWT_SECRET:-$(head -c 32 /dev/urandom | base64)}"

    write_secret "$jwt_mount/jwt" \
        secret "$JWT_SECRET" \
        algorithm "HS256" \
        expiry "24h" \
        refresh_expiry "168h"

    log_success "JWT secrets seeded"
}

# Seed email secrets
seed_email_secrets() {
    log_info "Seeding email secrets..."

    local email_mount="secret/email"

    write_secret "$email_mount/smtp" \
        host "mailhog" \
        port "1025" \
        username "" \
        password "" \
        from "noreply@gradeloop.local" \
        tls "false"

    log_success "Email secrets seeded"
}

# Seed external API keys (templates - replace with real values)
seed_api_keys() {
    log_info "Seeding API key templates..."

    local api_mount="secret/api-keys"

    # Placeholder API keys - should be replaced with real values in production
    write_secret "$api_mount/openai" \
        api_key "sk-placeholder-openai-key-replace-in-production"

    write_secret "$api_mount/sendgrid" \
        api_key "SG.placeholder-sendgrid-key-replace-in-production"

    write_secret "$api_mount/stripe" \
        api_key "sk_test_placeholder-stripe-key" \
        publishable_key "pk_test_placeholder-stripe-key"

    log_warn "API keys are placeholder values - update them with real keys"
    log_success "API key templates seeded"
}

# Seed service-specific secrets
seed_service_secrets() {
    log_info "Seeding service-specific secrets..."

    # Academics Service
    write_secret "secret/services/academics" \
        service_name "academics-service" \
        log_level "debug" \
        port "8081"

    # Assignment Service
    write_secret "secret/services/assignment" \
        service_name "assignment-service" \
        log_level "debug" \
        port "8082"

    # Email Service
    write_secret "secret/services/email-notify" \
        service_name "email-notify-service" \
        log_level "debug" \
        port "8083"

    # CIPAS Service (Plagiarism Detection)
    write_secret "secret/services/cipas" \
        service_name "cipas-service" \
        log_level "debug" \
        port "8085" \
        threshold "0.85"

    # IVAS Service (AI Grading)
    write_secret "secret/services/ivas" \
        service_name "ivas-service" \
        log_level "debug" \
        port "8086"

    # IAM Service
    write_secret "secret/services/iam" \
        service_name "iam-service" \
        log_level "debug" \
        port "3000" \
        database_url "host=postgres user=postgres password=postgres dbname=gradeloop port=5432 sslmode=disable"

    log_success "Service secrets seeded"
}

# Enable GitHub Actions OIDC authentication
enable_github_oidc() {
    log_info "Configuring GitHub Actions OIDC authentication..."

    # Enable JWT auth method
    if vault auth list | grep -q "jwt/"; then
        log_warn "JWT auth method already enabled"
    else
        vault auth enable jwt
        log_success "JWT auth method enabled"
    fi

    # Configure OIDC for GitHub Actions
    vault write auth/jwt/config \
        bound_issuer="https://token.actions.githubusercontent.com" \
        oidc_discovery_url="https://token.actions.githubusercontent.com"

    # Create a policy for GitHub Actions
    vault policy write github-actions - <<EOF
# Allow GitHub Actions to read secrets
path "secret/data/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/*" {
  capabilities = ["list"]
}
EOF

    # Create a role for GitHub Actions
    vault write auth/jwt/role/github-actions \
        role_type="jwt" \
        bound_audiences="https://github.com/gradeloop" \
        user_claim="actor" \
        bound_subject="repo:gradeloop/gradeloop-core-v2:ref:refs/heads/main" \
        policies="github-actions" \
        ttl="1h"

    log_success "GitHub Actions OIDC configured"
}

# Create policies for services
create_service_policies() {
    log_info "Creating service-specific policies..."

    # Academics Service Policy
    vault policy write academics-service - <<EOF
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
EOF

    # Assignment Service Policy
    vault policy write assignment-service - <<EOF
path "secret/data/database/*" {
  capabilities = ["read"]
}
path "secret/data/cache/*" {
  capabilities = ["read"]
}
path "secret/data/auth/*" {
  capabilities = ["read"]
}
path "secret/data/services/assignment" {
  capabilities = ["read"]
}
EOF

    # Email Service Policy
    vault policy write email-service - <<EOF
path "secret/data/email/*" {
  capabilities = ["read"]
}
path "secret/data/services/email-notify" {
  capabilities = ["read"]
}
EOF

    # CIPAS Service Policy
    vault policy write cipas-service - <<EOF
path "secret/data/database/*" {
  capabilities = ["read"]
}
path "secret/data/api-keys/openai" {
  capabilities = ["read"]
}
path "secret/data/services/cipas" {
  capabilities = ["read"]
}
EOF

    # IVAS Service Policy
    vault policy write ivas-service - <<EOF
path "secret/data/database/*" {
  capabilities = ["read"]
}
path "secret/data/api-keys/openai" {
  capabilities = ["read"]
}
path "secret/data/services/ivas" {
  capabilities = ["read"]
}
EOF

    # IAM Service Policy
    vault policy write iam-service - <<EOF
path "secret/data/database/*" {
  capabilities = ["read"]
}
path "secret/data/services/iam" {
  capabilities = ["read"]
}
EOF

    log_success "Service policies created"
}

# Enable AppRole authentication for services
enable_approle_auth() {
    log_info "Configuring AppRole authentication for services..."

    if vault auth list | grep -q "approle/"; then
        log_warn "AppRole auth method already enabled"
    else
        vault auth enable approle
        log_success "AppRole auth method enabled"
    fi

    # Create AppRoles for each service
    services="academics-service assignment-service email-service cipas-service ivas-service iam-service"

    for service in $services; do
        vault write auth/approle/role/$service \
            token_policies="$service" \
            token_ttl=1h \
            token_max_ttl=4h \
            bind_secret_id=true

        # Get role-id and secret-id
        role_id=$(vault read -field=role_id auth/approle/role/$service/role-id)
        secret_id=$(vault write -field=secret_id -f auth/approle/role/$service/secret-id)

        log_success "AppRole created for $service (role_id: ${role_id:0:20}...)"
    done
}

# Interactive mode - prompt for secrets
interactive_mode() {
    log_info "Running in interactive mode..."
    log_warn "This mode is for initial setup. Enter secrets when prompted."
    echo ""

    # Database password
    printf "Enter PostgreSQL password (default: postgres): "
    read -r db_pass
    db_pass="${db_pass:-postgres}"

    # Redis password
    printf "Enter Redis password (default: gradeloop_redis_dev): "
    read -r redis_pass
    redis_pass="${redis_pass:-gradeloop_redis_dev}"

    # JWT secret
    printf "Enter JWT secret (leave empty to auto-generate): "
    read -r jwt_secret
    if [ -z "$jwt_secret" ]; then
        jwt_secret=$(head -c 32 /dev/urandom | base64)
        log_info "Generated JWT secret: ${jwt_secret:0:20}..."
    fi

    export JWT_SECRET="$jwt_secret"

    # Continue with seeding
    seed_all_secrets
}

# Seed all secrets
seed_all_secrets() {
    enable_kv_engine "secret"
    enable_audit_logging
    seed_database_secrets
    seed_redis_secrets
    seed_jwt_secrets
    seed_email_secrets
    seed_api_keys
    seed_service_secrets
    create_service_policies
    enable_approle_auth
    enable_github_oidc
}

# Main execution
main() {
    log_info "GradeLoop V2 - Vault Initialization Script"
    log_info "Vault Address: $VAULT_ADDR"

    # Export Vault variables
    export VAULT_ADDR
    export VAULT_TOKEN

    # Wait for Vault
    if ! wait_for_vault; then
        log_error "Failed to connect to Vault"
        exit 1
    fi

    # Check for mode
    MODE="${1:-auto}"

    case "$MODE" in
        --interactive)
            interactive_mode
            ;;
        --ci)
            log_info "Running in CI mode..."
            seed_all_secrets
            ;;
        --from-file)
            if [ -z "$2" ]; then
                log_error "Please provide a secrets file path"
                exit 1
            fi
            log_info "Loading secrets from file: $2"
            # TODO: Implement file-based secret loading
            log_warn "File-based loading not yet implemented, using defaults"
            seed_all_secrets
            ;;
        *)
            log_info "Running in auto mode with default values..."
            seed_all_secrets
            ;;
    esac

    log_success "Vault initialization complete!"
    log_info "Vault UI: http://localhost:8200"
    log_info "Root Token: $VAULT_TOKEN"

    # Write root token to shared volume for sidecars
    log_info "Saving root token to /vault/secrets/root-token..."
    if ! echo "$VAULT_TOKEN" > /vault/secrets/root-token; then
        log_error "CRITICAL: Could not write root-token to /vault/secrets/root-token. Check volume permissions."
        exit 1
    fi
    log_success "Root token saved successfully."

    log_warn "Remember: This is a DEV configuration. Never use dev mode in production!"
}

# Run main function
main "$@"
