#!/usr/bin/env bash

# =============================================================================
# GradeLoop Core v2 - Lint All Services
# =============================================================================
# Runs linting checks on all services in the monorepo.
#
# Usage:
#   ./scripts/lint-all.sh           # Check mode (exit on error)
#   ./scripts/lint-all.sh --fix    # Fix mode (auto-fix where possible)
#   ./scripts/lint-all.sh --ci     # CI mode (less verbose, suitable for CI)
#
# Requirements:
#   - Go 1.23+
#   - Python 3.11+ with ruff
#   - Bun 1.x (for TypeScript/Node)
#   - Turbo (installed via bun)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"

# Options
FIX_MODE=0
CI_MODE=0

usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  -h, --help          Show this help
  -f, --fix           Fix issues where possible (ruff format, gofmt -w)
  -c, --ci           CI mode (less verbose, suitable for CI)

Examples:
  $0                  # Check mode - lint all services
  $0 --fix            # Fix mode - auto-fix issues
  $0 --ci             # CI mode - check for CI pipeline

EOF
}



log_info() {
    if [ "$CI_MODE" -eq 0 ]; then
        echo -e "\033[0;34m[INFO]\033[0m $*"
    else
        echo "[INFO] $*"
    fi
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $*" >&2
}

log_success() {
    if [ "$CI_MODE" -eq 0 ]; then
        echo -e "\033[0;32m[OK]\033[0m $*"
    else
        echo "[OK] $*"
    fi
}

log_section() {
    if [ "$CI_MODE" -eq 0 ]; then
        echo ""
        echo "=============================================="
        echo -e "\033[1;35m$*\033[0m"
        echo "=============================================="
    else
        echo ""
        echo "=============================================="
        echo "$*"
        echo "=============================================="
    fi
}

# Run a command, show output, and log it (stripping colors for log)
run_and_log() {
    "$@" 2>&1
    return ${PIPESTATUS[0]}
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage; exit 0;;
        -f|--fix)
            FIX_MODE=1; shift;;
        -c|--ci)
            CI_MODE=1; FIX_MODE=0; shift;;
        *)
            echo "Unknown option: $1" >&2
            usage; exit 1;;
    esac
done

# Change to repo root
cd "$REPO_ROOT"

EXIT_CODE=0

# =============================================================================
# Discovery & Setup
# =============================================================================

# Ensure ruff is available (download if missing)
ensure_ruff() {
    if command -v ruff &>/dev/null; then
        return 0
    fi

    # Check if we already downloaded it to .bin
    if [ -f "$REPO_ROOT/.bin/ruff" ]; then
        export PATH="$REPO_ROOT/.bin:$PATH"
        return 0
    fi

    log_info "Ruff not found. Attempting to download..."
    mkdir -p "$REPO_ROOT/.bin"

    # Try to download the binary
    local os_type="unknown-linux-gnu"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        os_type="apple-darwin"
    fi

    local arch_type="x86_64"
    if [[ "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ]]; then
        arch_type="aarch64"
    fi

    local ruff_url="https://github.com/astral-sh/ruff/releases/latest/download/ruff-${arch_type}-${os_type}.tar.gz"

    if command -v curl &>/dev/null; then
        curl -L "$ruff_url" | tar -xz -C "$REPO_ROOT/.bin" --strip-components=1
    elif command -v wget &>/dev/null; then
        wget -qO- "$ruff_url" | tar -xz -C "$REPO_ROOT/.bin" --strip-components=1
    else
        log_error "curl or wget not found. Cannot download ruff."
        return 1
    fi

    chmod +x "$REPO_ROOT/.bin/ruff"
    export PATH="$REPO_ROOT/.bin:$PATH"
    log_success "Ruff installed to .bin/"
}

# Find Go services (directories with go.mod)
find_go_services() {
    find apps/services packages/go -name "go.mod" -exec dirname {} \; | sort
}

# Find Python services (directories with pyproject.toml or requirements.txt)
find_python_services() {
    find apps/services -name "pyproject.toml" -o -name "requirements.txt" | xargs -n1 dirname | sort -u
}

# =============================================================================
# Lint Go Services
# =============================================================================
log_section "Linting Go Services"

GO_SERVICES=($(find_go_services))

for svc_dir in "${GO_SERVICES[@]}"; do
    svc=$(basename "$svc_dir")
    log_info "Checking $svc ($svc_dir)..."

    cd "$REPO_ROOT/$svc_dir"

    # Check formatting
    if [ "$FIX_MODE" -eq 1 ]; then
        run_and_log gofmt -w .
    else
        unformatted=$(gofmt -l .)
        if [ -n "$unformatted" ]; then
            log_error "$svc: Files not formatted:"
            echo "$unformatted" | while read -r f; do
                log_error "  - $f"
            done
            EXIT_CODE=1
        fi
    fi

    # Run go vet
    if ! run_and_log go vet ./...; then
        log_error "$svc: go vet found issues"
        EXIT_CODE=1
    fi

    # Check go mod tidy
    if [ "$FIX_MODE" -eq 1 ]; then
        run_and_log go mod tidy
    else
        # Capture diff if not tidy
        if ! run_and_log go mod tidy -diff; then
            log_error "$svc: go.mod/go.sum not tidy. Run 'go mod tidy'"
            EXIT_CODE=1
        fi
    fi

    cd "$REPO_ROOT"
    log_success "$svc"
done

# =============================================================================
# Lint Python Services
# =============================================================================
log_section "Linting Python Services"

ensure_ruff || true

PYTHON_SERVICES=($(find_python_services))

for svc_dir in "${PYTHON_SERVICES[@]}"; do
    svc=$(basename "$svc_dir")
    log_info "Checking $svc ($svc_dir)..."

    cd "$REPO_ROOT/$svc_dir"

    RUFF_CMD="ruff"
    if ! command -v ruff &>/dev/null; then
        if [ -f "pyproject.toml" ] && command -v poetry &>/dev/null; then
            if poetry run ruff --version &>/dev/null; then
                RUFF_CMD="poetry run ruff"
            else
                log_error "$svc: ruff not found in poetry environment. Skipping."
                continue
            fi
        else
            log_error "$svc: ruff not found. Skipping."
            continue
        fi
    fi

    # Run ruff check
    if [ "$FIX_MODE" -eq 1 ]; then
        run_and_log $RUFF_CMD check . --fix --exit-zero
        run_and_log $RUFF_CMD format .
    else
        if ! run_and_log $RUFF_CMD check .; then
            log_error "$svc: ruff check failed"
            EXIT_CODE=1
        fi
        if ! run_and_log $RUFF_CMD format --check .; then
            log_error "$svc: ruff format check failed"
            EXIT_CODE=1
        fi
    fi

    cd "$REPO_ROOT"
    log_success "$svc"
done

# =============================================================================
# Lint TypeScript/Node Services (via Turbo)
# =============================================================================
log_section "Linting TypeScript/Node Services"

cd "$REPO_ROOT"

# Check if bun is installed
if ! command -v bun &>/dev/null; then
    log_error "Bun not installed. Install from https://bun.sh"
    EXIT_CODE=1
else
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        bun install --frozen-lockfile
    fi

    # Run turbo lint
    log_info "Running Turbo lint..."
    if ! run_and_log bun run lint; then
        log_error "Turbo lint failed"
        EXIT_CODE=1
    fi

    # Run turbo typecheck
    log_info "Running Turbo typecheck..."
    if ! run_and_log bun run typecheck; then
        log_error "Turbo typecheck failed"
        EXIT_CODE=1
    fi
fi

# =============================================================================
# Summary
# =============================================================================
log_section "Linting Complete"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\033[0;32mAll linting checks passed!\033[0m"
else
    echo -e "\033[0;31mLinting issues found. Run with --fix to auto-fix where possible.\033[0m"
fi

exit $EXIT_CODE

