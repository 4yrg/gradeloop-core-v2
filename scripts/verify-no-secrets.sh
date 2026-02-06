#!/bin/bash
# Verify that Docker images contain no hardcoded secrets
# Usage: ./scripts/verify-no-secrets.sh <image-name>

set -e

IMAGE="${1:-}"

if [ -z "$IMAGE" ]; then
    echo "Usage: $0 <image-name>"
    echo "Example: $0 gradeloop/assignment-service:latest"
    exit 1
fi

echo "Scanning Docker image: $IMAGE"
echo "========================================"

# Check docker history for common secret patterns
echo ""
echo "[1/3] Checking docker history for secrets..."
HISTORY_CHECK=$(docker history "$IMAGE" --no-trunc 2>/dev/null | \
    grep -iE "password|secret|token|api_key|jwt|credential" || true)

if [ -n "$HISTORY_CHECK" ]; then
    echo "❌ POTENTIAL SECRETS FOUND in docker history:"
    echo "$HISTORY_CHECK"
    echo ""
    echo "Please review the above output manually."
    EXIT_CODE=1
else
    echo "✅ No obvious secrets found in docker history"
    EXIT_CODE=0
fi

# Check for .env files in image
echo ""
echo "[2/3] Checking for .env files..."
ENV_FILES=$(docker run --rm "$IMAGE" find / -name "*.env" 2>/dev/null || true)

if [ -n "$ENV_FILES" ]; then
    echo "⚠️  Found .env files in image:"
    echo "$ENV_FILES"
    echo "Please ensure these don't contain secrets."
else
    echo "✅ No .env files found in image"
fi

# Check for common secret file patterns
echo ""
echo "[3/3] Checking for common secret files..."
SECRET_FILES=$(docker run --rm "$IMAGE" find / -type f \( \
    -name "*.pem" -o \
    -name "*.key" -o \
    -name "*.crt" -o \
    -name "credentials.json" -o \
    -name "secrets.json" \
\) 2>/dev/null || true)

if [ -n "$SECRET_FILES" ]; then
    echo "⚠️  Found potential secret files:"
    echo "$SECRET_FILES"
    echo "Please verify these are not actual secrets."
else
    echo "✅ No common secret file patterns found"
fi

echo ""
echo "========================================"
echo "Scan complete!"

exit $EXIT_CODE
