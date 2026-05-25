# Phase 4 — CI/CD and DevOps Analysis

## CI/CD Pipeline Architecture

The project uses **GitHub Actions** with 5 workflow files organized across linting, quality checks, production deployment, infrastructure management, and static analysis.

---

## Workflow Inventory

### 1. Lint Pipeline (`lint.yml`)
- **Triggers**: Push or PR to `main`
- **Jobs** (parallel):
  - `lint-go`: golangci-lint v1.62 on Go 1.26 (6 Go services)
  - `lint-python`: ruff (check + fix) on Python 3.12 (6 Python services)
  - `lint-frontend`: ESLint on Node.js 22 (Next.js app)

### 2. Development Quality Pipeline (`development.yml`)
- **Triggers**: Push or PR to `development`
- **Jobs** (parallel quality gates):
  - `go-checks`: gofmt + go vet + go mod tidy -diff (Go 1.25)
  - `node-checks`: bun install --frozen-lockfile + bun run lint + bun run typecheck
  - `python-checks`: ruff check + ruff format --check (Python 3.11)

### 3. Production CD Pipeline (`production.yml`)
- **Triggers**: Push to `main`
- **Three Phases**:

**Phase 1 — Quality Gates** (same as development.yml)

**Phase 2 — Build & Push to GHCR** (parallel matrix builds):
| Job | Matrix | Image Pattern |
|-----|--------|---------------|
| `build-go-services` | 6 Go services | `ghcr.io/4yrg/gradeloop-{name}:latest, sha-{short_sha}` |
| `build-python-services` | 6 Python services | Same pattern |
| `build-gateway` | Kong 3.9.1 | `ghcr.io/4yrg/gradeloop-kong:latest` |

Key build characteristics:
- Docker Buildx + caching (`type=gha` for Go, `no-cache` for Python)
- SBOM and provenance attestations on all images
- Dual tagging: `latest` + `sha-<commit>`

**Phase 3 — Deploy to Hetzner**:
- SSH-based deployment via `appleboy/ssh-action`
- Supports Docker (primary) or Podman (manual trigger)
- Steps: git fetch/reset → GHCR auth → image pull → compose down → compose up → health verification

### 4. Infrastructure Deploy Pipeline (`infra-deploy.yml`)
- **Trigger**: Manual (`workflow_dispatch`)
- **Actions**: deploy, stop, restart, status
- **Target**: Infrastructure services (PostgreSQL, RabbitMQ, Redis, SeaweedFS, Kong DB)
- **Runtime**: Docker or Podman (selectable)

### 5. SonarQube Analysis (`sonarqube.yml`)
- **Trigger**: All branches and PRs
- **Status**: **Disabled** (`if: false`) — pending test coverage setup
- **Config**: `sonar-project.properties` with Go and Python coverage paths

---

## Deployment Lifecycle

```
Developer Push to main
    │
    ▼
GitHub Actions Trigger (production.yml)
    │
    ├── 1. Quality Checks (go vet, lint, format, typecheck)
    │
    ├── 2. Build 13 Docker Images
    │   ├── Go services (6): iam, email, academic, assessment, cipas-xai, notification
    │   ├── Python services (6): ivas, acafs, keystroke, cipas-ai, cipas-semantics, cipas-syntactics
    │   └── Gateway (1): Kong
    │
    ├── 3. Push to ghcr.io/4yrg/ (dual tags: latest + sha)
    │
    └── 4. SSH Deploy to Hetzner VPS
        ├── git fetch/reset to origin/main
        ├── docker login ghcr.io
        ├── docker compose pull (pre-built images)
        ├── docker compose down --remove-orphans
        ├── docker compose up -d
        └── Health check verification (30s wait + docker compose ps)
```

---

## Environment Strategy

| Environment | Compose File | Database Mode | Configuration Source |
|-------------|-------------|---------------|---------------------|
| Local Development | `compose.dev.yaml` | `KONG_DATABASE=off` | `.env.development` |
| Production (self-build) | `compose.prod.yaml` | `KONG_DATABASE=postgres` | `.env.prod` |
| Production (pre-built images) | `compose.prod.images.yaml` | `KONG_DATABASE=off` | SSH environment passthrough |
| Infra-only | `compose.infra.yaml` | N/A | Separately deployed |

---

## Secrets Management

Secrets managed in GitHub Actions:
- `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` — Hetzner server access
- `GHCR_TOKEN` — GitHub Container Registry authentication
- `JWT_SECRET_KEY` — JWT signing secret
- `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — Email service credentials
- `ACAFS_OPENROUTER_API_KEY` — LLM API key
- `JUDGE0_URL` — Code execution service URL

The shared `go/secrets` package also supports **HashiCorp Vault** for production secret management with automatic fallback to environment variables.

---

## Versioning Approach
- Docker images tagged with `latest` and `sha-<commit_sha>`
- Monorepo versioned as `0.1.0` (single version for all packages)
- No semantic versioning per-service at this stage

---

## Branching Strategy
- `main` — Production branch (triggers CD)
- `development` — Integration branch (triggers CI quality checks)
- Feature/bugfix branches: `feature/GRADLOOP-XXX-description`, `bugfix/GRADLOOP-XXX-description`
- Conventional Commits format for commit messages
