# GradeLoop V2 — Documentation Index

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue?logo=githubactions)](https://github.com/gradeloop/gradeloop-core-v2/actions)
[![Coverage](https://img.shields.io/codecov/c/github/gradeloop/gradeloop-core-v2/main.svg)](https://codecov.io/gh/gradeloop/gradeloop-core-v2)
[![Go Report Card](https://goreportcard.com/badge/github.com/gradeloop/gradeloop-core-v2)](https://goreportcard.com/report/github.com/gradeloop/gradeloop-core-v2)
[![Docs](https://img.shields.io/badge/docs-up%20to%20date-brightgreen.svg)](docs/README.md)

This repository is the single source of truth for GradeLoop V2. The detailed, actionable developer and operator documentation lives in the `docs/` directory and per-service READMEs. This top-level file is an index pointing you to those resources — it intentionally does not duplicate documentation content.

Use the links below to find what you need.

Quick links
- Local development & setup: [docs/local-dev-guide.md](docs/local-dev-guide.md)
- Documentation index: [docs/README.md](docs/README.md)
- Contribution & PR guidelines: [CONTRIBUTING.md](CONTRIBUTING.md)
- Service communication patterns (gRPC/REST/events): [docs/service-communication.md](docs/service-communication.md)
- Observability, metrics, logs, and tracing: [docs/observability.md](docs/observability.md)
- Architecture Decision Records (ADRs): [docs/adr/README.md](docs/adr/README.md) (individual ADRs under `docs/adr/`)
- API docs placeholder: [docs/api/](docs/api/)
- Per-service READMEs: `apps/services/<service-name>/README.md` (e.g. [apps/services/assignment-service/](apps/services/assignment-service/))
- Infrastructure and local compose: [infra/compose/docker-compose.yml](infra/compose/docker-compose.yml)
- Dev scripts: [scripts/](scripts/)
- Ops & observability configs: [ops/](ops/)

If you're getting started, open [docs/README.md](docs/README.md) first — it contains a curated path for common tasks (setup, running the stack, testing, debugging). For anything not covered, check the service README under `apps/services/<service>` or open an issue / ask in `#gradeloop-dev`.

Contributing
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for commit messages, branch naming, PR structure, and testing requirements.
- Add ADRs to `docs/adr/` for significant architectural changes.

Where to run things
- Local full-stack: See [infra/compose/docker-compose.yml](infra/compose/docker-compose.yml) and [docs/local-dev-guide.md](docs/local-dev-guide.md).
- Run a single service: see that service's README in `apps/services/<service-name>/README.md`.

Support
- For help or questions, contact the engineering team (`#gradeloop-dev`) or open an issue in the repo.
- If you want me to expand any guide or add new documentation pages, tell me which topic and I’ll draft it.

Thank you for contributing to GradeLoop V2.