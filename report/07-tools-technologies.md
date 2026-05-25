# Phase 7 — Tools and Technologies Analysis

## Categorized Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.6 | React framework with App Router |
| React | 19.2.3 | UI component library |
| TypeScript | 5.x | Type-safe JavaScript |
| Tailwind CSS | 4.x | Utility-first CSS framework |
| shadcn/ui | Latest | Component library (Radix UI primitives) |
| Framer Motion | Latest | Animation library |
| Monaco Editor | Latest | Online code editor (IDE component) |
| Zustand | 5.x | State management |
| Axios | 1.13.5 | HTTP client with interceptors |
| TanStack Table | Latest | Data tables |
| Recharts / D3 | Latest | Data visualization |
| Zod | 3.x | Schema validation |

### Backend — Go Services
| Technology | Version | Purpose |
|-----------|---------|---------|
| Go | 1.25 | Programming language |
| Fiber v3 | 3.0.0-rc.1 | Web framework (Express-like) |
| GORM | Latest | ORM for PostgreSQL |
| golang-jwt | v5 | JWT authentication |
| RabbitMQ AMQP | 1.10.x | Message queue client |
| MinIO Go | v7 | S3-compatible object storage client |
| go.uber.org/zap | Latest | Structured logging |
| google/uuid | 1.6.x | UUID generation |
| HashiCorp Vault | 1.10.x | Secrets management |
| gRPC | 1.79.x | Inter-service RPC communication |
| excelize | Latest | Excel file handling (bulk user import) |
| go-redis | v9 | Redis client |

### Backend — Python Services
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11 | Programming language |
| FastAPI | Latest | Async web framework |
| Uvicorn | Latest | ASGI server |
| Pydantic | Latest | Data validation |
| SQLAlchemy | Latest | ORM (keystroke, cipas-syntactics) |
| asyncpg | Latest | Async PostgreSQL driver |
| aio-pika / pika | Latest | RabbitMQ async/sync client |
| redis-py | Latest | Redis client |
| MinIO Python | Latest | S3-compatible storage client |
| structlog | Latest | Structured logging |
| httpx | Latest | Async HTTP client |
| websockets | Latest | WebSocket support |
| PyTorch (CPU) | Latest | ML model inference |
| Transformers | Latest | Hugging Face model loading |
| Tree-sitter | Latest | Code parsing (multi-language AST) |
| scikit-learn | Latest | ML utilities |
| XGBoost | Latest | Gradient boosting (syntactic clone detection) |
| Resemblyzer | Latest | Speaker verification (voice embeddings) |
| librosa / soundfile | Latest | Audio processing |
| google-genai | Latest | Gemini API client |
| sentencepiece | Latest | Tokenization |

### Databases & Storage
| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Primary relational database |
| Redis | 7 | Caching, sessions, pub/sub |
| SeaweedFS | 3.71 | S3-compatible object storage |
| MinIO | Latest | Object storage (dev/test environments) |
| pgvector | Latest | Vector similarity search (CIPAS Phase 2) |

### Message Queue
| Technology | Version | Purpose |
|-----------|---------|---------|
| RabbitMQ | 3.13 / 4.2 | Async event bus |
| Dead Letter Exchanges | — | Failed message handling |

### API Gateway
| Technology | Version | Purpose |
|-----------|---------|---------|
| Kong | 3.4 / 3.9.1 | API Gateway |
| decK | Latest | Declarative Kong config management |

### DevOps & CI/CD
| Technology | Version | Purpose |
|-----------|---------|---------|
| GitHub Actions | — | CI/CD automation |
| Docker | Latest | Container runtime |
| Podman | Latest | Alternative container runtime |
| Docker Compose | Latest | Multi-container orchestration |
| Docker Buildx | Latest | Multi-platform image builds |
| GHCR | — | Container registry |
| SonarQube Cloud | — | Code quality analysis (disabled) |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Hetzner VPS | Production hosting |
| Docker / Podman | Container runtime |
| Docker Compose | Service orchestration |
| SSL/TLS | Kong gateway encryption |
| HashiCorp Vault | Production secrets management |

### AI/ML & External APIs
| Technology | Purpose | Used By |
|-----------|---------|---------|
| OpenRouter (Qwen3) | LLM reasoning for code grading | ACAFS, CIPAS-XAI |
| Gemini API | Structured grading output | ACAFS |
| Gemini Live API | Real-time voice AI for oral exams | IVAS |
| Gemini (Text) | Behavioral analysis | Keystroke Service |
| Judge0 CE | Code execution & test-case scoring | ACAFS, Assessment |
| UniXcoder | AI-generated code detection | CIPAS-AI |
| GraphCodeBERT | Semantic code clone detection | CIPAS-Semantics |
| XGBoost | Syntactic clone classification | CIPAS-Syntactics |
| NiCAD (CST) | Type-1/2 clone detection | CIPAS-Syntactics |
| TypeNet (LSTM) | Keystroke dynamics | Keystroke Service |
| Resemblyzer | Speaker verification | IVAS |
| SMTP | Email delivery | Email Service |

### Build Tooling & Package Management
| Technology | Version | Purpose |
|-----------|---------|---------|
| Bun | 1.136.0 | Package manager & runtime |
| Turborepo | 2.x | Monorepo orchestration |
| Turbo | Latest | Task running & caching |
| Poetry | Latest | Python dependency management |
| Go modules | 1.25 | Go dependency management |
| ESLint | 9.x | JavaScript/TypeScript linting |
| Ruff | Latest | Python linter & formatter |
| golangci-lint | 1.62 | Go linter |
| golang-migrate | Latest | Database migrations |
| Air | Latest | Go live-reload (development) |

### Monitoring & Observability
| Technology | Purpose |
|-----------|---------|
| Structured JSON logging | All services (slog / structlog / zap) |
| Trace ID propagation | Cross-service distributed tracing |
| Health check endpoints | All services (Kong integration) |
| SonarQube | Code quality (planned) |

---

## Technology Responsibility Mapping

| Concern | Technology | Justification |
|---------|-----------|---------------|
| API Gateway | Kong | Battle-tested, declarative config, JWT + rate-limit plugins |
| Frontend | Next.js | SSR/SSG, App Router, Vercel deployment, large ecosystem |
| Backend (CRUD) | Go + Fiber | High performance, low latency, strong typing, fast compilation |
| Backend (ML) | Python + FastAPI | ML ecosystem (PyTorch, Transformers), async-native |
| State Management | Zustand | Lightweight, TypeScript-native, minimal boilerplate |
| Database | PostgreSQL | Mature, reliable, pgvector for ML embeddings |
| Message Queue | RabbitMQ | Durable, AMQP standard, DLX support |
| Object Storage | SeaweedFS | S3-compatible, scalable, lightweight |
| Containerization | Docker | Industry standard, multi-stage builds, wide tooling support |
| CI/CD | GitHub Actions | Native GitHub integration, matrix builds, ecosystem |
