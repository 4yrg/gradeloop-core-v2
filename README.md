# GradeLoop V2 — Monorepo

> **Monorepo Structure & Developer Experience**  
> Single source of truth for all GradeLoop V2 components — from frontend to AI services

---

## 📁 Repository Overview

GradeLoop V2 follows a **domain-aligned microservices architecture** within a single monorepo, enabling atomic changes, shared tooling, and consistent developer experience across **Go**, **Python**, and **SvelteKit** codebases.

All services, libraries, infrastructure, and documentation are organized under clearly defined top-level directories:

```
gradeloop-core-v2/
├── apps/                     # All runnable applications
│   ├── web/                  # SvelteKit frontend
│   ├── gateway/              # API Gateway (Go)
│   └── services/             # Microservices (Go/Python)
│       ├── academics-service/        # Course, semester, enrollment management
│       ├── acafs-service/            # Academic Fairness Service (AI-powered)
│       ├── assignment-service/       # Assignment creation, submission, grading
│       ├── blaim-service/            # Blockchain-based Audit & Integrity Monitoring
│       ├── cipas-service/            # Comprehensive Integrity & Plagiarism Analysis
│       ├── email-notify-service/     # Email notifications & templating
│       └── ivas-service/             # Intelligent Video Analysis Service
├── shared/                   # Cross-cutting concerns
│   ├── protos/               # gRPC contracts (.proto files)
│   ├── libs/                 # Reusable internal libraries
│   │   ├── go/               # Go modules (auth, tracing, error handling)
│   │   └── py/               # Python packages (utils, DTOs, ML wrappers)
│   └── contracts/            # Auth, event schemas, domain contracts
├── infra/                    # Infrastructure-as-Code & local dev setup
│   ├── docker/               # Dockerfiles per service
│   ├── compose/              # Docker Compose for local development
│   ├── k8s/                  # Kubernetes manifests (future)
│   └── env/                  # Environment templates (.env.example)
├── scripts/                  # Dev & CI automation (migrate, test, build, seed)
├── ops/                      # Observability configs (Prometheus, Grafana, Loki)
└── docs/                     # ADRs, sequence diagrams, deployment guides
```

**✅ Conventions:**
- All paths use **lowercase with hyphens** (e.g., `assignment-service`, not `AssignmentService`)
- Each service is **self-contained** with its own database, API, and domain logic
- Shared code lives in `shared/` — **never duplicate utilities across services**

---

## 🧩 Key Directories Explained

| Directory | Purpose |
|-----------|---------|
| `apps/web/` | SvelteKit frontend — role-based UI for students, instructors, admins |
| `apps/gateway/` | Central entrypoint: handles auth, rate limiting, and routes to services |
| `apps/services/*/` | Independent microservices (each owns its DB, API, and domain logic) |
| `shared/protos/` | Source of truth for gRPC contracts — used to generate clients/servers |
| `shared/libs/go/` | Go utilities: JWT validation, error handling, OpenTelemetry helpers |
| `shared/libs/py/` | Python utilities: DTOs, queue clients, ML inference wrappers |
| `shared/contracts/` | Domain contracts: event schemas, JWT claims, shared DTOs |
| `infra/compose/` | One-command local setup (`docker compose up`) |
| `infra/docker/` | Production-ready Dockerfiles for each service |
| `docs/adr/` | Architecture Decision Records (e.g., ADR-001: Monorepo Strategy) |
| `scripts/` | Automation scripts for migrations, testing, database seeding |
| `ops/` | Observability stack configuration and alerting rules |

---

## 🚀 Service Catalog

### Core Services

| Service | Language | Description | Port |
|---------|----------|-------------|------|
| **academics-service** | Go | Course, semester, enrollment management | 8081 |
| **assignment-service** | Go | Assignment CRUD, submissions, grading workflows | 8082 |
| **email-notify-service** | Go | Email notifications with templating engine | 8083 |

### AI/ML Services

| Service | Language | Description | Port |
|---------|----------|-------------|------|
| **acafs-service** | Python | Academic Fairness Service (bias detection, grade distribution analysis) | 8084 |
| **cipas-service** | Python | Comprehensive Integrity & Plagiarism Analysis Service | 8085 |
| **ivas-service** | Python | Intelligent Video Analysis Service (proctoring, engagement metrics) | 8086 |
| **blaim-service** | Python | Blockchain-based Audit & Integrity Monitoring | 8087 |

### Infrastructure Services

| Service | Language | Description | Port |
|---------|----------|-------------|------|
| **gateway** | Go | API Gateway with auth, rate limiting, request routing | 8080 |
| **web** | SvelteKit | Frontend application | 5173 |

---

## 🛠️ Local Development

### Prerequisites

- **Docker** & **Docker Compose** (v2.x+)
- **Go** 1.23+
- **Python** 3.11+
- **Node.js** 20+ (for frontend)
- **Make** (optional, for automation)

### Quick Start

```bash
# Clone repository
git clone https://github.com/gradeloop/gradeloop-core-v2.git
cd gradeloop-core-v2

# Start all services locally
docker compose -f infra/compose/docker-compose.yml up

# Frontend: http://localhost:5173
# Gateway: http://localhost:8080
# Individual services: http://localhost:808X (see Service Catalog)
```

### Development Workflow

```bash
# Run a specific service
docker compose -f infra/compose/docker-compose.yml up academics-service

# View logs
docker compose -f infra/compose/docker-compose.yml logs -f assignment-service

# Rebuild after code changes
docker compose -f infra/compose/docker-compose.yml up --build

# Run database migrations
./scripts/migrate.sh up

# Seed local database with test data
./scripts/seed.sh
```

### Running Services Individually

**Go Service:**
```bash
cd apps/services/assignment-service
go mod download
go run cmd/server/main.go
```

**Python Service:**
```bash
cd apps/services/cipas-service
pip install -r requirements.txt
python src/main.py
```

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

See `docs/local-dev-guide.md` for debugging, hot-reload, and IDE setup.

---

## ➕ Adding a New Service

To add a new microservice (e.g., `analytics-service`):

### 1. Create Directory Structure

```bash
mkdir -p apps/services/analytics-service
cd apps/services/analytics-service
```

### 2. Initialize Language-Specific Structure

**Go Service:**
```bash
# Initialize Go module
go mod init github.com/gradeloop/gradeloop-core-v2/apps/services/analytics-service

# Create standard directories
mkdir -p cmd/server internal/{domain,handlers,repository} migrations
```

**Python Service:**
```bash
# Initialize Poetry project
poetry init

# Create standard directories
mkdir -p src/{domain,handlers,repository} migrations workers
```

### 3. Add Required Files

Every service **must** include:
- `README.md` — Service-specific documentation
- `Dockerfile` — Production container image
- `.env.example` — Environment variable template
- Database migrations (if applicable)

### 4. Register in Docker Compose

Add your service to `infra/compose/docker-compose.yml`:

```yaml
analytics-service:
  build:
    context: ../../apps/services/analytics-service
    dockerfile: ../../../infra/docker/analytics-service.Dockerfile
  ports:
    - "8088:8088"
  environment:
    - DATABASE_URL=${ANALYTICS_DB_URL}
  depends_on:
    - postgres
```

### 5. Add gRPC Contract (if applicable)

```bash
# Define proto contract
vi shared/protos/analytics/v1/analytics.proto

# Generate code
./scripts/generate-protos.sh
```

### 6. Update Documentation

- Add service to this README's Service Catalog
- Document API endpoints in `docs/api/`
- Create ADR if introducing new patterns

**⚠️ CI will fail if:**
- Service is placed outside `apps/services/`
- Directory name uses uppercase or underscores
- Missing required files (`Dockerfile`, `README.md`)

---

## 📤 Contribution Guidelines

### Git Commit Structure

Use **Conventional Commits** with Jira ticket reference:

```
<type>(<scope>): <short summary> [JIRA-XXXX]

<optional body>
```

**Examples:**
```
feat(iam): add refresh token rotation [GRADLOOP-7]
fix(cipas): resolve plagiarism threshold calculation [GRADLOOP-42]
chore(repo): scaffold monorepo structure [GRADLOOP-7]
docs(readme): document service layout [GRADLOOP-7]
refactor(assignment): extract grading logic to domain layer [GRADLOOP-23]
```

**Allowed types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`

### Pull Request (PR) Structure

Every PR must include:

**Title:**
```
[GRADLOOP-XXXX] Brief description of changes
```

**Description:**
- 🔗 Link to Jira user story
- 📝 Summary of changes
- 🖼️ Screenshots (if UI changes)
- ✅ Testing steps

**Checklist:**
- [ ] Follows directory and naming conventions
- [ ] Includes/updates relevant documentation
- [ ] Passes pre-commit hooks (`pre-commit run --all-files`)
- [ ] All CI pipelines green (lint, test, build)
- [ ] Database migrations tested (if applicable)
- [ ] No hardcoded secrets or credentials

**🚫 PRs violating naming or structure rules will be blocked by CI**

### Branch Naming

```
<type>/<jira-ticket>-<brief-description>

Examples:
feature/GRADLOOP-42-add-video-analysis
bugfix/GRADLOOP-55-fix-auth-middleware
hotfix/GRADLOOP-88-patch-security-issue
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
./scripts/test-all.sh

# Test specific service (Go)
cd apps/services/assignment-service
go test ./...

# Test specific service (Python)
cd apps/services/cipas-service
pytest

# Test frontend
cd apps/web
npm test
```

### Test Coverage

All services must maintain **minimum 80% code coverage**. CI will fail if coverage drops below threshold.

```bash
# Generate coverage report (Go)
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Generate coverage report (Python)
pytest --cov=src --cov-report=html
```

---

## 🔒 Security & Compliance

- ❌ **No secrets in repository** (use `.env` templates in `infra/env/`)
- 🔍 All dependencies scanned via CI (Snyk/Dependabot)
- 🏷️ Directory names avoid PII or sensitive terms
- 💻 Works on macOS, Linux, Windows (no invalid filenames)
- 🔐 All API endpoints require authentication (except health checks)
- 📜 Audit logs for all data mutations

### Environment Variables

Never commit secrets. Use environment templates:

```bash
# Copy template
cp infra/env/.env.example .env

# Fill in secrets locally
vi .env
```

---

## 📊 Observability

### Monitoring Stack

Located in `ops/`:
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing

### Accessing Dashboards

```bash
# Start observability stack
docker compose -f ops/docker-compose.observability.yml up

# Access dashboards
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
```

### Logging Standards

All services must use structured logging:

**Go (using `slog`):**
```go
slog.Info("Processing assignment", "assignmentID", id, "userID", userID)
```

**Python (using `structlog`):**
```python
logger.info("Processing assignment", assignment_id=id, user_id=user_id)
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ADR-001: Monorepo Structure](docs/adr/001-monorepo-structure.md) | Why we chose monorepo over polyrepo |
| [Local Development Guide](docs/local-dev-guide.md) | Detailed setup and debugging instructions |
| [Service Communication Patterns](docs/service-communication.md) | gRPC, REST, async messaging guidelines |
| [Observability Setup](docs/observability.md) | Metrics, logs, traces configuration |
| [Database Migrations](docs/migrations.md) | Schema management and versioning |
| [Deployment Guide](docs/deployment.md) | Production deployment procedures |

---

## 🏗️ Architecture Decisions

We maintain Architecture Decision Records (ADRs) in `docs/adr/`:

- **ADR-001**: Monorepo vs Polyrepo
- **ADR-002**: gRPC for service-to-service communication
- **ADR-003**: PostgreSQL for transactional data
- **ADR-004**: Event-driven architecture with NATS
- **ADR-005**: SvelteKit for frontend framework

---

## 🤝 Support & Community

- **Jira Board**: [GradeLoop Project](https://yourorg.atlassian.net/browse/GRADLOOP)
- **Slack Channel**: `#gradeloop-dev`
- **Team Wiki**: [Confluence Space](https://yourorg.atlassian.net/wiki/spaces/GRADLOOP)

---

## 📜 License

Proprietary - GradeLoop Inc. All rights reserved.

---

**Built with ❤️ by the GradeLoop Engineering Team**