#!/bin/bash

# GradeLoop IAM Service Database Migration and Seeding Script
# This script migrates tables to iam_db and seeds the admin user

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$SERVICE_DIR/migrations"

# Default values
DEFAULT_ADMIN_EMAIL="admin@gradeloop.com"
DEFAULT_ADMIN_NAME="Super Admin"
DEFAULT_ADMIN_PASSWORD="Admin@123"

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

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if go is installed
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed or not in PATH"
        exit 1
    fi
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        print_error "psql is not installed or not in PATH"
        exit 1
    fi
    
    # Check if .env file exists
    if [[ ! -f "$SCRIPT_DIR/../../.env" ]]; then
        print_error "Environment file not found at $SCRIPT_DIR/../../.env"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to load environment variables
load_env() {
    print_info "Loading environment variables..."
    
    # Load .env file
    if [[ -f "$SCRIPT_DIR/../../.env" ]]; then
        export $(grep -v '^#' "$SCRIPT_DIR/../../.env" | xargs)
    fi
    
    # Check required environment variables
    if [[ -z "${POSTGRES_URL_BASE:-}" ]]; then
        print_error "POSTGRES_URL_BASE is not set in environment"
        exit 1
    fi
    
    if [[ -z "${POSTGRES_SSLMODE:-}" ]]; then
        print_error "POSTGRES_SSLMODE is not set in environment"
        exit 1
    fi
    
    # Set database URL for iam_db
    export DATABASE_URL="${POSTGRES_URL_BASE}iam_db?sslmode=${POSTGRES_SSLMODE}"
    
    print_success "Environment variables loaded"
    print_info "Using database: iam_db"
}

# Function to validate password
validate_password() {
    local password="$1"
    if [[ ${#password} -lt 8 ]]; then
        print_error "Password must be at least 8 characters long"
        return 1
    fi
    return 0
}

# Function to prompt for password
prompt_password() {
    local password
    while true; do
        echo -n "Enter admin password (min 8 characters): "
        read -s password
        echo
        if validate_password "$password"; then
            echo -n "Confirm password: "
            read -s confirm_password
            echo
            if [[ "$password" == "$confirm_password" ]]; then
                echo "$password"
                return 0
            else
                print_error "Passwords do not match"
            fi
        fi
    done
}

# Function to run migrations
run_migrations() {
    print_info "Running database migrations..."
    
    # Check if migrations directory exists
    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        print_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # Run migrations in order
    local migrations=(
        "000001_create_initial_tables.up.sql"
        "000002_permissions.up.sql"
        "000003_create_refresh_tokens_table.up.sql"
    )
    
    for migration in "${migrations[@]}"; do
        local migration_file="$MIGRATIONS_DIR/$migration"
        if [[ -f "$migration_file" ]]; then
            print_info "Running migration: $migration"
            psql "$DATABASE_URL" -f "$migration_file" || {
                print_error "Failed to run migration: $migration"
                exit 1
            }
        else
            print_warning "Migration file not found: $migration_file"
        fi
    done
    
    print_success "Database migrations completed"
}

# Function to seed database
seed_database() {
    print_info "Seeding database with initial data..."
    
    # Set environment variables for seeding
    export SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-$DEFAULT_ADMIN_EMAIL}"
    export SEED_ADMIN_NAME="${SEED_ADMIN_NAME:-$DEFAULT_ADMIN_NAME}"
    export SEED_FORCE="${SEED_FORCE:-false}"
    
    # Handle password
    if [[ -n "${SEED_ADMIN_PASSWORD:-}" ]]; then
        if ! validate_password "$SEED_ADMIN_PASSWORD"; then
            exit 1
        fi
    elif [[ -n "${password:-}" ]]; then
        if ! validate_password "$password"; then
            exit 1
        fi
        export SEED_ADMIN_PASSWORD="$password"
    else
        # Prompt for password
        if password=$(prompt_password); then
            export SEED_ADMIN_PASSWORD="$password"
        else
            print_error "Invalid password provided"
            exit 1
        fi
    fi
    
    # Run the Go seed script
    print_info "Running Go seed script..."
    cd "$SERVICE_DIR"
    go run scripts/seed_admin.go || {
        print_error "Failed to run seed script"
        exit 1
    }
    
    print_success "Database seeding completed"
}

# Function to print usage
print_usage() {
    cat << EOF
GradeLoop IAM Service Database Migration and Seeding Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -e, --email <EMAIL>         Admin email address (default: $DEFAULT_ADMIN_EMAIL)
    -p, --password <PASSWORD>   Admin password (min 8 characters)
    -n, --name <NAME>           Admin full name (default: $DEFAULT_ADMIN_NAME)
    -f, --force                 Force recreate admin user even if users exist
    -h, --help                  Show this help message

DESCRIPTION:
    This script migrates IAM service tables to the iam_db database in Aiven
    and seeds the initial admin user.

EXAMPLES:
    # Use default credentials
    $0
    
    # Specify custom admin credentials
    $0 -e admin@example.com -p "MySecurePass123" -n "System Admin"
    
    # Force recreation of admin user
    $0 -f

ENVIRONMENT VARIABLES:
    The script reads configuration from ../../.env file:
    - POSTGRES_URL_BASE: Base PostgreSQL connection URL
    - POSTGRES_SSLMODE: SSL mode for database connection

DEFAULT CREDENTIALS:
    Email: admin@gradeloop.com
    Password: Admin@123
EOF
}

# Parse command line arguments
email="$DEFAULT_ADMIN_EMAIL"
password=""
name="$DEFAULT_ADMIN_NAME"
force=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--email)
            email="$2"
            shift 2
            ;;
        -p|--password)
            password="$2"
            shift 2
            ;;
        -n|--name)
            name="$2"
            shift 2
            ;;
        -f|--force)
            force=true
            shift
            ;;
        -h|--help)
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
    print_info "GradeLoop IAM Service Database Migration and Seeding"
    print_info "=================================================="
    
    check_prerequisites
    load_env
    
    # Show configuration
    print_info "Configuration:"
    print_info "  Database URL: $DATABASE_URL"
    print_info "  Admin Email: $email"
    print_info "  Admin Name: $name"
    print_info "  Force Mode: $force"
    
    # Ask for confirmation unless force mode
    if [[ "$force" != "true" ]]; then
        echo
        print_warning "This will migrate tables to iam_db and seed the admin user."
        echo -n "Proceed? [y/N]: "
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            print_info "Operation cancelled"
            exit 0
        fi
    fi
    
    echo
    
    # Run migrations
    run_migrations
    
    echo
    
    # Seed database
    seed_database
    
    echo
    print_success "Migration and seeding completed successfully!"
    print_info "Default admin credentials:"
    print_info "  Email: admin@gradeloop.com"
    print_info "  Password: Admin@123"
}

# Run main function
main "$@"