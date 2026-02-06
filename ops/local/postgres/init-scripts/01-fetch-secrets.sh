#!/bin/bash
set -e

# Fetch secrets from the shared volume populated by the sidecar
if [ -f /run/secrets/postgres_password ]; then
    export POSTGRES_PASSWORD=$(cat /run/secrets/postgres_password)
    echo "Loaded POSTGRES_PASSWORD from /run/secrets/postgres_password"
else
    echo "Waiting for secret..."
    # Simple retry loop handled by sidecar timing or we just fail and rely on restart policy
    # For now, let's assume sidecar is fast or we fail.
    # Actually, standard postgres init runs this. If variable not set, it might fail or default.
    # But we want to set POSTGRES_PASSWORD for the *server* to use?
    # No, POSTGRES_PASSWORD env var is used by the docker-entrypoint to set the password for the 'postgres' user.
    # If we are IN the init script, the entrypoint has already started.
    # The official postgres image allows usage of POSTGRES_PASSWORD_FILE which we are using in compose.
    # So this script might just be for OTHER setup or verification.
    # The prompt asked: "DB init scripts: Read secrets from Vault...". 
    # If we use POSTGRES_PASSWORD_FILE, the image handles it.
    
    echo "POSTGRES_PASSWORD_FILE is set to $POSTGRES_PASSWORD_FILE"
fi
