#!/bin/bash

# GradeLoop Admin Setup Script
# Initializes the system with admin credentials and seeds Vault with required secrets
# Usage: ./setup-admin.sh [--force]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
ADMIN_EMAIL="admin@gradeloop.com"
ADMIN_PASSWORD="Admin@123"
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-dev-root-token}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}[GRADELOOP]${NC} $1"
}

# Function to print usage
print_usage() {
    cat << EOF
GradeLoop Admin Setup Script

This script initializes the GradeLoop system with admin credentials and sets up
all required secrets in Vault for local development.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --force                Force setup even if admin already exists
    --skip-vault          Skip Vault initialization (use existing secrets)
    --skip-iam           Skip IAM service seeding
    --help               Show this help message

ADMIN CREDENTIALS:
    Email:    $ADMIN_EMAIL
    Password: $ADMIN_PASSWORD

PREREQUISITES:
    - Docker and Docker Compose installed
    - Vault running and accessible at $VAULT_ADDR
    - PostgreSQL running and accessible
    - IAM service built and ready

WHAT THIS SCRIPT DOES:
    1. Checks if required services are running
    2. Initializes Vault with admin credentials and JWT secrets
    3. Seeds IAM service database with admin user
    4. Verifies admin login functionality
    5. Displays connection information

EXAMPLES:
    # Standard setup
    $0

    # Force recreate admin user
    $0 --force

    # Skip Vault initialization (use existing secrets)
    $0 --skip-vault

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi

    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "$ROOT_DIR/infra/compose/compose.dev.yaml" ]]; then
        print_error "Cannot find compose.dev.yaml. Make sure you're running this script from the root directory."
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name="$1"
    local health_check="$2"
    local max_attempts=30
    local attempt=0

    print_info "Waiting for $service_name to be ready..."

    while [ $attempt -lt $max_attempts ]; do
        if eval "$health_check" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        print_info "Attempt $attempt/$max_attempts - $service_name not ready yet, waiting..."
        sleep 2
    done

    print_error "$service_name did not become ready in time"
    return 1
}

# Function to check if services are running
check_services() {
    print_info "Checking required services..."

    # Check Vault
    wait_for_service "Vault" "curl -f $VAULT_ADDR/v1/sys/health"

    # Check PostgreSQL
    wait_for_service "PostgreSQL" "docker exec gradeloop-postgres-dev pg_isready -U postgres"

    # Check Redis
    wait_for_service "Redis" "docker exec gradeloop-redis-dev redis-cli ping"

    print_success "All required services are running"
}

# Function to initialize Vault with admin secrets
initialize_vault() {
    if [[ "$SKIP_VAULT" == "true" ]]; then
        print_info "Skipping Vault initialization (--skip-vault specified)"
        return 0
    fi

    print_info "Initializing Vault with admin credentials..."

    # Set Vault environment variables
    export VAULT_ADDR
    export VAULT_TOKEN

    # Run vault initialization script
    if [[ -f "$SCRIPT_DIR/vault-init.sh" ]]; then
        print_info "Running Vault initialization script..."
        bash "$SCRIPT_DIR/vault-init.sh" --ci
        print_success "Vault initialized successfully"
    else
        print_warning "Vault initialization script not found, seeding minimal secrets..."

        # Seed minimal required secrets
        vault kv put secret/gradeloop/iam \
            initial_admin_email="$ADMIN_EMAIL" \
            initial_admin_password="$ADMIN_PASSWORD"

        vault kv put secret/gradeloop/auth \
            jwt_access_secret="gradeloop_access_secret_32_chars_!!" \
            jwt_refresh_secret="gradeloop_refresh_secret_32_chars!" \
            csrf_secret="gradeloop_csrf_secret_32_chars_!!!"

        print_success "Minimal secrets seeded to Vault"
    fi
}

# Function to seed IAM service database
seed_iam_database() {
    if [[ "$SKIP_IAM" == "true" ]]; then
        print_info "Skipping IAM service seeding (--skip-iam specified)"
        return 0
    fi

    print_info "Seeding IAM service database with admin user..."

    # Check if IAM service is running
    if ! docker ps | grep -q "gradeloop-iam-service-dev"; then
        print_warning "IAM service container not running, starting it..."
        cd "$ROOT_DIR"
        docker-compose -f infra/compose/compose.dev.yaml up -d iam-service

        # Wait for IAM service to be ready
        wait_for_service "IAM Service" "curl -f http://localhost:3000/api/iam/health"
    fi

    # Set environment variables for seeding
    export SEED_ADMIN_EMAIL="$ADMIN_EMAIL"
    export SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    export SEED_ADMIN_NAME="Super Admin"
    export SEED_FORCE="$FORCE_SETUP"
    export VAULT_ADDR
    export VAULT_TOKEN

    # Run the new seeding script
    print_info "Running super admin seeding script..."
        
    # Get database URL from environment or Vault
    local db_url=""
        
    # Try to get from environment first
    if [[ -n "${DATABASE_URL:-}" ]]; then
        db_url="$DATABASE_URL"
    else
        # Try to get from Vault
        if command -v vault >/dev/null 2>&1; then
            db_url=$(vault kv get -field=database_url secret/services/iam 2>/dev/null || echo "")
        fi
            
        # Fallback: do NOT hardcode credentials in the repo. Require explicit DATABASE_URL.
        if [[ -z "$db_url" ]]; then
            print_warning "No DATABASE_URL found in environment or Vault."
            print_warning "Set the DATABASE_URL environment variable with your DB connection string before running this script."
            db_url=""
        fi
    fi
        
    # Export database URL for the seeding script
    export DATABASE_URL="$db_url"
        
    # Run the seeding script from project root
    cd "$ROOT_DIR"
    if [[ -f "scripts/seed-super-admin.sh" ]]; then
        ./scripts/seed-super-admin.sh \
            --email "$ADMIN_EMAIL" \
            --password "$ADMIN_PASSWORD" \
            --name "$ADMIN_NAME" \
            $( [[ "$FORCE_SETUP" == "true" ]] && echo "--force" )
        print_success "Super admin seeded successfully"
    else
        print_error "Seeding script not found!"
        return 1
    fi
}

# Function to verify admin login
verify_admin_login() {
    print_info "Verifying admin login functionality..."

    # Try to login with admin credentials
    local login_response
    if login_response=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"); then

        if echo "$login_response" | grep -q "access_token"; then
            print_success "Admin login verification successful!"
            return 0
        else
            print_warning "Login attempt made but no access token received"
            print_info "Response: $login_response"
            return 1
        fi
    else
        print_warning "Could not verify admin login - IAM service may not be fully ready"
        return 1
    fi
}

# Function to display connection information
display_connection_info() {
    print_header "========================================"
    print_header "GradeLoop Admin Setup Complete!"
    print_header "========================================"
    echo ""
    print_success "Admin credentials have been set up successfully."
    echo ""
    print_info "ADMIN CREDENTIALS:"
    print_info "  Email:    $ADMIN_EMAIL"
    print_info "  Password: $ADMIN_PASSWORD"
    echo ""
    print_info "SERVICE ENDPOINTS:"
    print_info "  Vault UI:        http://localhost:8200"
    print_info "  Vault Token:     $VAULT_TOKEN"
    print_info "  IAM Service:     http://localhost:3000"
    print_info "  PostgreSQL:      localhost:5432 (postgres/postgres)"
    print_info "  Redis:           localhost:6379"
    print_info "  Traefik UI:      http://localhost:8080"
    echo ""
    print_info "WEB APPLICATION:"
    print_info "  Frontend URL:    http://localhost:3001 (when running)"
    print_info "  Login Page:      http://localhost:3001/login"
    echo ""
    print_info "DEVELOPMENT COMMANDS:"
    print_info "  Start all services:  docker-compose -f infra/compose/compose.dev.yaml up -d"
    print_info "  View logs:          docker-compose -f infra/compose/compose.dev.yaml logs -f"
    print_info "  Stop services:      docker-compose -f infra/compose/compose.dev.yaml down"
    echo ""
    print_warning "SECURITY NOTICE:"
    print_warning "These are development credentials. Change them in production!"
    print_warning "Never use dev-root-token in production environments."
    echo ""
}

# Function to run health checks
run_health_checks() {
    print_info "Running final health checks..."

    local all_healthy=true

    # Check Vault
    if vault status > /dev/null 2>&1; then
        print_success "✓ Vault is healthy"
    else
        print_error "✗ Vault is not healthy"
        all_healthy=false
    fi

    # Check PostgreSQL
    if docker exec gradeloop-postgres-dev pg_isready -U postgres > /dev/null 2>&1; then
        print_success "✓ PostgreSQL is healthy"
    else
        print_error "✗ PostgreSQL is not healthy"
        all_healthy=false
    fi

    # Check Redis
    if docker exec gradeloop-redis-dev redis-cli ping > /dev/null 2>&1; then
        print_success "✓ Redis is healthy"
    else
        print_error "✗ Redis is not healthy"
        all_healthy=false
    fi

    # Check IAM Service
    if curl -f http://localhost:3000/api/iam/health > /dev/null 2>&1; then
        print_success "✓ IAM Service is healthy"
    else
        print_warning "⚠ IAM Service health check failed (may still be starting)"
    fi

    if [[ "$all_healthy" == "true" ]]; then
        print_success "All critical services are healthy!"
    else
        print_warning "Some services are not healthy. Check the logs for details."
    fi
}

# Parse command line arguments
FORCE_SETUP="false"
SKIP_VAULT="false"
SKIP_IAM="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_SETUP="true"
            shift
            ;;
        --skip-vault)
            SKIP_VAULT="true"
            shift
            ;;
        --skip-iam)
            SKIP_IAM="true"
            shift
            ;;
        --help)
            print_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header "GradeLoop Admin Setup Script"
    print_header "Setting up admin credentials: $ADMIN_EMAIL"
    echo ""

    # Run setup steps
    check_prerequisites
    check_services
    initialize_vault
    seed_iam_database

    # Give services a moment to fully initialize
    print_info "Waiting for services to fully initialize..."
    sleep 3

    # Verify setup
    if verify_admin_login; then
        run_health_checks
        display_connection_info
        print_success "Setup completed successfully! 🎉"
        exit 0
    else
        print_warning "Setup completed but admin login verification failed."
        print_info "This might be normal if services are still starting up."
        print_info "Try logging in manually after a few minutes."
        display_connection_info
        exit 0
    fi
}

# Handle script interruption
trap 'print_error "Setup interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"
