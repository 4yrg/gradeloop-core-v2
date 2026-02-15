# Contributing to GradeLoop V2

Thank you for your interest in contributing to GradeLoop V2! This document provides guidelines and best practices for contributing to our monorepo. It also includes new Infrastructure / Traefik Gateway guidance so you can add microservices behind a single API gateway in a consistent, secure, and testable way.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Infrastructure / Traefik Gateway](#infrastructure--traefik-gateway)
- [Getting Help](#getting-help)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Be respectful and constructive.
- Focus on the best outcome for the project.
- Give helpful, actionable feedback.

### Unacceptable Behavior

- Harassment, discrimination, or abusive language.
- Publishing private information or doxxing.
- Any behavior that makes the project unsafe for others.

---

## Getting Started

### Prerequisites

Make sure you have:

- Docker & Docker Compose
- Go (version as required by `go.mod` in service folders)
- Node.js / Bun (for frontend work)
- Git

### Initial Setup (common flow)

```bash
git clone <your-fork-url>
cd gradeloop-core-v2
# Follow service-specific README files for local environment setup
```

---

## Development Workflow

1. Pick an Issue
2. Create a branch using the naming convention `feature/`, `fix/`, `chore/`, etc.
3. Make changes, run tests, and add documentation as needed
4. Commit with a clear message (see Commit Guidelines)
5. Push and create a Pull Request (PR)
6. Address feedback and get approvals

---

## Coding Standards

- Go: follow `gofmt`, `goimports`, idiomatic Go and dependency injection for testability.
- Frontend (Next.js + Bun): strictly typed, Zod validation, TanStack Query, Tailwind v4.
- Python: follow PEP 8.
- Keep code simple, well-tested and documented.

---

## Commit Guidelines

We follow Conventional Commits. Examples:

- `feat(auth): add login endpoint [GRADLOOP-123]`
- `fix(gateway): correct Traefik rule for auth [GRADLOOP-234]`
- `infra: add traefik gateway and compose [GRADLOOP-345]`

For infrastructure changes, use `infra:` as the type and include verification steps in the PR description.

---

## Pull Request Process

- Include a description, related issues, type of change, testing steps, and deployment notes.
- Automated checks (linting, tests) must pass before merging.
- At least two reviewers, including a service owner, should approve.

---

## Testing Requirements

- Aim for 80% coverage across services.
- Add unit and integration tests.
- Provide reproduction steps for E2E tests in the PR description.

---

## Documentation

- Keep README files in each service up-to-date.
- Document new infra and deployment procedures in both `CONTRIBUTING.md` and the relevant service README.
- Document environment variables and required secrets in service README (do not commit secrets).

---

## Infrastructure / Traefik Gateway

This repository uses an API Gateway pattern for local/dev via Traefik (v3.x). The intent is to make microservices plug-and-play: services attach to a shared Docker network and opt-in to Traefik routing using container labels. Below are the guidelines and an example you should follow.

Key goals:
- Centralized routing and middleware handling (strip prefix, rate-limit, TLS).
- Services are not exposed directly to the host (no published `ports:`), only via Traefik.
- Safe defaults: `exposedByDefault=false` so services must explicitly opt-in.

Important notes before you change infra:
- The existing Auth service lives at `apps/services/auth-service` and listens internally on port `3000`. Ensure any compose or build references match that.
- Traefik is configured to use the Docker socket (`/var/run/docker.sock`) for service discovery.
- A dedicated Docker network called `gateway_network` is used for Traefik <> services communication.

Recommended Compose structure and example
- Keep Traefik and gateway-related compose manifests in a predictable location (for example `infra/compose/` or repo root).
- Use an image for quick plug-and-play (e.g., `my-registry/auth-service:latest`) or a `build:` block that points to the service folder when you want to build locally.

A minimal excerpt (example) demonstrating labels and the network is included in the repository at:
```gradeloop-core-v2/compose.yaml#L1-200
# Example excerpt in compose.yaml (use the repo file as authoritative)
services:
  traefik:
    image: traefik:v3.0
    command:
      - --entryPoints.web.address=:80
      - --entryPoints.traefik.address=:8080
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --api.dashboard=true
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - gateway_network

  auth-service:
    image: my-registry/auth-service:latest
    networks:
      - gateway_network
    labels:
      "traefik.enable": "true"
      "traefik.http.routers.auth-router.rule": "Host(`localhost`) && PathPrefix(`/api/auth`)"
      "traefik.http.routers.auth-router.entrypoints": "web"
      "traefik.http.routers.auth-router.middlewares": "auth-stripprefix@docker,auth-ratelimit@docker"
      "traefik.http.services.auth-service.loadbalancer.server.port": "3000"
      "traefik.http.middlewares.auth-stripprefix.stripprefix.prefixes": "/api/auth"
      "traefik.http.middlewares.auth-ratelimit.ratelimit.average": "10"
      "traefik.http.middlewares.auth-ratelimit.ratelimit.burst": "0"
networks:
  gateway_network:
    name: gateway_network
    driver: bridge
```

Labels and their meaning
- `traefik.enable=true` — opt-in for Traefik when `exposedByDefault=false`.
- `traefik.http.routers.<name>.rule` — a rule to select requests routed to this service (Host, PathPrefix, etc.).
- `traefik.http.routers.<name>.entrypoints` — which Traefik entrypoint(s) (e.g., `web`, `traefik`).
- `traefik.http.routers.<name>.middlewares` — inject middleware chain (strip prefix, rate limiting).
- `traefik.http.services.<name>.loadbalancer.server.port` — internal container port to forward to (e.g., `3000`).
- `traefik.http.middlewares.<name>.stripprefix.prefixes` — prefixes to remove before forwarding, useful for a unified API prefix like `/api/auth`.
- `traefik.http.middlewares.<name>.ratelimit.*` — rate limiting settings to mitigate abuse (e.g., brute-force attempts).

Auth service specifics (must follow these)
- Internal port: `3000`
- Desired external path: `http://localhost/api/auth/*` mapped to the service
- Use a `stripprefix` middleware that removes `/api/auth` before forwarding; this keeps your service routes unchanged (e.g., `/login`).
- Apply a `ratelimit` middleware to auth endpoints (recommended: average=10 req/s, tune burst as required).

Future Service Template (copy/paste)
- When you add a new service, use the same pattern: attach to `gateway_network`, do NOT publish host ports, add Traefik labels.

Template (copy/paste — adapt to your service):
```gradeloop-core-v2/compose.yaml#L200-330
# Future service template (commented)
# my-service:
#   image: my-registry/my-service:latest
#   container_name: my-service
#   restart: unless-stopped
#   networks:
#     - gateway_network
#   labels:
#     "traefik.enable": "true"
#     "traefik.http.routers.myservice-router.rule": "Host(`localhost`) && PathPrefix(`/api/myservice`)"
#     "traefik.http.routers.myservice-router.entrypoints": "web"
#     "traefik.http.routers.myservice-router.middlewares": "myservice-stripprefix@docker,myservice-ratelimit@docker"
#     "traefik.http.middlewares.myservice-stripprefix.stripprefix.prefixes": "/api/myservice"
#     "traefik.http.middlewares.myservice-ratelimit.ratelimit.average": "10"
#     "traefik.http.middlewares.myservice-ratelimit.ratelimit.burst": "0"
#     "traefik.http.services.myservice.loadbalancer.server.port": "3001"
```

Verification / Quick checks
- Start stack:
  - `docker compose -f compose.yaml up -d`
- Check Traefik dashboard:
  - `http://localhost:8080` (for local/dev only; secure it in production)
- Test routing (examples):
  - Health: `curl -i http://localhost/api/auth/health` (service should return health)
  - Login (example):  
    `curl -i -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"username":"u","password":"p"}'`  
    (Traefik will forward as `/login` due to `stripprefix`.)
- Test rate limiting:
  - Run a burst of requests and observe HTTP 429 responses if the rate limit triggers.

Security & production notes
- Do not expose the Traefik dashboard publicly. For production, secure with authentication, IP allowlist, or remove direct host mapping.
- Use TLS in production. Configure cert resolvers and enable `tls` on routers.
- Inject secrets via a secret manager or environment variables at runtime — never commit secrets to the repo.
- Tune rate limits and other security middlewares per service sensitivity (auth endpoints typically require stricter limits).

Commit & PR guidance for infra changes
- Prefix commits with `infra:` (example `infra: add traefik gateway and auth routing [GRADLOOP-345]`).
- Include a short verification checklist in the PR (start commands, curl checks).
- Attach the `compose.yaml` or changes to infra folder in your PR. If you add network or label conventions, document them in the PR description and update this `CONTRIBUTING.md` as needed.

How this avoids conflicts with `auth-service`
- The gateway pattern keeps services internal to the Docker network — no host port collisions.
- The `auth-service` in `apps/services/auth-service` documents an internal listening port of `3000`. Make sure any compose/service label uses that same port.
- If you prefer building locally rather than pulling an image, use a `build:` entry that points to `./apps/services/auth-service` and ensure it exposes the same internal port (no host `ports:` mapping).

Operational suggestions
- Keep the `exposedByDefault=false` provider setting. This prevents accidental exposure of containers.
- Name Docker networks explicitly (`gateway_network`) to avoid colliding with other networks.
- Keep middleware names consistent (e.g., `<svc>-stripprefix`, `<svc>-ratelimit`) to make debugging and automation easier.

If you need me to:
- Add a ready-to-run `infra/compose/docker-compose.yaml` file within the repo,
- Add a small `infra/traefik/` folder with a static/dynamic Traefik config,
- Or generate a PR template snippet for infra changes,

Tell me which one and I will prepare the files and sample PR description.

---

## Getting Help

- Check each service README first (e.g., `apps/services/auth-service/README.md`).
- Ask in `#gradeloop-dev` or open an issue/PR with detailed reproduction steps.
- Include logs, `docker compose` status, and `curl -v` output for routing issues.

---

Thank you for contributing to GradeLoop V2! Your infrastructure changes help keep our platform modular, secure, and easy for developers to extend.