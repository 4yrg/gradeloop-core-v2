# Phase 9 — Research and Report Mapping

## Mapping of Findings to Academic Report Sections

---

### 1. Introduction

| Report Element | Repository Evidence |
|----------------|-------------------|
| **System Background** | GradeLoop Core V2 is an AI-integrated Learning Management System (LMS) that addresses academic integrity in digital education. The platform provides automated code grading, plagiarism detection, keystroke biometric authentication, and AI-powered oral examination. |
| **Domain Overview** | Higher education assessment technology with focus on programming courses. The system targets the growing challenge of maintaining academic integrity in online and hybrid learning environments. |
| **Problem Domain** | Traditional assessment methods struggle with: (a) detecting code plagiarism across large classes, (b) verifying student identity during online exams, (c) providing timely, personalized feedback on programming assignments, (d) conducting oral examinations at scale. |
| **Existing Limitations** | Manual grading is time-prohibitive for large classes. Traditional plagiarism detectors miss semantic clones and AI-generated code. Identity verification is typically point-in-time (login only). Oral exams are logistically challenging at scale. |
| **Motivation** | To create an integrated platform that combines automated assessment with multi-layered academic integrity verification, reducing instructor workload while increasing assessment integrity. |
| **Objectives** | (1) Automated code grading with LLM-powered feedback, (2) Multi-engine plagiarism detection (syntactic, semantic, AI-generated), (3) Continuous behavioral biometric authentication, (4) AI-powered oral examination system, (5) Scalable cloud-native deployment. |
| **Research Relevance** | Intersection of: AI in Education (AIED), Automated Programming Assessment, Plagiarism Detection, Behavioral Biometrics, Voice-based Assessment, Microservices Architecture. |

---

### 2. Methodology

| Report Element | Repository Evidence |
|----------------|-------------------|
| **Architectural Methodology** | Cloud-native microservices architecture with event-driven design. Polyglot persistence (PostgreSQL + Redis + SeaweedFS). API Gateway pattern (Kong) for centralized routing and security. |
| **System Design Approach** | Domain-driven design with service-per-domain boundaries. Clean architecture in Go services (handler → service → repository). Modular monorepo structure with Turborepo orchestration. |
| **Development Methodology** | Agile development with feature branches, conventional commits, CI/CD automation. Monorepo management via Turborepo + Bun workspaces. |
| **Deployment Methodology** | Containerized deployment via Docker Compose on Hetzner VPS. Multi-stage Docker builds. CI/CD via GitHub Actions with quality gates and automated deployment to production. |
| **Testing Methodology** | Unit testing for Go services (testify + httptest). API testing via Bruno collection (manual). Test coverage infrastructure configured but not fully active. |
| **DevOps Methodology** | Infrastructure-as-Code (Docker Compose). Declarative Kong configuration. Separate infrastructure and application deployment workflows. |

---

### 3. Implementation

| Report Element | Repository Evidence |
|----------------|-------------------|
| **High-Level Architecture** | 12 microservices (6 Go + 6 Python) behind Kong API Gateway. Frontend: Next.js 16 with App Router. Backing services: PostgreSQL, RabbitMQ, Redis, SeaweedFS. |
| **Service Interactions** | Synchronous REST via Kong for frontend-to-service. Asynchronous events via RabbitMQ for cross-service workflows (submission.created → ACAFS grading). WebSocket for real-time viva and keystroke monitoring. |
| **Deployment Structure** | Docker Compose with separate dev, prod (self-build), prod (pre-built images), and infra-only configurations. All services containerized with multi-stage builds. |
| **Infrastructure Overview** | Hetzner VPS hosting. Kong API Gateway (port 8000). Per-service PostgreSQL databases. RabbitMQ event bus. Redis caching/sessions. SeaweedFS object storage. |
| **Technology Integration** | External APIs: OpenRouter (LLM), Gemini (voice + analysis + grading), Judge0 (code execution). Internal: SMTP (email), MinIO (storage). |
| **External Systems Communication** | All external communication via HTTPS/REST. Gemini Live API uses WebSocket for real-time voice. Judge0 for sandboxed code execution. SMTP for email delivery. |

---

### 4. Testing and Validation

| Report Element | Repository Evidence |
|----------------|-------------------|
| **Testing Approaches** | Go unit tests with testify mocking and in-memory SQLite. Bruno API collection for manual integration testing. CI quality gates (linting, formatting, type-checking). |
| **Validation Methods** | JWT token validation at gateway. Input validation via Zod (frontend) and Pydantic (backend). Rate limiting for DoS protection. Health checks on all services. |
| **Quality Assurance Mechanisms** | golangci-lint for Go, ruff for Python, ESLint for TypeScript. TypeScript strict mode. Go vet and gofmt in CI. SonarQube infrastructure configured. |
| **Reliability Measures** | Publisher confirms + DLX for RabbitMQ. Exponential backoff reconnection. Graceful shutdown. Health checks. Resource limits in production. |

---

### 5. Commercialization Potential

| Report Element | Repository Evidence |
|----------------|-------------------|
| **Scalability Opportunities** | Horizontal scaling of stateless microservices. Event-driven decoupling via RabbitMQ. Database-per-service for independent scaling. Kong for load distribution. |
| **Industry Applicability** | Higher education institutions with programming courses. Online learning platforms. Certification and bootcamp programs. Corporate training environments. |
| **Enterprise Readiness** | RBAC with granular permissions. Audit logging via structured logging. Multi-tenant PostgreSQL. Containerized deployment. SSO-ready (JWT-based). |
| **Deployment Flexibility** | Docker Compose (single server) or Kubernetes (planned). Vercel-compatible frontend. Cloud-agnostic (Hetzner, any Docker host). |
| **Cloud-Native Advantages** | 12-factor app principles. Stateless services. Configuration via environment variables. Logging as event streams. Disposability (fast startup/shutdown). |

---

### 6. Security and Ethical Considerations

| Report Element | Repository Evidence |
|----------------|-------------------|
| **Authentication Approaches** | JWT access tokens (15-min) + refresh tokens (7-day HttpOnly cookie). Token rotation on refresh. bcrypt password hashing. |
| **Access Control** | Role-Based Access Control (RBAC): super_admin, admin, employee, student. Granular permission system. Per-endpoint authorization guards. |
| **Security Mechanisms** | Kong gateway as single entry point. Rate limiting (20 req/min for login). CORS enforcement. Internal-only admin API. PII redaction in logs. 7-layer file upload validation. |
| **Data Protection Approaches** | Soft deletes for user records. Named Docker volumes for data persistence. SSL/TLS for Kong gateway. Secrets managed via GitHub Secrets + Vault. |
| **Ethical Considerations** | Continuous keystroke monitoring raised; BLAIM subsystem provides behavioral tracking with transparency. AI grades require instructor review. Voice enrollment with consent. |
| **System Limitations** | ML models require periodic retraining. Single-server deployment with Docker Compose limits scale. Test coverage incomplete. |

---

### 7. Results and Discussion

| Report Element | Notes |
|----------------|-------|
| **Performance Benchmarks** | CIPAS Phase 1: 5.76M files/hour throughput on 4-core container. Union-Find clustering: ~15ms for 1k submissions (target: 100ms). |
| **Architecture Trade-offs** | Polyglot benefits (Go for performance, Python for ML) vs operational complexity. Event-driven decoupling vs debugging difficulty. Monorepo vs independent repos. |
| **Validation** | Evidence interpretation system validated against acceptance criteria (3/3 passing). Performance benchmarks all under targets. |

---

### 8. Technologies Used

| Category | Primary Technologies |
|----------|-------------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Go Backend | Go 1.25, Fiber v3, GORM, RabbitMQ, MinIO |
| Python Backend | FastAPI, Uvicorn, PyTorch, Transformers, Tree-sitter |
| Database | PostgreSQL 16, Redis, SeaweedFS |
| AI/ML | OpenRouter, Gemini, GraphCodeBERT, UniXcoder, XGBoost, Resemblyzer |
| DevOps | GitHub Actions, Docker, Docker Compose, SonarQube |
| Infrastructure | Hetzner VPS, Kong API Gateway, GHCR |
