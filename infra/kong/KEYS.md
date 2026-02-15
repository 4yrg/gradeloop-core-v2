# Kong Key Management (KEYS.md)

This document explains how the repository's key generation and management works for Kong JWT verification and the auth service signing keys. It documents the `keygen` helper used by the local compose, where keys are written, how to rotate/regenerate keys, and security best-practices for development and production.

Paths referenced in this doc (relative to repo root)
- Kong template and rendered config:
  - `infra/kong/kong.yml`         (template with placeholder)
  - `infra/kong/rendered/kong.yml` (rendered file that Kong actually consumes)
- Keys directory:
  - `infra/kong/keys/private.pem` (RSA private key for the auth service)
  - `infra/kong/keys/public.pem`  (RSA public key for Kong)
- Compose that runs keygen + kong + auth-service:
  - `infra/compose/compose.yaml`

Summary (what happens on `docker compose up`)
- A short-lived `keygen` service runs first. It:
  - Generates an RSA keypair if none exists under `infra/kong/keys/`.
  - Renders a copy of the Kong manifest (`rendered/kong.yml`) by injecting the PEM public key into the `jwt_secrets` block (replacing the placeholder).
- Kong starts and mounts `infra/kong/rendered/kong.yml` and `infra/kong/keys`:
  - Kong uses the public key found in `rendered/kong.yml` to validate RS256 tokens.
  - The auth service reads `private.pem` to sign tokens (if configured to do so).
- The `keygen` container is "one-shot" (does not keep regenerating keys once they exist).

Important security note — do NOT commit private keys
- `infra/kong/keys/private.pem` is a sensitive secret. Never commit it to git.
- The local keygen convenience is for development and local testing only.
- For production, use a proper secret manager (Vault, AWS Secrets Manager, Kubernetes Secrets, etc.) and mount keys as read-only secrets into containers.

How to inspect current keys and rendered config (local dev)
- List keys and check permissions:
  - `ls -la infra/kong/keys`
- Inspect Kong's manifest:
  - `cat infra/kong/rendered/kong.yml | sed -n '1,200p'`
  - The `jwt_secrets` block should contain your public key PEM in `rsa_public_key`.
- Verify Kong container is using the rendered file (after bring-up):
  - `docker compose -f infra/compose/compose.yaml logs kong` (or `docker logs kong`)

Regeneration and rotation (development)
- If you want to force generation of a new keypair (rotating keys locally):
  1. Stop the stack:
     - `cd infra/compose`
     - `docker compose down`
  2. Remove the old keys and rendered manifest (BE CAREFUL — this permanently deletes the private key):
     - `rm -rf infra/kong/keys`
     - `rm -f infra/kong/rendered/kong.yml`
  3. Restart the stack (keygen will generate keys again):
     - `docker compose up --build -d --remove-orphans`
  4. Confirm new keys exist:
     - `ls -la infra/kong/keys`
     - `cat infra/kong/rendered/kong.yml | sed -n '1,200p'`
- Important: rotating keys invalidates tokens signed with the old private key. You must:
  - Re-issue tokens (e.g. ask users to log in again).
  - Or implement token revocation/rotation strategy (short-lived tokens + refresh tokens).

Rotation strategy (recommended for prod)
1. Use RS256 (auth service signs with private key; Kong only has public key).
2. Use short-lived access tokens (e.g., 15 minutes) and refresh tokens for session continuation.
3. To rotate keys without immediate mass invalidation:
   - Support multiple public keys in Kong and reference them with `kid` in tokens. Example:
     - Keep old key under `key: gradeloop-key-v1` and new under `key: gradeloop-key-v2`.
     - Issue new tokens using `kid: gradeloop-key-v2` while still accepting v1 until it expires.
   - Remove the old public key entry in Kong only after old tokens expire.
4. Store private keys in a secure secret store; do not keep rotation steps in VCS.

Production guidance (do not use local keygen)
- Replace the local `keygen` flow with your secret manager solution:
  - Provision/manage RSA keypair in Vault / KMS.
  - Mount the private key into your auth service container as a secret (file or env).
  - Provide Kong with the public key (declarative config, or push via Admin API from a secure CI job).
- Do not mount/write keys to repo directories on production hosts.
- Protect Kong admin API (bind to internal network / add auth).

Auth service changes (what we added)
- The auth service can now:
  - Read `RSA_PRIVATE_KEY` env var (PEM contents) or `RSA_PRIVATE_KEY_PATH` (path to PEM file).
  - If private key is present and parseable, tokens are signed with RS256.
  - If no RSA key is available, the code falls back to HS256 using `SECRET` (not recommended for prod).

File permissions & ownership (recommended)
- Private key must be readable only by the service user:
  - `chmod 600 infra/kong/keys/private.pem`
  - `chown <service-user>:<service-group> infra/kong/keys/private.pem` (if you run containers with a specific user)
- Public key is not sensitive but keep it read-only for processes that need it.

How Kong matches the key (kid)
- Tokens must include a `kid` claim that matches `jwt_secrets.key` in the Kong declarative config.
- Example flow:
  - `jwt_secrets` entry:
    ```yaml
    jwt_secrets:
      - consumer: gradeloop-client
        key: gradeloop-key
        algorithm: RS256
        rsa_public_key: |
          -----BEGIN PUBLIC KEY-----
          <public PEM here>
          -----END PUBLIC KEY-----
    ```
  - Tokens must contain `"kid": "gradeloop-key"` (or you can configure `key_claim_name` differently in the plugin config).

Troubleshooting
- Kong fails to start or rejects tokens:
  - Ensure `infra/kong/rendered/kong.yml` exists and contains a valid PEM public key.
  - Confirm file mounts in compose are correct (`docker inspect kong` -> `Mounts`).
  - Check Kong logs: `docker logs kong` or `docker compose -f infra/compose/compose.yaml logs kong`.
  - Validate the PEM is well-formed:
    - `openssl rsa -in infra/kong/keys/public.pem -pubin -text -noout`
- Auth service failing to sign:
  - Ensure `RSA_PRIVATE_KEY_PATH` env points to `/kong/keys/private.pem` inside the container.
  - Check file permissions inside the container: `docker exec -it gradeloop-auth-service ls -la /kong/keys`
  - Review auth service logs for PEM parse errors.

CI / Admin API automation
- For production, consider a CI job to:
  - Fetch the public key from your secrets manager and push it to Kong declarative config or Admin API.
  - Rotate keys by adding the new `jwt_secrets` entry, update token issuer to emit new `kid`, and then remove the old entry after a safe period.

Example manual OpenSSL commands (dev only)
- Generate a 2048-bit RSA private key:
  - `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem`
- Generate public key:
  - `openssl rsa -in private.pem -pubout -out public.pem`
- Quickly inspect the public key:
  - `openssl rsa -pubin -in public.pem -text -noout`

Backup & disaster recovery
- Back up `infra/kong/keys/private.pem` securely (encrypted backup).
- Keep an audit trail for key generation/rotation events.
- If private key is lost and you can't re-sign existing tokens, prompt a rotation strategy and force re-authentication.

Quick checklist before pushing to production
- [ ] Replace local keygen with secrets manager integration
- [ ] Ensure `private.pem` is only accessible to the auth service
- [ ] Load the public key into Kong via a secure CI job or secrets mechanism (do not commit to VCS)
- [ ] Use `kid`+multi-key strategy for smooth key rotations
- [ ] Harden Kong Admin API and secure network boundaries
- [ ] Implement monitoring and alerts for key usage and token validation failures

If you want, I can:
- Add an example CI job (GitHub Actions) that pushes the public key into Kong via the Admin API or updates the declarative manifest from a secret store.
- Add a small script to render the template locally (outside Docker) from `infra/kong/kong.yml` and inject the public key.
- Add a brief `infra/kong/README.md` with a step-by-step for local dev and rotation commands.
