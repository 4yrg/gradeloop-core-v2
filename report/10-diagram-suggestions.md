# Phase 10 — Diagram and Visualization Suggestions

## Recommended Visual Artifacts for Final Report

---

### 1. System Architecture Diagram
- **Purpose**: Show the complete system landscape including all microservices, gateway, frontend, and backing services
- **Components**: Kong Gateway, 12 microservices, Next.js frontend, PostgreSQL instances, RabbitMQ, Redis, SeaweedFS
- **Notation**: C4 Container Diagram (level 2) or UML Deployment Diagram
- **Evidence Sources**:
  - `apps/api-gateway/config/kong.yml` — Service routes and upstream targets
  - `infra/compose/compose.prod.images.yaml` — All service definitions
  - `packages/go/grpc/client.go` — Service address constants

---

### 2. Deployment Diagram
- **Purpose**: Illustrate the Docker Compose deployment topology on Hetzner VPS
- **Components**: Docker host, containers, ports, networks, volumes
- **Notation**: UML Deployment Diagram or Docker Compose architecture diagram
- **Evidence Sources**:
  - `infra/compose/compose.prod.images.yaml` — Production deployment configuration
  - `infra/compose/compose.infra.yaml` — Infrastructure service topology
  - `scripts/deploy.sh` — Deployment workflow

---

### 3. CI/CD Pipeline Diagram
- **Purpose**: Visualize the GitHub Actions workflow from commit to production deployment
- **Components**: Quality checks → Build → Push to GHCR → SSH Deploy → Health verification
- **Notation**: BPMN or UML Activity Diagram
- **Evidence Sources**:
  - `.github/workflows/production.yml` — Main CD pipeline
  - `.github/workflows/development.yml` — Quality check pipeline
  - `.github/workflows/lint.yml` — Linting pipeline

---

### 4. Service Communication Diagram
- **Purpose**: Show synchronous (REST) and asynchronous (RabbitMQ) communication between services
- **Components**: All 12 services, Kong gateway, RabbitMQ exchanges/queues
- **Notation**: C4 Dynamic Diagram or UML Sequence Diagram
- **Evidence Sources**:
  - `apps/services/acafs/README.md` — Event-driven architecture description
  - `packages/go/notifier/notifier.go` — RabbitMQ topology
  - `packages/python/notifier/` — Python notifier (same topology)

---

### 5. Authentication Flow Sequence Diagram
- **Purpose**: Document the JWT authentication flow (login → token refresh → logout)
- **Components**: User, Frontend, Kong Gateway, IAM Service, Browser
- **Notation**: UML Sequence Diagram
- **Evidence Sources**:
  - `docs/services/iam-service.md` — Full auth specification
  - `apps/web/lib/api/axios.ts` — Axios interceptor logic
  - `apps/web/lib/stores/authStore.ts` — Auth state management

---

### 6. Data Flow Diagram — Submission Grading Pipeline
- **Purpose**: Show the path from student submission to graded result
- **Components**: Student, Frontend, Assessment Service, RabbitMQ, ACAFS, Judge0, OpenRouter, Gemini
- **Notation**: DFD (Data Flow Diagram) or UML Activity Diagram
- **Evidence Sources**:
  - `apps/services/acafs/README.md` — ACAFS pipeline description
  - `apps/services/assessment/` — Submission handling
  - `infra/compose/rabbitmq.conf` — Message broker config

---

### 7. CIPAS Clone Detection Pipeline Diagram
- **Purpose**: Illustrate the three-stage clone detection pipeline (pre-filter → LCS → thresholding)
- **Components**: Tree-sitter parser, MinHash/LSH pre-filter, LCS engine, XGBoost classifier
- **Notation**: Flowchart or UML Activity Diagram
- **Evidence Sources**:
  - `docs/cipas-similarity-scoring.md` — Three-stage pipeline
  - `docs/clone-detection-implementation-plan.md` — Phase 1-5 plan
  - `apps/services/cipas-syntactics/README.md` — Pipeline architecture

---

### 8. IVAS Viva Session Sequence Diagram
- **Purpose**: Document the real-time bidirectional voice assessment flow
- **Components**: Student, Frontend, IVAS Service, Gemini Live API, Redis, MinIO
- **Notation**: UML Sequence Diagram
- **Evidence Sources**:
  - `docs/ivas/BUILD_PLAN.md` — IVAS architecture
  - `apps/services/ivas/README.md` — Service overview
  - `apps/web/lib/ivas-api.ts` — WebSocket client integration

---

### 9. Infrastructure Topology Diagram
- **Purpose**: Show the network topology, port mappings, and service exposure
- **Components**: Internet, Kong Gateway, internal network, all containers with ports
- **Notation**: Network topology diagram or C4 Deployment Diagram
- **Evidence Sources**:
  - `infra/compose/compose.infra.yaml` — Infrastructure network
  - `apps/api-gateway/docker-compose.yaml` — Gateway networking
  - `apps/api-gateway/config/kong.yml` — Route-to-upstream mapping

---

### 10. BLAIM Keystroke Authentication Flow
- **Purpose**: Document the keystroke dynamics enrollment and verification process
- **Components**: User, Monaco Editor, Frontend, Keystroke Service, Redis, PostgreSQL
- **Notation**: UML Sequence Diagram
- **Evidence Sources**:
  - `apps/services/keystroke/README.md` — API endpoints and flow
  - `apps/web/lib/hooks/use-keystroke-capture.ts` — Frontend capture hook
  - `docs/behavior-analytics-simple-explanation.txt` — Scoring explanation

---

### 11. Module Interaction Diagram — ACAFS
- **Purpose**: Show ACAFS's interaction with external services (Judge0, OpenRouter, Gemini)
- **Components**: ACAFS, Assessment Service, RabbitMQ, MinIO, Judge0, OpenRouter, Gemini
- **Notation**: UML Component Diagram or C4 Container Diagram
- **Evidence Sources**:
  - `apps/services/acafs/README.md` — Architecture description
  - `apps/services/acafs/pyproject.toml` — Dependencies

---

### 12. Database Schema Relationship Diagram
- **Purpose**: Show the database-per-service pattern and table relationships
- **Components**: All PostgreSQL databases and their key tables
- **Notation**: ER Diagram (Entity-Relationship)
- **Evidence Sources**:
  - `docs/services/iam-service.md` — IAM database schema (7 tables)
  - `docs/cipas-evidence-interpretation.md` — CIPAS schema
  - `apps/services/academic/` — Academic service models
