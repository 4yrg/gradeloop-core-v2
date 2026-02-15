#!/bin/sh
#
# generate_keys.sh
#
# Key generation & kong.yml rendering helper for local dev.
# - Expects to be run with the repo's infra/kong directory bind-mounted as /work (or set WORKDIR env).
# - Generates RSA keypair (2048-bit) at /work/keys if none exists.
# - Renders /work/rendered/kong.yml by injecting the public key into the template /work/kong.yml
#   at the placeholder line: ## RSA_PUBLIC_KEY_PLACEHOLDER
#
# Behavior:
# - Idempotent: will not overwrite existing keys or rendered file unless FORCE_GEN=1 or FORCE_RENDER=1.
# - Exits 0 on success; prints helpful messages to stdout/stderr.
#
# Usage (compose uses this):
#   docker compose run --rm keygen
#
set -eu

# Configuration
WORKDIR="${WORKDIR:-/work}"
KEYS_DIR="$WORKDIR/keys"
RENDER_DIR="$WORKDIR/rendered"
TEMPLATE="$WORKDIR/kong.yml"
RENDERED="$RENDER_DIR/kong.yml"
PUBKEY="$KEYS_DIR/public.pem"
PRIVKEY="$KEYS_DIR/private.pem"

FORCE_GEN="${FORCE_GEN:-0}"
FORCE_RENDER="${FORCE_RENDER:-0}"

log() {
  printf '%s\n' "$1"
}

err() {
  printf '%s\n' "$1" >&2
}

# Ensure workdir exists
if [ ! -d "$WORKDIR" ]; then
  err "WORKDIR '${WORKDIR}' does not exist. Creating it."
  mkdir -p "$WORKDIR" || { err "Failed to create ${WORKDIR}"; exit 1; }
fi

# Ensure template exists
if [ ! -f "$TEMPLATE" ]; then
  err "Template '$TEMPLATE' not found. Nothing to render."
  # Nothing to do; exit success so compose can continue (or let user create template)
  exit 0
fi

# Create keys/rendered directories
mkdir -p "$KEYS_DIR" "$RENDER_DIR"
chmod 700 "$KEYS_DIR" || true

# Generate RSA keypair if missing (or if forced)
if [ ! -f "$PRIVKEY" ] || [ "${FORCE_GEN}" = "1" ]; then
  log "Generating RSA keypair..."
  # Try to ensure openssl exists; on minimal images apk may be needed (compose will have alpine)
  if ! command -v openssl >/dev/null 2>&1; then
    err "openssl not found in container. Attempting to install (apk)..."
    if command -v apk >/dev/null 2>&1; then
      apk add --no-cache openssl >/dev/null 2>&1 || true
    fi
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    err "openssl is required but not available. Please install openssl in the image."
    exit 1
  fi

  # Generate private key (PKCS#1) and public key
  umask 077
  openssl genpkey -algorithm RSA -out "$PRIVKEY" -pkeyopt rsa_keygen_bits:2048 || {
    err "Failed to generate RSA private key."
    exit 1
  }
  chmod 600 "$PRIVKEY" || true

  openssl rsa -in "$PRIVKEY" -pubout -out "$PUBKEY" || {
    err "Failed to extract RSA public key."
    exit 1
  }
  chmod 644 "$PUBKEY" || true

  log "RSA keypair generated at:"
  log "  private: $PRIVKEY"
  log "  public : $PUBKEY"
else
  log "RSA keypair already exists; skipping generation."
fi

# Render kong.yml by replacing the placeholder line with the public key contents.
# Only render if rendered file missing/empty or forced.
if [ ! -s "$RENDERED" ] || [ "${FORCE_RENDER}" = "1" ]; then
  if [ ! -f "$PUBKEY" ]; then
    err "Public key '$PUBKEY' not found; cannot render kong.yml."
    exit 1
  fi

  log "Rendering kong.yml -> $RENDERED (injecting public key)..."

  # Use awk to replace the placeholder line with the PEM file contents.
  # The placeholder expected in template: a line containing "## RSA_PUBLIC_KEY_PLACEHOLDER"
  awk -v pkfile="$PUBKEY" '
    BEGIN { inserted = 0 }
    /## RSA_PUBLIC_KEY_PLACEHOLDER/ {
      # Print the public key file contents in place of the placeholder
      while ((getline line < pkfile) > 0) {
        print line
      }
      inserted = 1
      next
    }
    { print }
    END {
      if (inserted == 0) {
        # If placeholder not found, warn to stderr and still write original template
        print "\n# WARNING: RSA_PUBLIC_KEY_PLACEHOLDER not found in template" > "/dev/stderr"
      }
    }
  ' "$TEMPLATE" > "$RENDERED".tmp || {
    err "Failed to render kong.yml (awk failed)."
    rm -f "$RENDERED".tmp || true
    exit 1
  }

  # Replace file atomically
  mv "$RENDERED".tmp "$RENDERED"
  chmod 444 "$RENDERED" || true

  log "Rendered kong.yml written to: $RENDERED"
else
  log "Rendered kong.yml already exists; skipping render."
fi

log "Key generation and rendering complete."
exit 0
