#!/usr/bin/env bash

# =============================================================================
# GradeLoop Core v2 - Deployment Script
# =============================================================================
# Pulls pre-built images from DockerHub and deploys to Hetzner server.
#
# Usage:
#   ./scripts/deploy.sh                    # docker runtime (default)
#   RUNTIME=podman ./scripts/deploy.sh   # podman runtime
#
# Prerequisites:
#   - Docker/podman installed on server
#   - DockerHub credentials configured (.env or env vars)
#   - Project directory exists at ~/gradeloop-core-v2 or /opt/gradeloop-core-v2
#
# Required Environment Variables:
#   RUNTIME              Container runtime (docker or podman). Default: docker
#   DOCKERHUB_USERNAME   DockerHub username
#   DOCKERHUB_TOKEN       DockerHub access token (not password)

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"
compose_file="infra/compose/compose.prod.yaml"

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
  DOCKERHUB_USERNAME  DockerHub username
  DOCKERHUB_TOKEN     DockerHub access token
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

    # Validate DockerHub credentials
    if [ -z "${DOCKERHUB_USERNAME:-}" ]; then
        echo "ERROR: DOCKERHUB_USERNAME is not set"
        echo "Set it via: export DOCKERHUB_USERNAME=your-username"
        exit 1
    fi

    if [ -z "${DOCKERHUB_TOKEN:-}" ]; then
        echo "ERROR: DOCKERHUB_TOKEN is not set"
        echo "Set it via: export DOCKERHUB_TOKEN=your-access-token"
        exit 1
    fi

    # Navigate to project directory
    cd "$repo_root"
    echo "Working directory: $(pwd)"
    echo ""

    # Login to DockerHub
    echo "Logging into DockerHub..."
    if [ "$dry_run" -eq 0 ]; then
        echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin docker.io
    else
        echo "[dry-run] docker login -u $DOCKERHUB_USERNAME"
    fi

    # Pull images from DockerHub
    if [ "$skip_pull" -eq 0 ]; then
        echo ""
        echo "Pulling images from DockerHub..."
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

    # Logout from DockerHub
    echo ""
    echo "Logging out from DockerHub..."
    if [ "$dry_run" -eq 0 ]; then
        docker logout docker.io
    else
        echo "[dry-run] docker logout docker.io"
    fi

    echo ""
    echo "=== Deployment Complete ==="
    echo "Deployed at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Runtime: $runtime"
}

main "$@"