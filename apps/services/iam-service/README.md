# IAM Service

## Overview

The Identity and Access Management (IAM) Service is the central security authority of the GradeLoop platform. It manages user identities, authentication, authorization, and session management. It implements a Zero Trust Architecture by providing JWT validation at the edge and fine-grained role-based access control (RBAC) across all microservices. The service is built using the **Go Fiber (v2)** framework and requires **Go 1.25+**.

## Features

- **Authentication**: JWT-based authentication with Access and Refresh tokens.
- **Authorization**: Role-Based Access Control (RBAC) with hierarchical roles and permissions.
- **User Lifecycle**: Secure user registration, account activation, and profile management.
- **Security Protections**: Brute-force protection, Argon2id password hashing, and session revocation.
- **Audit Logging**: Comprehensive logging of all identity-related events.
- **Zero Trust Integration**: Seamless integration with the API Gateway for edge-level validation.

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  API Gateway    │    │   IAM Service   │    │    PostgreSQL   │
│  (Traefik)      │────┤   (Go / Fiber)  │────┤    (Storage)    │
│  ForwardAuth    │    │   Business Logic│    │    Identity Data│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                      │
                               │              ┌─────────────────┐
                               │              │      Redis      │
                               ├──────────────┤     (Cache)     │
                               │              │ Rate Limiting   │
                               │              └─────────────────┘
                               │
                       ┌─────────────────┐
                       │      Vault      │
                       │                 │
                       │ Secrets & Keys  │
                       └─────────────────┘
```

## Configuration

The service is configured via environment variables. Sensitive data like signing keys and database credentials should be stored in Vault.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `DB_URL` | PostgreSQL connection string | `postgres://gradeloop:gradeloop@postgres:5432/gradeloop_iam?sslmode=disable` |
| `REDIS_ADDR` | Redis address for rate limiting | `redis:6379` |
| `VAULT_ADDR` | Vault server address | `http://vault:8200` |
| `VAULT_TOKEN` | Vault root token | `dev-root-token` |
| `INITIAL_ADMIN_EMAIL` | Initial admin account for bootstrap | `admin@gradeloop.com` |
| `INITIAL_ADMIN_PASSWORD` | Initial admin password | `admin_dev_password_123` |

## API Endpoints

### Public Auth Endpoints
- `POST /api/v1/auth/login`: Authenticate and receive tokens.
- `POST /api/v1/auth/refresh`: Refresh an expired access token.
- `POST /api/v1/auth/activate`: Activate a new user account.

### Protected User Endpoints
- `GET /api/v1/users/me`: Get current user profile.
- `PATCH /api/v1/users/profile`: Update profile information.
- `GET /api/v1/admin/users`: List all users (Admin only).

## Development

### Prerequisites
- Go 1.25+
- Docker & Docker Compose
- Task (optional, for run task automated)

### Setup
1. **Clone the repo and navigate to the service:**
   ```bash
   cd apps/services/iam-service
   ```

2. **Run dependencies via Docker Compose:**
   ```bash
   docker compose -f ../../../infra/compose/compose.dev.yaml up -d postgres redis vault
   ```

3. **Run the service locally:**
   ```bash
   go run cmd/main.go
   ```

## Testing

### Unit Tests
```bash
go test ./internal/...
```

### Integration Tests
```bash
go test ./tests/...
```

## Security Standards

- **Passwords**: Hashed with Argon2id parameters optimized for security.
- **JWT**: Signed with RS256; keys rotated periodically via Vault.
- **Protection**: Middleware-based rate limiting and brute-force protection.

## Contributing

Please see the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) for general guidelines. Follow the established patterns for service architecture (Handlers, Services, Repositories).
