# CIPAS — Code Integrity Analysis Service

Lightweight async FastAPI microservice for code analysis (CIPAS). This repository folder contains a production-ready template with:
- Async-first integrations (MinIO via `aioboto3`, Redis via `redis.asyncio`)
- Structured JSON logging (Loguru)
- Prometheus metrics (exposed at `/metrics`)
- Health checks at `/api/v1/health`
- src/ layout and Poetry-based dependency management

This README is a minimal placeholder used by the Dockerfile. See source code under `src/cipas/` for full implementation details.

## Quick start (development)

1. Ensure dependencies are available for local development:
   - Python 3.11+
   - Poetry

2. Install dependencies:
```sh
poetry install
```

3. Create a `.env` file (or export env vars) with required values. Example minimal variables (do NOT commit secrets):
```ini
CIPAS_MINIO_ENDPOINT=http://minio:9000
CIPAS_MINIO_ACCESS_KEY=minio
CIPAS_MINIO_SECRET_KEY=miniosecret
CIPAS_REDIS_URL=redis://redis:6379/0
CIPAS_ENV=development
CIPAS_LOG_LEVEL=INFO
```

4. Run the development server:
```sh
poetry run uvicorn cipas.main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- Health: `http://localhost:8000/api/v1/health`
- Metrics: `http://localhost:8000/metrics`
- OpenAPI docs: `http://localhost:8000/docs`

## Docker

A multi-stage `Dockerfile` is included at the service root and the top-level `docker-compose.yaml` builds and runs this service. The Docker build expects this `README.md` to exist (this file).

Build locally:
```sh
docker build -t cipas-service:local .
```

Or use the repo's docker-compose (from repo root):
```sh
docker compose up --build cipas-service
```

## Configuration

All runtime configuration is provided via environment variables and loaded using `pydantic-settings` with the `CIPAS_` prefix. Required variables include:
- `CIPAS_MINIO_ENDPOINT` (e.g. `http://minio:9000`)
- `CIPAS_MINIO_ACCESS_KEY`
- `CIPAS_MINIO_SECRET_KEY`
- `CIPAS_REDIS_URL` (e.g. `redis://redis:6379/0`)

Optional:
- `CIPAS_MINIO_REGION` (default `us-east-1`)
- `CIPAS_ENV`
- `CIPAS_LOG_LEVEL`
- `CIPAS_HEALTH_CHECK_TIMEOUT_SECONDS`

The service fails fast at startup if required variables are missing or invalid.

## Observability

- Structured JSON logs via Loguru.
- Prometheus metrics via `prometheus-fastapi-instrumentator` (exposed at `/metrics`).
- Health endpoint at `/api/v1/health` performs runtime checks for Redis and MinIO (and a lightweight AI-model probe).

## Project layout (important files)
```
src/cipas/
├── main.py                 # FastAPI app factory and startup/shutdown lifecycle
├── core/
│   └── config.py           # pydantic-settings-based configuration + logging setup
├── api/v1/
│   ├── deps/               # FastAPI dependencies (redis, s3, ai model)
│   └── routes/             # API routes (health, etc.)
├── services/
│   ├── storage/            # Async MinIO wrapper
│   ├── queue/              # Redis Streams consumer skeleton
│   └── analysis/           # Analysis service stub
└── models/                 # Pydantic schemas
```

## Development & tooling

- Linting: `ruff`
- Type checking: `mypy` (strict)
- Tests: `pytest` + `pytest-asyncio`
- Makefile targets:
  - `make dev` (run uvicorn with reload)
  - `make lint` (ruff + mypy)
  - `make test` (pytest)
  - `make build` (poetry build + docker)

## Notes and next steps

- Replace the AI model stub with a real async model loader if needed (manage heavy initialization at startup).
- For production, ensure secrets are injected securely (Kubernetes Secrets, Vault, etc.) and that logging/metrics are collected by your observability stack.
- Consider enabling TLS for MinIO/Redis and secure Traefik routing for external traffic.

If you need, I can expand this placeholder README with architecture diagrams, API contract examples, or local end-to-end test instructions.