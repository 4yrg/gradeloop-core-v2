# Phase 5 — Infrastructure and Deployment Analysis

## Deployment Architecture

GradeLoop Core V2 is deployed on a **Hetzner bare-metal VPS** using **Docker Compose** (with Podman as an alternative runtime). The entire stack is containerized with multi-stage Docker builds.

---

## Containerization Strategy

### Multi-Stage Dockerfile Pattern

All services follow a consistent multi-stage build approach:

| Stage | Tag | Base Image | Purpose |
|-------|-----|------------|---------|
| builder | (default) | `golang:1.25-alpine` / `python:3.11-slim` | Compile dependencies, build artifacts |
| dev | `target: dev` | Lightweight | Hot-reload, live code mounting |
| production | `target: production` | `alpine:3.19` / `python:3.11-slim` | Minimal, non-root user, health checks |

**Go builds**: `CGO_ENABLED=0`, stripped binaries (`-ldflags="-s -w -buildid="`), `-trimpath`
**Python builds**: CUDA disabled (`CUDA_VISIBLE_DEVICES=""`), Poetry/pip install, non-root user
**Frontend**: Three-stage build (deps → builder → runner) using `oven/bun:1`, Next.js standalone output

### Docker Compose Organization

```
infra/compose/
├── compose.yaml              # Infrastructure only (local dev)
├── compose.dev.yaml          # Full development stack (13 services + infra + Kong)
├── compose.prod.yaml         # Production (self-built images, resource limits)
├── compose.prod.images.yaml  # Production (pre-built GHCR images, declarative Kong)
└── compose.infra.yaml        # Infrastructure-only production (separate network)
```

---

## Infrastructure Topology

```
Internet
    │
    ▼
[Kong Gateway] :8000 (proxy), :8001 (admin)
    │
    ├── /auth/* ──────────→ IAM Service :8081 ───→ PostgreSQL (main:5432)
    ├── /api/v1/* ────────→ Academic :8083 ──────→ PostgreSQL (main)
    ├── /api/v1/* ────────→ Assessment :8084 ───→ PostgreSQL (main), RabbitMQ, SeaweedFS
    ├── /api/v1/* ────────→ Email :8082 ────────→ PostgreSQL (main), RabbitMQ
    ├── /api/v1/* ────────→ Notification :8086 ──→ PostgreSQL (main), RabbitMQ, Redis
    ├── /api/v1/ivas ─────→ IVAS :8101 ─────────→ PostgreSQL (main), RabbitMQ, Redis, SeaweedFS
    ├── /api/v1/acafs ────→ ACAFS :8102 ────────→ PostgreSQL (main), RabbitMQ, SeaweedFS
    ├── /api/keystroke ───→ Keystroke :8103 ────→ PostgreSQL (keystroke:5433), Redis
    ├── /api/v1/ai ───────→ CIPAS-AI :8104 ────→ PostgreSQL (main)
    ├── /api/v1/semantics ─→ CIPAS-Semantics :8105 → PostgreSQL (main)
    ├── /api/v1/syntactics → CIPAS-Syntactics :8106 → PostgreSQL (main)
    └── /api/v1/xai ──────→ CIPAS-XAI :8085 (stateless, LLM proxy)

Shared Backing Infrastructure (internal network: gradeloop-infra-network):
    ├── PostgreSQL (main)    — multi-tenant: iam, academic, assessment, email, cipas, ivas, acafs, notification
    ├── PostgreSQL (keystroke) — dedicated keystroke DB (port 5433)
    ├── PostgreSQL (Kong)    — Kong configuration store (port 5434)
    ├── RabbitMQ             — async messaging (ports 5672, 15672)
    ├── Redis                — caching, sessions (port 6379)
    └── SeaweedFS            — S3 object storage (ports 9333, 8080)
```

---

## Service Exposure Strategy

| Service | Kong Path | Upstream Port | Protocol |
|---------|-----------|---------------|----------|
| IAM | `/api/v1/auth/*`, `/api/v1/users/*` | 8081 | HTTP REST |
| Academic | `/api/v1/{faculties,departments,courses,...}` | 8083 | HTTP REST |
| Assessment | `/api/v1/{assignments,submissions,groups,...}` | 8084 | HTTP REST |
| Email | `/api/v1/emails/*` | 8082 | HTTP REST |
| Notification | `/api/v1/notifications/*`, `/api/v1/notifications/stream` | 8086 | HTTP REST + SSE |
| IVAS | `/api/v1/ivas/*`, `/ws/ivas/*` | 8101 | HTTP REST + WebSocket |
| ACAFS | `/api/v1/acafs/*` | 8102 | HTTP REST |
| Keystroke | `/api/keystroke/*`, `/ws/monitor/*` | 8103 | HTTP REST + WebSocket |
| CIPAS-AI | `/api/v1/ai/*` | 8104 | HTTP REST |
| CIPAS-Semantics | `/api/v1/semantics/*` | 8105 | HTTP REST |
| CIPAS-Syntactics | `/api/v1/syntactics/*` | 8106 | HTTP REST |
| CIPAS-XAI | `/api/v1/xai/*` | 8085 | HTTP REST |

---

## Rate Limiting Configuration

| Service | Limit (req/min) | Notes |
|---------|----------------|-------|
| iam-service | 1000 | General IAM operations |
| iam-login | **20** | Brute-force protection |
| academic, assessment, acafs, cipas-* | 500 | Standard API services |
| email | 1000 | Higher throughput expected |
| notification | 120 | Real-time, low volume |
| ivas, keystroke | 100 | WebSocket-heavy, low REST volume |

---

## Network Security

- **Internal network**: All services communicate over `gradeloop-network` (Docker bridge)
- **External access**: Only Kong gateway port 8000 exposed to internet
- **Kong Admin API**: Internal-only (port 8001, not exposed)
- **Database isolation**: All PostgreSQL instances internal-only
- **SSL**: Production Kong configured with SSL certs from `/home/gradeloop/ssl`

---

## Fault Tolerance & Resilience

- **Health checks**: All services define HEALTHCHECK instructions
- **RabbitMQ**: Publisher confirms + dead letter exchanges for failed messages
- **Service discovery**: Docker DNS resolution for inter-service communication
- **Kong**: Load balancing across upstream services (round-robin)
- **Database**: Named Docker volumes for data persistence
- **Secrets**: HashiCorp Vault integration for production secret management
- **Graceful shutdown**: All services implement signal handling

---

## Deployment Workflow

```
1. Pre-flight: Image existence check for all 13 services
2. Verification: Confirm `.env.prod` and `compose.prod.images.yaml` are present
3. Teardown: docker compose down --remove-orphans
4. Startup: docker compose up -d (detached)
5. Verification: 30-second grace period, then docker compose ps
6. Cleanup: docker image prune -f (remove unused images)
```
