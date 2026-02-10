# GradeLoop V2 Documentation

> **Comprehensive documentation for developers, architects, and operators**

---

## 🚀 Quick Start

New to GradeLoop V2? Start here:

1. **[README](../README.md)** - Repository overview and service catalog
2. **[Local Development Guide](local-dev-guide.md)** - Complete setup instructions
3. **[Contributing Guidelines](../CONTRIBUTING.md)** - How to contribute to the project

---

## 📚 Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [Local Development Guide](local-dev-guide.md) | Setup, debugging, and development workflow |
| [Contributing Guidelines](../CONTRIBUTING.md) | Code standards, commit guidelines, PR process |
| [Service Catalog](../README.md#-service-catalog) | Complete list of all microservices |

### Architecture & Design

| Document | Description |
|----------|-------------|
| [Architecture Decision Records](adr/README.md) | Index of all ADRs |
| [ADR-001: Monorepo Structure](adr/001-monorepo-structure.md) | Why we chose monorepo architecture |
| [Service Communication Patterns](service-communication.md) | gRPC, REST, and async messaging guidelines |
| [Database Migrations](migrations.md) | Schema management and versioning _(Coming Soon)_ |

### Operations & Observability

| Document | Description |
|----------|-------------|
| [Observability Setup](observability.md) | Metrics, logging, and tracing with Prometheus/Grafana/Jaeger |
| [Deployment Guide](deployment.md) | Production deployment procedures _(Coming Soon)_ |
| [Runbooks](runbooks/README.md) | Operational procedures and troubleshooting _(Coming Soon)_ |

### API Documentation

| Document | Description |
|----------|-------------|
| [API Overview](api/README.md) | REST and gRPC API documentation _(Coming Soon)_ |
| [Gateway API](api/gateway.md) | API Gateway endpoints _(Coming Soon)_ |
| [Academics Service](api/academics-service.md) | Course and enrollment management _(Coming Soon)_ |
| [Assignment Service](api/assignment-service.md) | Assignment and submission APIs _(Coming Soon)_ |

### Service-Specific Documentation

Each service has its own README in its directory:

- [Academics Service](../apps/services/academics-service/README.md)
- [Assignment Service](../apps/services/assignment-service/README.md)
- [CIPAS Service](../apps/services/cipas-service/README.md) - Plagiarism Analysis
- [IVAS Service](../apps/services/ivas-service/README.md) - Video Analysis
- [ACAFS Service](../apps/services/acafs-service/README.md) - Academic Fairness
- [BLAIM Service](../apps/services/blaim-service/README.md) - Blockchain Audit
- [Email Notify Service](../apps/services/email-notify-service/README.md)

---

## 🛠️ Common Tasks

### Development

- **[Running Services Locally](local-dev-guide.md#running-individual-services)**
- **[Database Migrations](local-dev-guide.md#database-management)**
- **[Testing](local-dev-guide.md#testing-locally)**
- **[Debugging](local-dev-guide.md#debugging)**

### Adding New Features

- **[Adding a New Service](../README.md#-adding-a-new-service)**
- **[Creating an ADR](adr/README.md#creating-a-new-adr)**
- **[Writing Tests](../CONTRIBUTING.md#testing-requirements)**
- **[API Design Guidelines](service-communication.md#rest-api-guidelines)**

### Operations

- **[Monitoring Dashboards](observability.md#visualization-grafana)**
- **[Viewing Logs](observability.md#logging-loki)**
- **[Tracing Requests](observability.md#tracing-jaeger)**
- **[Setting Up Alerts](observability.md#alerting)**

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────┐
│  SvelteKit Web  │
└──────┬──────────┘
       │ HTTP/REST
       ▼
┌─────────────────┐
│   API Gateway   │
│   (Go + Auth)   │
└──────┬──────────┘
       │ gRPC
       ▼
┌──────────────────────────────────────────┐
│          Microservices Layer             │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │Academics │  │Assignment│  │  CIPAS │  │
│  │ Service  │  │ Service  │  │ (AI)   │  │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │             │            │       │
|       |             |            |       |
│  ┌────────────────────────────────────┐  │
│  │         PostgreSQL Databases       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│     Observability Stack (ops/)           │
│  Prometheus | Grafana | Loki | Jaeger    │
└──────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

### Monorepo Structure

GradeLoop V2 uses a monorepo to maintain all services, libraries, and infrastructure in a single repository. This enables:

- **Atomic changes** across multiple services
- **Shared tooling** and consistent standards
- **Simplified dependency management**
- **Easier code reuse**

Read more: [ADR-001: Monorepo Structure](adr/001-monorepo-structure.md)

### Service-to-Service Communication

- **Synchronous**: gRPC for low-latency, type-safe communication
- **Asynchronous**: NATS for event-driven workflows
- **External**: REST APIs for browser clients

Read more: [Service Communication Patterns](service-communication.md)

### Observability

The **three pillars of observability**:

1. **Metrics** (Prometheus) - What is happening?
2. **Logs** (Loki) - Why is it happening?
3. **Traces** (Jaeger) - Where is it happening?

Read more: [Observability Setup](observability.md)

---

## 📖 Conventions

### Naming

- **Directories**: `lowercase-with-hyphens`
- **Services**: `service-name-service` (e.g., `assignment-service`)
- **Files**: Language-specific conventions (Go: `snake_case.go`, Python: `snake_case.py`)

### Versioning

- **API Versions**: `/api/v1/`, `/api/v2/`
- **Proto Packages**: `package.v1`, `package.v2`
- **Database Migrations**: Sequential numbering (`000001_`, `000002_`)

### Git Workflow

- **Branches**: `feature/GRADLOOP-XXX-description`
- **Commits**: `type(scope): message [JIRA-XXX]`
- **PRs**: `[GRADLOOP-XXX] Brief description`

Read more: [Contributing Guidelines](../CONTRIBUTING.md)

---

## 🧪 Testing Strategy

### Test Pyramid

```
        ┌─────────┐
        │   E2E   │  (10%) - Full user workflows
        ├─────────┤
        │Integration (20%) - Service interactions
        ├─────────┤
        │  Unit    │  (70%) - Individual functions
        └─────────┘
```

### Coverage Requirements

- **Minimum**: 80% code coverage
- **Unit tests**: Required for all new code
- **Integration tests**: Required for API changes
- **E2E tests**: Required for critical user flows

Read more: [Testing Requirements](../CONTRIBUTING.md#testing-requirements)

---

## 🔒 Security

### Best Practices

- ❌ Never commit secrets or credentials
- ✅ Use environment variables for configuration
- ✅ Validate all user input
- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Implement rate limiting
- ✅ Enable audit logging for sensitive operations

### Secret Management

```bash
# Use .env files for local development
cp infra/env/.env.example .env

# Production secrets in Kubernetes Secrets or vault
# Never commit .env files
```

---

## 🆘 Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| Port already in use | `lsof -i :8080` and kill process |
| Database connection failed | Check if Postgres is running |
| Go module errors | Run `go mod tidy` and `go mod download` |
| Python import errors | Verify virtual environment is activated |
| Docker build fails | Try `docker system prune -a` |

Read more: [Local Development Guide - Troubleshooting](local-dev-guide.md#common-issues--troubleshooting)

---

## 📞 Support & Community

### Communication Channels

- **Slack**: `#gradeloop-dev` for general questions
- **Slack**: `#gradeloop-architecture` for design discussions
- **Slack**: `#gradeloop-alerts` for production alerts
- **Jira**: [GRADLOOP Project Board](https://yourorg.atlassian.net/browse/GRADLOOP)
- **Confluence**: [Team Wiki](https://yourorg.atlassian.net/wiki/spaces/GRADLOOP)

### Getting Help

1. **Search Documentation**: Check this docs folder first
2. **Search Slack**: Someone may have asked before
3. **Ask in Slack**: `#gradeloop-dev` channel
4. **Office Hours**: Tuesdays 2-3pm PT
5. **Create Jira Issue**: For bugs or feature requests

---

## 🎯 Roadmap

### Completed ✅

- [x] Monorepo structure
- [x] Core services (academics, assignments)
- [x] API Gateway with authentication
- [x] Observability stack (Prometheus, Grafana, Jaeger)
- [x] Local development environment

### In Progress 🚧

- [ ] AI/ML services (CIPAS, IVAS, ACAFS)
- [ ] Email notification service
- [ ] Frontend web application
- [ ] Comprehensive test coverage
- [ ] API documentation

### Planned 📋

- [ ] Kubernetes deployment
- [ ] CI/CD pipelines
- [ ] Performance testing
- [ ] Security audits
- [ ] Mobile application

---

## 📝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](../CONTRIBUTING.md) before submitting a pull request.

### Quick Checklist

Before submitting a PR:

- [ ] Code follows style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] PR description complete
- [ ] Jira ticket linked

---

## 📄 License

Proprietary - GradeLoop Inc. All rights reserved.

---

## 🙏 Acknowledgments

Built with ❤️ by the GradeLoop Engineering Team.

Special thanks to all contributors who have helped shape this platform.

---

**Last Updated**: January 2024  
**Maintained By**: GradeLoop Engineering Team

For questions or suggestions about this documentation, please contact the team in `#gradeloop-dev` or create a Jira ticket.