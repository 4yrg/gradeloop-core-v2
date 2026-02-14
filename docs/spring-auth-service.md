# GradeLoop IAM Authentication Service

## Overview
A Spring Boot 4 microservice for authentication and authorization, using PostgreSQL (Aiven), Redis, JWT, and Vault/env for secrets. Implements login, refresh, activation, and forgot-password flows with audit logging and rate-limiting.

## Features
- Spring Boot 4, Java 21, Spring Security 6
- PostgreSQL (Aiven, SSL required)
- Redis + Bucket4j for rate-limiting (fallback to in-memory)
- JWT (HS256, secret from Vault/env)
- JPA/Hibernate, HikariCP
- Micrometer metrics, structured JSON logging
- Audit logs, soft deletes, super admin bootstrap

## Endpoints
- `POST /api/v1/auth/login` — Login, returns JWT and refresh token
- `POST /api/v1/auth/refresh` — Refresh JWT
- `POST /api/v1/auth/activate` — Activate account (time-limited JWT)
- `POST /api/v1/auth/forgot-password` — Send reset link (stub)

## Local Development

1. Copy `.env.example` to `.env` and fill secrets
2. Start services:
   ```bash
   docker compose up --build
   ```
3. Service runs at http://localhost:8080

## Environment Variables
See `.env.example` for required variables.

## Database
- Connects to Aiven PostgreSQL with SSL (`sslmode=require`)
- Schema matches Go IAM models (User, RefreshToken, AuditLog)

## Security
- JWT signed with HS256, 15m expiry
- Refresh tokens (UUID, 30d)
- BCrypt (strength=12) for passwords
- Rate limit: 5 attempts/15min per IP+email
- Audit logs for all auth mutations

## Observability
- Micrometer metrics at `/actuator/prometheus`
- Structured JSON logs (Logback)

## Production
- Use `application-prod.yml` and real secrets
- Vault integration recommended for secrets

## References
- See `CONTRIBUTING.md` for commit and code standards
- See `LLMs.txt` for web client integration patterns
