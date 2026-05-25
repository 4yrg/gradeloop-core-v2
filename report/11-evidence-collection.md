# Phase 11 — Evidence Collection

## Traceable References for Report Claims

---

### Repository Structure

| Claim | Evidence File |
|-------|--------------|
| Monorepo with Turborepo + Bun | `package.json`, `turbo.json`, `bun.lock` |
| 12 microservices (6 Go + 6 Python) | `apps/services/` directory structure |
| 12 shared packages (Go, Python, TS) | `packages/go/` (7), `packages/python/` (2), `packages/ts/` (3) |
| Frontend: Next.js 16 App Router | `apps/web/package.json`, `apps/web/next.config.ts` |
| API Gateway: Kong v3.4 | `apps/api-gateway/docker-compose.yaml`, `apps/api-gateway/config/kong.yml` |
| Infrastructure: Docker Compose | `infra/compose/compose.yaml`, `infra/compose/compose.dev.yaml`, `infra/compose/compose.prod.yaml` |

---

### System Architecture

| Claim | Evidence File |
|-------|--------------|
| Kong API Gateway single entry point | `apps/api-gateway/config/kong.yml` |
| JWT authentication flow | `docs/services/iam-service.md` (1625 lines), `apps/web/lib/api/axios.ts` |
| RabbitMQ event-driven messaging | `packages/go/notifier/notifier.go`, `packages/go/notifier/rabbitmq.go` |
| RBAC with 4 roles | `docs/services/iam-service.md` (Seed Data section) |
| Per-service databases | `infra/compose/compose.dev.yaml`, `docs/services/iam-service.md` |
| gRPC service registry | `packages/go/grpc/client.go` |
| Trace ID propagation | `packages/go/middleware/middleware.go`, `packages/go/middleware/fiber_trace.go` |

---

### Subsystem Placement

| Claim | Evidence File |
|-------|--------------|
| ACAFS event-driven code grading | `apps/services/acafs/README.md` |
| CIPAS multi-engine detection | `docs/cipas-similarity-scoring.md`, `apps/services/cipas-syntactics/README.md`, `apps/services/cipas-semantics/README.md` |
| CIPAS-AI UniXcoder detection | `apps/services/cipas-ai/src/main.py` |
| CIPAS Syntactics XGBoost pipeline | `apps/services/cipas-syntactics/config.yaml` |
| CIPAS Phase 1 infrastructure RFC | `docs/services/cipas-phase1-rfc.md` |
| BLAIM keystroke biometrics | `apps/services/keystroke/README.md` |
| BLAIM behavioral analysis scoring | `docs/behavior-analytics-simple-explanation.txt` |
| IVAS voice-based oral exam | `docs/ivas/BUILD_PLAN.md`, `apps/services/ivas/README.md` |
| IVAS WebSocket viva session | `apps/web/lib/ivas-api.ts` |
| Clone evidence interpretation | `docs/cipas-evidence-interpretation.md` |
| CIPAS instructor UI | `docs/cipas-instructor-ui-implementation.md` |
| Clone detection implementation plan | `docs/clone-detection-implementation-plan.md` |
| Groups date migration plan | `docs/groups-date-migration-plan.md` |

---

### CI/CD and DevOps

| Claim | Evidence File |
|-------|--------------|
| GitHub Actions CI/CD | `.github/workflows/production.yml`, `.github/workflows/development.yml`, `.github/workflows/lint.yml` |
| Infrastructure deploy workflow | `.github/workflows/infra-deploy.yml` |
| SonarQube configuration | `sonar-project.properties`, `.github/workflows/sonarqube.yml` |
| Docker build process | `scripts/docker-build.sh`, `scripts/deploy.sh` |
| GHCR image publishing | `.github/workflows/production.yml` (build matrix) |
| Multi-stage Docker builds | `apps/services/iam/Dockerfile`, `apps/services/acafs/Dockerfile`, `apps/web/Dockerfile` |
| SSH deployment to Hetzner | `.github/workflows/production.yml` (deploy step) |
| Rate limiting configuration | `apps/api-gateway/config/plugins/rate-limit.yaml`, `apps/api-gateway/config/kong.yml` |

---

### Infrastructure

| Claim | Evidence File |
|-------|--------------|
| Docker Compose topology | `infra/compose/compose.dev.yaml`, `infra/compose/compose.prod.yaml` |
| Kong gateway declarative config | `apps/api-gateway/config/kong.yml` |
| Per-service Kong routes | `apps/api-gateway/config/services/*.yaml` (12 service YAML files) |
| CORS plugin configuration | `apps/api-gateway/config/plugins/cors.yaml` |
| Network configuration | `apps/api-gateway/docker-compose.yaml` (gradeloop-network) |
| Environment templates | `.env.example` (164 vars), `.env.prod`, `.env.development` |
| Makefile dev/prod targets | `Makefile` |
| Database initialization | `scripts/init-databases.sh` |
| Kong gateway test suite | `scripts/test-kong.sh` |

---

### Testing

| Claim | Evidence File |
|-------|--------------|
| Go secrets package tests | `packages/go/secrets/client_test.go` (431 lines) |
| IAM email client tests | `apps/services/iam/internal/client/email_client_test.go` (212 lines) |
| Email service tests | `apps/services/email/internal/service/email_service_test.go` (151 lines) |
| Academic faculty tests | `apps/services/academic/internal/service/faculty_service_test.go` (656 lines) |
| Academic repository tests | `apps/services/academic/internal/repository/faculty_repository_test.go` (479 lines) |
| Academic handler tests | `apps/services/academic/internal/handler/faculty_handler_test.go` (321 lines) |
| Bruno API collection | `bruno/` directory (~130+ `.bru` request files) |
| Turborepo test task definition | `turbo.json` |
| Bruno collection config | `bruno/bruno.json` |
| CIPAS semantics smoke tests | `apps/services/cipas-semantics/Makefile` |

---

### Technologies

| Claim | Evidence File |
|-------|--------------|
| Go 1.25 + Fiber v3 | `apps/services/iam/go.mod`, `apps/services/academic/go.mod` |
| Python 3.11 + FastAPI | `apps/services/acafs/pyproject.toml`, `apps/services/ivas/pyproject.toml` |
| PostgreSQL 16 | `infra/compose/compose.dev.yaml` (postgres:16-alpine) |
| RabbitMQ | `infra/compose/compose.dev.yaml` (rabbitmq:3.13-management-alpine) |
| Redis | `infra/compose/compose.dev.yaml` (redis:7-alpine) |
| SeaweedFS | `infra/compose/compose.dev.yaml` (chrislusf/seaweedfs:3.71) |
| PyTorch (CPU) | `apps/services/cipas-ai/requirements.txt`, `apps/services/cipas-semantics/requirements.txt` |
| Transformers | `apps/services/cipas-semantics/requirements.txt` |
| Tree-sitter | `apps/services/acafs/pyproject.toml`, `apps/services/cipas-syntactics/pyproject.toml` |
| Zustand v5 | `apps/web/package.json` |
| Axios | `apps/web/package.json` |
| Tailwind CSS v4 | `apps/web/package.json`, `apps/web/postcss.config.mjs` |
| Git LFS for ML models | `.gitattributes` |

---

### Best Practices

| Claim | Evidence File |
|-------|--------------|
| Clean architecture (Go) | `apps/services/academic/internal/` (handler → service → repository) |
| Structured JSON logging with PII redaction | `packages/go/logger/logger.go` |
| PII redaction patterns | `packages/go/logger/logger.go` (passwords, tokens, SSN, emails, etc.) |
| Conventional commits spec | `CONTRIBUTING.md` |
| PR process (2 approvals) | `CONTRIBUTING.md` |
| Branch naming conventions | `CONTRIBUTING.md` |
| Health check endpoints | `apps/services/cipas-ai/src/main.py`, all Kong service configs |
| Soft deletes for users | `docs/services/iam-service.md` |
| JWT token rotation | `docs/services/iam-service.md` |
| bcrypt password hashing | `docs/services/iam-service.md` |
| Rate limiting (20/min login) | `apps/api-gateway/config/kong.yml` (iam-login service) |
| ADR documentation | `docs/adr/` (Architecture Decision Records) |
| Comprehensive contributing guide | `CONTRIBUTING.md` (704 lines) |
| Docker best practices | All Dockerfiles (multi-stage, non-root, HEALTHCHECK) |
| `.dockerignore` | `.dockerignore` |
| SonarQube exclusions for tests | `sonar-project.properties` |

---

### Documentation Files Index

| File | Path | Lines | Content |
|------|------|-------|---------|
| README | `README.md` | 39 | Main documentation index |
| Contributing Guide | `CONTRIBUTING.md` | 704 | Coding standards, PR process |
| IAM Service Spec | `docs/services/iam-service.md` | 1625 | Complete IAM specification |
| CIPAS Phase 1 RFC | `docs/services/cipas-phase1-rfc.md` | 1206 | CIPAS infrastructure design |
| CIPAS Similarity Scoring | `docs/cipas-similarity-scoring.md` | 702 | Three-stage pipeline |
| CIPAS Evidence Interpretation | `docs/cipas-evidence-interpretation.md` | 439 | Clone evidence visualization |
| CIPAS Instructor UI | `docs/cipas-instructor-ui-implementation.md` | 325 | Similarity analysis UI |
| Clone Detection Plan | `docs/clone-detection-implementation-plan.md` | 1341+ | Semantic clone detection plan |
| Behavioral Analytics | `docs/behavior-analytics-simple-explanation.txt` | 162 | Keystroke scoring explanation |
| IVAS Build Plan | `docs/ivas/BUILD_PLAN.md` | 121 | IVAS architecture plan |
| Groups Migration Plan | `docs/groups-date-migration-plan.md` | 228 | Date field migration |
| LLMs Context Guide | `LLMs.txt` | 344 | AI agent context for frontend/backend |
| Frontend Skill | `SKILL_Frontend.md` | 55 | Frontend design guidelines |
| PR Template | `pull_request_template.md` | 100 | Pull request template |
| PR Message Example | `PR_MESSAGE.md` | 98 | PR description example |
| Kong Test Suite | `scripts/test-kong.sh` | 273 | Kong API gateway tests |
| Environment Template | `.env.example` | 164 | All environment variables |
