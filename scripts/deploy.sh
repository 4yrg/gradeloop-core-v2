#!/usr/bin/env bash

# =============================================================================
# GradeLoop Core v2 - Deployment Script
# =============================================================================
# Pulls pre-built images from GitHub Container Registry (ghcr.io) and deploys
# to the production server.
#
# Usage:
#   ./scripts/deploy.sh                    # docker runtime (default)
#   RUNTIME=podman ./scripts/deploy.sh   # podman runtime
#
# Prerequisites:
#   - Docker/podman installed on server
#   - GitHub Container Registry credentials configured
#   - Project directory exists at ~/gradeloop-core-v2 or /opt/gradeloop-core-v2
#
# Required Environment Variables:
#   RUNTIME              Container runtime (docker or podman). Default: docker
#   GHCR_PACKAGE_PREFIX  GitHub package prefix (e.g., your-username or org)
#   GHCR_TOKEN           GitHub Personal Access Token with packages:read scope

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"
compose_file="infra/compose/compose.prod.images.yaml"

usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  -h, --help          Show this help
  -r, --runtime RT   Container runtime (docker|podman). Default: docker
  --no-pull          Skip pulling images (use local cache)
  --force           Force recreate containers
  --dry-run          Show what would be done without executing

Environment Variables:
  RUNTIME             Container runtime (default: docker)
  GHCR_PACKAGE_PREFIX GitHub package prefix (e.g., 4yrg)
  GHCR_TOKEN          GitHub PAT with packages:read permission
  SKIP_PULL           Set to '1' to skip image pull
  FORCE_RECREATE      Set to '1' to force recreate containers

EOF
}

main() {
    local runtime="${RUNTIME:-docker}"
    local skip_pull="${SKIP_PULL:-0}"
    local force_recreate="${FORCE_RECREATE:-0}"
    local dry_run=0

    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                usage; exit 0;;
            -r|--runtime)
                runtime="$2"; shift 2;;
            --no-pull)
                skip_pull=1; shift;;
            --force)
                force_recreate=1; shift;;
            --dry-run)
                dry_run=1; shift;;
            *)
                echo "Unknown option: $1" >&2
                usage; exit 1;;
        esac
    done

    echo "=== GradeLoop Core v2 Deployment ==="
    echo "Runtime: $runtime"
    echo "Repo root: $repo_root"
    echo ""

    if ! command -v "$runtime" &>/dev/null; then
        echo "ERROR: $runtime is not installed or not in PATH"
        exit 1
    fi

    # Detect compose command
    local compose_cmd=""
    if [ "$runtime" = "podman" ]; then
        if command -v podman-compose &>/dev/null; then
            compose_cmd="podman-compose"
        else
            compose_cmd="$runtime compose"
        fi
    else
        if command -v docker-compose &>/dev/null; then
            compose_cmd="docker-compose"
        else
            compose_cmd="$runtime compose"
        fi
    fi
    echo "Compose command: $compose_cmd"

    # Validate GHCR credentials
    if [ -z "${GHCR_PACKAGE_PREFIX:-}" ]; then
        echo "ERROR: GHCR_PACKAGE_PREFIX is not set"
        echo "Set it via: export GHCR_PACKAGE_PREFIX=your-username"
        exit 1
    fi

    if [ -z "${GHCR_TOKEN:-}" ]; then
        echo "ERROR: GHCR_TOKEN is not set"
        echo "Set it via: export GHCR_TOKEN=your-github-pat"
        exit 1
    fi

    # Navigate to project directory
    cd "$repo_root"
    echo "Working directory: $(pwd)"
    echo ""

    # Login to GHCR
    echo "Logging into GitHub Container Registry..."
    if [ "$dry_run" -eq 0 ]; then
        echo "$GHCR_TOKEN" | docker login -u "$GHCR_PACKAGE_PREFIX" --password-stdin ghcr.io
    else
        echo "[dry-run] docker login -u $GHCR_PACKAGE_PREFIX"
    fi

    # Pull images from GHCR
    if [ "$skip_pull" -eq 0 ]; then
        echo ""
        echo "Pulling images from GHCR..."
        if [ "$dry_run" -eq 0 ]; then
            $compose_cmd -f "$compose_file" pull
        else
            echo "[dry-run] $compose_cmd -f $compose_file pull"
        fi
    else
        echo ""
        echo "Skipping image pull (using local cache)"
    fi

    # Stop existing services gracefully
    echo ""
    echo "Stopping existing services..."
    if [ "$dry_run" -eq 0 ]; then
        $compose_cmd -f "$compose_file" down --remove-orphans 2>/dev/null || true
    else
        echo "[dry-run] $compose_cmd -f $compose_file down --remove-orphans"
    fi

    # Start services with zero-downtime
    echo ""
    echo "Starting services..."
    if [ "$dry_run" -eq 0 ]; then
        if [ "$force_recreate" -eq 1 ]; then
            $compose_cmd -f "$compose_file" up -d --remove-orphans --force-recreate
        else
            $compose_cmd -f "$compose_file" up -d --remove-orphans
        fi
    else
        echo "[dry-run] $compose_cmd -f $compose_file up -d --remove-orphans"
    fi

    # Wait for services to be healthy
    echo ""
    echo "Waiting for services to be healthy..."
    if [ "$dry_run" -eq 0 ]; then
        sleep 15
        $compose_cmd -f "$compose_file" ps
    else
        echo "[dry-run] sleep 15"
        echo "[dry-run] $compose_cmd -f $compose_file ps"
    fi

    # Cleanup unused images
    echo ""
    echo "Cleaning up unused images..."
    if [ "$dry_run" -eq 0 ]; then
        $runtime image prune -f
    else
        echo "[dry-run] $runtime image prune -f"
    fi

    # Logout from GHCR
    echo ""
    echo "Logging out from GHCR..."
    if [ "$dry_run" -eq 0 ]; then
        docker logout ghcr.io
    else
        echo "[dry-run] docker logout ghcr.io"
    fi

    echo ""
    echo "=== Deployment Complete ==="
    echo "Deployed at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Runtime: $runtime"
}

main "$@"
