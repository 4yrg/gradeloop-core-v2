# Phase 6 — Testing Strategy Analysis

## Current Testing Landscape

### Test Presence by Language

| Language | Test Files | Lines of Test Code | Frameworks Used |
|----------|-----------|-------------------|-----------------|
| **Go** | 6 | ~2,250 | `testing` (stdlib), testify, httptest, gorm SQLite |
| **Python** | 0 | 0 | None configured |
| **TypeScript** | 0 | 0 | None configured |

---

## Go Testing (Existing)

### Test Distribution

| Service/Package | Test File | Lines | Focus |
|----------------|-----------|-------|-------|
| `packages/go/secrets` | `client_test.go` | 431 | Config parsing, connection strings, HTTP mocking |
| `iam/internal/client` | `email_client_test.go` | 212 | Email API client (httptest mocks) |
| `email/internal/service` | `email_service_test.go` | 151 | Email service (testify mocks) |
| `academic/internal/service` | `faculty_service_test.go` | 656 | Faculty CRUD service (in-memory SQLite) |
| `academic/internal/repository` | `faculty_repository_test.go` | 479 | Faculty repository (in-memory SQLite) |
| `academic/internal/handler` | `faculty_handler_test.go` | 321 | Faculty HTTP handlers (Fiber app.Test) |

### Testing Patterns (Go)
- **Repository layer**: In-memory SQLite via GORM's SQLite driver for database-agnostic testing
- **Service layer**: Mock repositories via testify `mock.Mock` for service logic verification
- **Handler layer**: Fiber's built-in `app.Test()` for HTTP integration testing with mock services
- **Client layer**: `httptest.NewServer` for external HTTP service mocking
- **Standard library**: `testing` package with `t.Skip` for integration tests requiring external dependencies

---

## API Testing (Bruno Collection)

- **Tool**: Bruno (open-source API client)
- **Total requests**: ~130+ `.bru` files
- **Services covered**: IAM, Academic, Assessment, Email, ACAFS, CIPAS (syntactics, semantics, AI)
- **Environments**: Local (`development.bru`), Production (`production.bru`)
- **Test types**: CRUD operations, authentication flows, edge cases (invalid credentials, expired tokens, unauthorized access)
- **Status**: Manual/exploratory only — not automated in CI

---

## CI Test Execution

**All 5 CI/CD workflows are currently missing test execution:**

| Workflow | Runs Tests? | Quality Checks |
|----------|------------|----------------|
| `lint.yml` | No | golangci-lint, ruff, ESLint |
| `development.yml` | No | gofmt, go vet, go mod tidy, bun lint+typecheck, ruff |
| `production.yml` | No | Same as development.yml |
| `sonarqube.yml` | Disabled | Would analyze coverage reports |
| `infra-deploy.yml` | No | Infrastructure management only |

---

## Coverage Tooling

- **SonarQube**: Configured in `sonar-project.properties` (Go: `**/coverage.out`, Python: `**/coverage.xml`) but workflow is **disabled** (`if: false`)
- **Turborepo**: Test task configured with `outputs: ["coverage/**", "*.xml"]` but no test runners are wired
- **No coverage reports** are currently generated in any CI pipeline

---

## Testing Gaps

1. **Python services (6)**: No test files, no pytest configuration, no test dependencies in any `pyproject.toml`
2. **TypeScript/JavaScript**: No test runner configured in `apps/web` or any TS package — no vitest, jest, or mocha
3. **CI integration**: No `go test ./...`, `pytest`, or `vitest` executed in any workflow
4. **Coverage reporting**: Infrastructure exists (SonarQube, Turborepo outputs) but not active
5. **API testing**: Bruno collection is comprehensive but manual; not integrated into CI

---

## Development Testing Dependencies

- **Go**: `github.com/stretchr/testify` v1.11.1 (present in academic, email, and other Go services)
- **Python dev dependencies**: Only formatting/linting tools (`black`, `ruff`, `mypy`, `isort`)
- **TypeScript**: Vitest is listed in `apps/web` devDependencies, and a single test file exists at `components/__tests__/viva-session.test.tsx`, but no test script is configured in `package.json`

---

## Quality Assurance Summary

| QA Practice | Status | Evidence |
|------------|--------|----------|
| Go unit tests | ✅ Present | 6 test files, ~2,250 lines |
| Python tests | ❌ Absent | No test files or frameworks |
| TypeScript tests | ❌ Absent | No test runners configured |
| API integration tests | ⚠️ Manual | Bruno collection (130+ requests) |
| CI test execution | ❌ Not implemented | No test runner in any workflow |
| Coverage reporting | ❌ Disabled | SonarQube workflow gated with `if: false` |
| Linting (Go) | ✅ CI-integrated | golangci-lint, gofmt, go vet |
| Linting (Python) | ✅ CI-integrated | ruff check + format |
| Linting (TS) | ✅ CI-integrated | ESLint, TypeScript type-check |
