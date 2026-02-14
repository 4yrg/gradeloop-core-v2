#!/bin/bash

# GradeLoop Super Admin Seeding Script
# This script seeds the database with a super admin user and default roles/permissions

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Default configuration
DEFAULT_ADMIN_EMAIL="admin@gradeloop.com"
DEFAULT_ADMIN_PASSWORD="Admin@123456789"  # 15 characters to meet minimum requirement
DEFAULT_ADMIN_NAME="Super Administrator"

# Parse command line arguments
FORCE_OVERWRITE=false
HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE_OVERWRITE=true
            shift
            ;;
        --email|-e)
            ADMIN_EMAIL="$2"
            shift 2
            ;;
        --password|-p)
            ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --name|-n)
            ADMIN_NAME="$2"
            shift 2
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Show help if requested
if [[ "$HELP" == "true" ]]; then
    echo "GradeLoop Super Admin Seeding Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --force, -f              Force overwrite existing admin user"
    echo "  --email, -e EMAIL        Admin email (default: $DEFAULT_ADMIN_EMAIL)"
    echo "  --password, -p PASSWORD  Admin password (default: $DEFAULT_ADMIN_PASSWORD)"
    echo "  --name, -n NAME          Admin full name (default: $DEFAULT_ADMIN_NAME)"
    echo "  --help, -h               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL             PostgreSQL connection string (required)"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 --force"
    echo "  $0 --email admin@example.com --password SecurePass123!"
    exit 0
fi

# Set configuration (from env vars or defaults)
ADMIN_EMAIL="${ADMIN_EMAIL:-$DEFAULT_ADMIN_EMAIL}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$DEFAULT_ADMIN_PASSWORD}"
ADMIN_NAME="${ADMIN_NAME:-$DEFAULT_ADMIN_NAME}"

print_info "Starting GradeLoop Super Admin Seeding..."

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
    print_error "DATABASE_URL environment variable is required"
    print_info "Example: export DATABASE_URL='postgres://user:pass@localhost:5432/dbname'"
    exit 1
fi

print_info "Configuration:"
print_info "  Admin Email: $ADMIN_EMAIL"
print_info "  Admin Name: $ADMIN_NAME"
print_info "  Force Overwrite: $FORCE_OVERWRITE"
print_info "  Database URL: ${DATABASE_URL//\/*/****}"

# Get the absolute path of the script and determine project root
SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]:-$0}")"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_PATH")")"

# Navigate to IAM service directory where go.mod exists
IAM_SERVICE_DIR="$PROJECT_ROOT/apps/services/iam-service"
cd "$IAM_SERVICE_DIR"

if [[ ! -f "go.mod" ]]; then
    print_error "Could not find go.mod file in IAM service directory: $IAM_SERVICE_DIR"
    print_info "Current directory: $(pwd)"
    print_info "Script path: $SCRIPT_PATH"
    exit 1
fi

print_info "Working directory: $(pwd)"
print_info "Project root: $PROJECT_ROOT"
print_info "Script path: $SCRIPT_PATH"

# Run the seeding script
print_info "Running Go seeding script..."

# Navigate to IAM service directory to access internal packages
cd "$IAM_SERVICE_DIR"

# Use relative path to the Go script
GO_SCRIPT_PATH="./scripts/seed-super-admin.go"

SEED_FORCE="$FORCE_OVERWRITE" \
SEED_ADMIN_EMAIL="$ADMIN_EMAIL" \
SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
SEED_ADMIN_NAME="$ADMIN_NAME" \
DATABASE_URL="$DATABASE_URL" \
    go run "$GO_SCRIPT_PATH"

if [[ $? -eq 0 ]]; then
    print_success "Super admin seeding completed successfully!"
    
    print_info "Admin credentials:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Password: $ADMIN_PASSWORD"
    echo "  Full Name: $ADMIN_NAME"
    echo ""
    print_warning "IMPORTANT: Change these credentials in production!"
else
    print_error "Seeding failed!"
    exit 1
fi