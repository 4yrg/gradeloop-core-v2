#!/bin/bash

# =============================================================================
# GradeLoop Core v2 - Deployment Script
# Supports: Docker, Podman
# =============================================================================

set -e

# Default runtime to docker if not specified
RUNTIME=${CONTAINER_RUNTIME:-docker}
COMPOSE_FILE="infra/compose/compose.prod.yaml"

echo "--- Starting Deployment ---"
echo "Target Runtime: $RUNTIME"

# 1. Verify runtime availability
if ! command -v "$RUNTIME" &> /dev/null; then
    echo "Error: $RUNTIME is not installed or not in PATH."
    exit 1
fi

# 2. Determine compose command
# Podman can use 'podman compose' (newer) or 'podman-compose' (external tool)
if [ "$RUNTIME" == "podman" ]; then
    if podman compose version &> /dev/null; then
        COMPOSE_CMD="podman compose"
    elif command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
    else
        echo "Error: Neither 'podman compose' nor 'podman-compose' found."
        exit 1
    fi
else
    COMPOSE_CMD="docker compose"
fi

echo "Using Compose Command: $COMPOSE_CMD"

# 3. Update codebase
echo "Updating codebase..."
git fetch origin main
git reset --hard origin/main
git clean -fd

# 4. Pull/Build images
echo "Building and pulling images..."
$COMPOSE_CMD -f "$COMPOSE_FILE" build --pull

# 5. Restart services
echo "Restarting services..."
# Using 'up -d' with '--remove-orphans' for idempotency
# Podman's 'up' behavior is slightly different but compatible with these flags
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d --remove-orphans

# 6. Post-deployment cleanup
echo "Cleaning up unused resources..."
if [ "$RUNTIME" == "podman" ]; then
    # Podman cleanup
    podman image prune -f
else
    # Docker cleanup
    docker image prune -f
fi

echo "--- Deployment Successful ---"
