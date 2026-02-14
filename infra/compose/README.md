# Docker Compose Environment Setup

This directory contains the development Docker Compose configuration.

## Environment Variables

Docker Compose needs certain environment variables for substitution in `compose.dev.yaml`. These variables must be available when running `docker compose` commands.

### Setup

1. **Create local .env file** (gitignored):
   ```bash
   cp .env.example .env
   ```

2. **Copy values from root .env**:
   ```bash
   # From the infra/compose directory
   grep "^POSTGRES_URL_BASE\|^POSTGRES_SSLMODE" ../../.env > .env
   ```

   Or manually add these variables:
   - `POSTGRES_URL_BASE`
   - `POSTGRES_SSLMODE`

3. **Run docker compose**:
   ```bash
   docker compose -f compose.dev.yaml up --build
   ```

### Why is this needed?

- The root `../../.env` file is loaded by **individual services** via `env_file` in the compose file
- However, **Docker Compose itself** needs variables for substitution in the YAML (e.g., `${POSTGRES_URL_BASE}`)
- Docker Compose looks for `.env` in the **same directory** as the compose file for these substitutions

This keeps sensitive values in the root `.env` (gitignored) while allowing compose to function properly.
