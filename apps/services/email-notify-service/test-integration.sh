#!/bin/bash

# Email Service Integration Test Script
# This script tests the email service functionality

set -e

# Configuration
EMAIL_SERVICE_URL="http://localhost:8083"
TEST_EMAIL="test@gradeloop.com"

# Colors for output
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

# Test health check
test_health() {
    log_info "Testing health check endpoint..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$EMAIL_SERVICE_URL/health")
    
    if [ "$response" = "200" ]; then
        log_success "Health check passed"
        return 0
    else
        log_error "Health check failed (HTTP $response)"
        return 1
    fi
}

# Test email sending
test_email_send() {
    local template_name="$1"
    local subject="$2"
    local template_data="$3"
    
    log_info "Testing email send with template: $template_name"
    
    payload=$(cat <<EOF
{
  "to": ["$TEST_EMAIL"],
  "subject": "$subject",
  "template_name": "$template_name",
  "template_data": $template_data
}
EOF
)
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$EMAIL_SERVICE_URL/api/v1/email/send")
    
    if echo "$response" | grep -q "Email sent successfully"; then
        log_success "Email sent successfully with template: $template_name"
        return 0
    else
        log_error "Failed to send email with template: $template_name"
        log_error "Response: $response"
        return 1
    fi
}

# Test template functionality
test_template() {
    local template_name="$1"
    local template_data="$2"
    
    log_info "Testing template: $template_name"
    
    payload=$(cat <<EOF
{
  "template_name": "$template_name",
  "test_email": "$TEST_EMAIL",
  "template_data": $template_data
}
EOF
)
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$EMAIL_SERVICE_URL/api/v1/email/test-template")
    
    if echo "$response" | grep -q "Test email sent successfully"; then
        log_success "Template test passed: $template_name"
        return 0
    else
        log_error "Template test failed: $template_name"
        log_error "Response: $response"
        return 1
    fi
}

# Main test execution
main() {
    log_info "Starting Email Service Integration Tests"
    log_info "Service URL: $EMAIL_SERVICE_URL"
    log_info "Test Email: $TEST_EMAIL"
    echo ""
    
    # Test 1: Health Check
    if ! test_health; then
        log_error "Health check failed. Is the service running?"
        exit 1
    fi
    echo ""
    
    # Test 2: Account Activation Email
    activation_data='{
        "Name": "John Doe",
        "ActivationLink": "https://gradeloop.com/activate?token=test123"
    }'
    
    test_email_send "account_activation.html" "Activate Your GradeLoop Account" "$activation_data"
    echo ""
    
    # Test 3: Password Reset Email
    reset_data='{
        "Name": "Jane Smith",
        "ResetLink": "https://gradeloop.com/reset-password?token=reset456"
    }'
    
    test_email_send "password_reset.html" "Reset Your GradeLoop Password" "$reset_data"
    echo ""
    
    # Test 4: Welcome Email
    welcome_data='{
        "Name": "New Student",
        "DashboardLink": "https://gradeloop.com/dashboard",
        "GettingStartedLink": "https://gradeloop.com/getting-started"
    }'
    
    test_email_send "welcome.html" "Welcome to GradeLoop!" "$welcome_data"
    echo ""
    
    # Test 5: Template Tests
    test_template "account_activation.html" "$activation_data"
    test_template "password_reset.html" "$reset_data"
    test_template "welcome.html" "$welcome_data"
    echo ""
    
    log_success "All integration tests passed!"
}

# Check if service is running
check_service() {
    if ! curl -s "$EMAIL_SERVICE_URL/health" > /dev/null 2>&1; then
        log_error "Email service is not running at $EMAIL_SERVICE_URL"
        log_info "Please start the service first:"
        log_info "  docker-compose -f infra/compose/compose.dev.yaml up -d"
        exit 1
    fi
}

# Script execution
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  EMAIL_SERVICE_URL    Service URL (default: http://localhost:8081)"
    echo "  TEST_EMAIL          Test email address (default: test@gradeloop.com)"
    exit 0
fi

log_info "Checking if email service is running..."
check_service

main