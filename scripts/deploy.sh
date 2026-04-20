#!/bin/bash

# =============================================================================
# GradeLoop Core v2 - Deployment Script
# =============================================================================
# This script handles the automated deployment of the application.
# It is designed to be runtime-agnostic (Docker or Podman).

set -e

# Configuration
RUNTIME=${CONTAINER_RUNTIME:-docker}
COMPOSE_FILE="infra/compose/compose.prod.yaml"

echo "--- Starting Deployment ---"
echo "Target Runtime: $RUNTIME"

# Detect compose command
if command -v $RUNTIME-compose &> /dev/null; then
    COMPOSE_CMD="$RUNTIME-compose"
elif $RUNTIME compose version &> /dev/null; then
    COMPOSE_CMD="$RUNTIME compose"
else
    echo "ERROR: Neither '$RUNTIME-compose' nor '$RUNTIME compose' found."
    exit 1
fi

echo "Using Compose Command: $COMPOSE_CMD"

# Install Bun if missing (required to sync lockfile)
if ! command -v bun &> /dev/null; then
    echo "Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Ensure Bun is in PATH for this session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Updating codebase
echo "Updating codebase..."
git fetch origin main
git reset --hard origin/main

# Sync lockfile to prevent "frozen lockfile" errors during Docker build
echo "Syncing Bun lockfile..."
bun install

# Build and Pull Images
echo "Building and pulling images..."
$COMPOSE_CMD -f $COMPOSE_FILE build --pull

# Deploy
echo "Starting services..."
$COMPOSE_CMD -f $COMPOSE_FILE up -d --remove-orphans

# Cleanup
echo "Cleaning up unused images..."
$RUNTIME image prune -f

echo "--- Deployment Successful ---"
