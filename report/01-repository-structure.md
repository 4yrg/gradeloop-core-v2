# Phase 1 — Repository Structure Documentation

## Project Overview

- **Repository**: `gradeloop-core-v2`
- **Organization**: `4yrg` (GitHub)
- **Monorepo Manager**: Turborepo v2 + Bun workspaces (Bun 1.136.0)
- **License**: MIT
- **Description**: AI-integrated Learning Management System (LMS) — academic integrity platform with automated grading, plagiarism detection, voice-based oral examination, and keystroke biometric authentication.

---

## Top-Level Directory Map

```
gradeloop-core-v2/
├── apps/
│   ├── api-gateway/          # Kong API Gateway configuration
│   ├── services/             # 12 microservices (6 Go + 6 Python)
│   └── web/                  # Next.js 16 frontend application
├── packages/
│   ├── go/                   # 7 shared Go libraries
│   ├── python/               # 2 shared Python libraries
│   └── ts/                   # 3 shared TypeScript packages
├── infra/
│   └── compose/              # Docker Compose files (dev, prod, infra)
├── scripts/                  # Build, deploy, lint, test utility scripts
├── docs/                     # Architecture, ADRs, service documentation
├── bruno/                    # Bruno API testing collection (~130 requests)
├── .github/
│   └── workflows/            # 5 GitHub Actions CI/CD workflows
├── .vscode/                  # Workspace settings
├── .turbo/                   # Turborepo cache
├── .bin/                     # Local binaries (ruff)
├── cache/                    # Build cache
├── node_modules/             # Dependencies
├── workflows/                # Additional workflow files
├── environments/             # Environment configurations
├── web/                      # Additional web assets
├── services/                 # Additional services folder
├── compose/                  # Additional compose files
├── ivas/                     # IVAS-related files
└── .env.example              # Environment variable template (164 vars)
```

---

## Service Architecture (12 Microservices)

### Go Services (Fiber v3 + GORM, port range 8081–8086)

| Service | Port | Database | Queue | Storage | Purpose |
|---------|------|----------|-------|---------|---------|
| **iam** | 8081 | PostgreSQL (iam_db) | — | MinIO | Identity & Access Management |
| **email** | 8082 | PostgreSQL (email_db) | RabbitMQ | — | Event-driven email delivery |
| **academic** | 8083 | PostgreSQL (academic_db) | — | — | Academic data management |
| **assessment** | 8084 | PostgreSQL (assessment_db) | RabbitMQ | MinIO | Assignments & submissions |
| **cipas-xai** | 8085 | — | — | — | LLM proxy/chat service |
| **notification** | 8086 | PostgreSQL (notification_db) | RabbitMQ + Redis | — | Real-time notifications (SSE) |

### Python Services (FastAPI + Uvicorn, port range 8101–8106)

| Service | Port | Database | Queue | Storage | ML/AI Model |
|---------|------|----------|-------|---------|-------------|
| **ivas** | 8101 | PostgreSQL (dedicated, 5434) | RabbitMQ | MinIO + Redis | Resemblyzer + Gemini Live |
| **acafs** | 8102 | PostgreSQL | RabbitMQ | MinIO | Qwen3 + Gemini (LLM grading) |
| **keystroke** | 8103 | PostgreSQL (keystroke_db, 5433) | RabbitMQ | Redis | TypeNet (LSTM) |
| **cipas-ai** | 8104 | PostgreSQL | — | — | UniXcoder (PyTorch) |
| **cipas-semantics** | 8105 | PostgreSQL | — | — | GraphCodeBERT (PyTorch) |
| **cipas-syntactics** | 8106 | PostgreSQL | — | — | XGBoost + NiCAD |

---

## Shared Libraries (12 packages)

### Go Packages (`packages/go/`)
- **env**: Environment-aware `.env` file loading
- **errors**: Canonical domain error types (NotFound, ValidationError, Internal)
- **grpc**: gRPC client wrapper with service address registry
- **logger**: Structured JSON logger with PII redaction and trace ID propagation
- **middleware**: gRPC interceptors + Fiber trace middleware
- **notifier**: RabbitMQ notification publisher (exchange: `notifications`)
- **secrets**: HashiCorp Vault client with env var fallback

### Python Packages (`packages/python/`)
- **env_utils**: Root discovery and env loading (counterpart to `go/env`)
- **notifier**: RabbitMQ notification publisher (mirrors Go notifier topology)

### TypeScript Packages (`packages/ts/`)
- **config**: Shared `tsconfig.json` base (`@gradeloop/ts-config`)
- **dto**: Zod schemas for API contracts (`@gradeloop/dto`)
- **utils**: Pure utility functions (`@gradeloop/utils`)

---

## Frontend Architecture

- **Framework**: Next.js 16.1.6 (App Router, React 19.2.3)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **State Management**: Zustand v5 (with localStorage persistence)
- **API Client**: Axios (primary) + raw `fetch()` for gateway-tied services
- **Auth**: JWT (access token in memory, refresh token as HttpOnly cookie)
- **IDE**: Monaco Editor (@monaco-editor/react)
- **Build**: `output: "standalone"` for Docker, Vercel-compatible

### Route Groups
- `(auth)/` — Login, activation, password reset
- `(dashboard)/` — Protected routes (admin, instructor, student)
- `(public)/` — Clone detector, playground
- `ide/` — Online code editor

---

## API Gateway (Kong)

- **Gateway**: Kong API Gateway v3.4
- **Config**: Declarative (`KONG_DATABASE=off` in prod images mode)
- **Port**: 8000 (proxy), 8001 (admin API)
- **Routes**: 12 backend services via path-based routing
- **Plugins**: CORS (per-service origins), Rate Limiting (tiered), JWT Validation (per-service config)
- **Special**: WebSocket support (IVAS, Keystroke), SSE endpoint (Notification)

---

## Infrastructure Backing Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL (main) | postgres:16-alpine | 5432 | Multi-tenant app database |
| PostgreSQL (keystroke) | postgres:16-alpine | 5433 | Keystroke biometrics data |
| PostgreSQL (Kong) | postgres:16-alpine | 5434 | Kong gateway config store |
| RabbitMQ | rabbitmq:4.2-management-alpine | 5672, 15672 | Async message broker |
| Redis | redis:7-alpine | 6379 | Caching, sessions, pub/sub |
| SeaweedFS | chrislusf/seaweedfs:3.71 | 9333, 8080 | S3-compatible object storage |
