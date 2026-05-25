# Phase 2 — High-Level System Architecture

## Architectural Style

GradeLoop Core V2 employs a **cloud-native microservices architecture** organized as a polyglot monorepo. The system follows an **API Gateway + Backend-for-Frontend (BFF)** pattern with **event-driven asynchronous processing** for long-running and non-blocking operations.

---

## Architecture Layers

### 1. Presentation Layer (Frontend)
- Single-page application built with **Next.js 16** (React 19) using App Router
- Three role-based portals: **Admin**, **Instructor**, **Student**
- Delivered as a Docker container (standalone output) or deployed to Vercel
- Communicates exclusively through the **Kong API Gateway**

### 2. Gateway Layer (API Gateway)
- **Kong API Gateway** serves as the single entry point for all client traffic
- Handles: routing, rate limiting, CORS enforcement, JWT validation
- Path-based routing to 12 backend microservices
- Supports both REST (HTTP) and WebSocket protocols

### 3. Application Layer (Microservices)
- **6 Go services** (Fiber v3): iam, email, academic, assessment, cipas-xai, notification
- **6 Python services** (FastAPI): ivas, acafs, keystroke, cipas-ai, cipas-semantics, cipas-syntactics
- Services communicate via **REST/gRPC** (synchronous) and **RabbitMQ** (asynchronous)

### 4. Infrastructure Layer (Backing Services)
- **PostgreSQL 16** — Primary data storage (per-service databases)
- **RabbitMQ** — Asynchronous message broker (event-driven workflows)
- **Redis** — Caching, session state, pub/sub
- **SeaweedFS** — S3-compatible object storage (code submissions, audio recordings)

---

## Communication Patterns

| Pattern | Protocol | Use Case |
|---------|----------|----------|
| Synchronous REST | HTTP/HTTPS via Kong | Frontend-to-service, service-to-service |
| Asynchronous Events | RabbitMQ (AMQP) | Submission processing, email dispatch, notifications |
| Real-time Streaming | WebSocket | IVAS viva sessions, keystroke monitoring |
| Server-Sent Events | HTTP SSE | Live notification delivery |
| gRPC | HTTP/2 | Inter-service communication (planned/infrastructure) |
| External AI APIs | HTTPS/REST | LLM providers (OpenRouter, Gemini), Judge0 code execution |

---

## Authentication & Authorization Flow

1. User authenticates via **IAM Service** (`POST /api/v1/auth/login`)
2. IAM issues **JWT access token** (15 min) + **refresh token** (7 days, HttpOnly cookie)
3. Frontend stores access token in-memory (Zustand), refresh token in HttpOnly cookie
4. Axios interceptor attaches Bearer token to every request
5. Kong gateway validates JWT on protected routes (per-service config)
6. On 401, Axios interceptor auto-refreshes via `/auth/refresh`
7. IAM enforces **Role-Based Access Control** (RBAC): super_admin, admin, employee, student

---

## Event-Driven Architecture (RabbitMQ)

The system uses RabbitMQ as its central event bus. Key event flows:

| Event | Publisher | Consumer(s) | Purpose |
|-------|-----------|-------------|---------|
| `submission.created` | Assessment Service | ACAFS | Triggers automated code grading |
| Notification events | Multiple services | Notification Service | In-app and email notifications |
| Email dispatch | IAM, Academic | Email Service | Password resets, alerts |

RabbitMQ topology includes **Dead Letter Exchanges (DLX)** for failed message handling, with retry via exponential backoff.

---

## Data Storage Strategy

- **PostgreSQL** with per-service databases (multi-tenancy at database level)
- **Dedicated PostgreSQL instance** for keystroke biometric data (port 5433)
- **Dedicated PostgreSQL instance** for Kong gateway config (port 5434)
- **SeaweedFS** for unstructured data: code submissions, audio recordings, user avatars
- **Redis** for ephemeral: session state (IVAS), pub/sub (notifications), caching

---

## Scalability Strategy

- **Horizontal scaling** of stateless microservices via Docker Compose replicas
- **Event-driven decoupling** via RabbitMQ allows independent scaling of consumers
- **Kong gateway** provides centralized rate limiting and load distribution
- **SeaweedFS** provides scalable S3-compatible object storage
- **CI/CD pipeline** builds all services as Docker images for consistent scaling

---

## External Interface Mapping

| Interface | Service | Protocol | Purpose |
|-----------|---------|----------|---------|
| OpenRouter API | ACAFS, CIPAS-XAI | HTTPS/REST | LLM reasoning & chat |
| Gemini API | ACAFS, IVAS, Keystroke | HTTPS/REST + WebSocket | Structured grading, voice, behavioral analysis |
| Judge0 API | ACAFS, Assessment | HTTPS/REST | Code execution & test-case scoring |
| SMTP | Email Service | SMTP | Outbound email delivery |
