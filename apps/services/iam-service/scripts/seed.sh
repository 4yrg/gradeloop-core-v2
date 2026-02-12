#!/bin/bash

# GradeLoop IAM Service Database Seeding Script
# This script provides a convenient way to seed the IAM database with initial data

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

# Default values
DEFAULT_ADMIN_EMAIL="admin@gradeloop.com"
DEFAULT_ADMIN_NAME="Super Admin"

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

# Function to print usage
print_usage() {
    cat << EOF
GradeLoop IAM Service Database Seeding Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -e, --email <EMAIL>         Admin email address (default: $DEFAULT_ADMIN_EMAIL)
    -p, --password <PASSWORD>   Admin password (required, min 12 characters)
    -n, --name <NAME>           Admin full name (default: $DEFAULT_ADMIN_NAME)
    -f, --force                 Force recreate admin user even if users exist
    -h, --help                  Show this help message

ENVIRONMENT VARIABLES:
    VAULT_ADDR                  Vault server address (required)
    VAULT_TOKEN                 Vault authentication token (required)
    SEED_ADMIN_EMAIL            Admin email (overrides -e flag)
    SEED_ADMIN_PASSWORD         Admin password (overrides -p flag)
    SEED_ADMIN_NAME             Admin name (overrides -n flag)
    SEED_FORCE                  Force mode (overrides -f flag)

EXAMPLES:
    # Seed with password prompt
    $0 --password MySecurePassword123

    # Seed with custom email and name
    $0 --email admin@mycompany.com --name "John Admin" --password MySecurePassword123

    # Force recreate admin user
    $0 --password MySecurePassword123 --force

    # Using environment variables
    SEED_ADMIN_PASSWORD=Admin@123 $0

    # Using default credentials (no password needed)
    $0

NOTES:
    - Password must be at least 8 characters long
    - Default admin credentials: admin@gradeloop.com / Admin@123
    - Vault must be running and accessible
    - Database connection details are retrieved from Vault
    - The script will create all necessary permissions and roles

EOF
}

# Function to validate password
validate_password() {
    local password="$1"

    if [[ ${#password} -lt 8 ]]; then
        print_error "Password must be at least 8 characters long"
        return 1
    fi

    # Check for at least one uppercase letter
    if ! [[ "$password" =~ [A-Z] ]]; then
        print_warning "Password should contain at least one uppercase letter"
    fi

    # Check for at least one lowercase letter
    if ! [[ "$password" =~ [a-z] ]]; then
        print_warning "Password should contain at least one lowercase letter"
    fi

    # Check for at least one number
    if ! [[ "$password" =~ [0-9] ]]; then
        print_warning "Password should contain at least one number"
    fi

    # Check for at least one special character
    if ! [[ "$password" =~ [!@#$%^&*()_+\-=\[\]{};\':\"\|,.<>\?] ]]; then
        print_warning "Password should contain at least one special character"
    fi

    return 0
}

# Function to prompt for password
prompt_password() {
    local password
    echo -n "Enter admin password: "
    read -s password
    echo

    if ! validate_password "$password"; then
        return 1
    fi

    echo -n "Confirm admin password: "
    local confirm_password
    read -s confirm_password
    echo

    if [[ "$password" != "$confirm_password" ]]; then
        print_error "Passwords do not match"
        return 1
    fi

    echo "$password"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed or not in PATH"
        exit 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "$SERVICE_DIR/go.mod" ]]; then
        print_error "Cannot find go.mod file. Make sure you're running this script from the IAM service directory"
        exit 1
    fi

    # Check Vault environment variables
    if [[ -z "${VAULT_ADDR:-}" ]]; then
        print_error "VAULT_ADDR environment variable is required"
        exit 1
    fi

    if [[ -z "${VAULT_TOKEN:-}" ]]; then
        print_error "VAULT_TOKEN environment variable is required"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Function to run the seeding
run_seed() {
    print_info "Starting database seeding..."

    cd "$SERVICE_DIR"

    # Run the Go seeding script
    if go run scripts/seed_admin.go; then
        print_success "Database seeding completed successfully!"
        print_info "Admin user has been created and is ready to use"

        if [[ -n "${SEED_ADMIN_EMAIL:-$email}" ]]; then
            print_info "Admin Email: ${SEED_ADMIN_EMAIL:-$email}"
        fi
    else
        print_error "Database seeding failed"
        exit 1
    fi
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
    print_info "GradeLoop IAM Service Database Seeding"
    print_info "======================================="

    check_prerequisites

    # Set environment variables from command line args or existing env vars
    export SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-$email}"
    export SEED_ADMIN_NAME="${SEED_ADMIN_NAME:-$name}"
    export SEED_FORCE="${SEED_FORCE:-$force}"

    # Handle password
    if [[ -n "${SEED_ADMIN_PASSWORD:-}" ]]; then
        # Use password from environment variable
        if ! validate_password "$SEED_ADMIN_PASSWORD"; then
            exit 1
        fi
    elif [[ -n "$password" ]]; then
        # Use password from command line
        if ! validate_password "$password"; then
            exit 1
        fi
        export SEED_ADMIN_PASSWORD="$password"
    else
        # Prompt for password
        print_info "Admin password not provided, prompting for input..."
        if password=$(prompt_password); then
            export SEED_ADMIN_PASSWORD="$password"
        else
            print_error "Invalid password provided"
            exit 1
        fi
    fi

    # Show configuration
    print_info "Seeding configuration:"
    print_info "  Email: $SEED_ADMIN_EMAIL"
    print_info "  Name: $SEED_ADMIN_NAME"
    print_info "  Force: $SEED_FORCE"

    # Show default credentials info
    print_info "Default admin credentials:"
    print_info "  Email: admin@gradeloop.com"
    print_info "  Password: Admin@123"
    print_info ""

    # Ask for confirmation unless force mode
    if [[ "$force" != "true" ]]; then
        echo -n "Proceed with seeding? [y/N]: "
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            print_info "Seeding cancelled"
            exit 0
        fi
    fi

    run_seed
}

# Run main function
main "$@"
