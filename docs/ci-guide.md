# CI Guide — Pre-Configured Quality Gates

This document explains the repository's CI quality-gate workflow, how to interpret results, run checks locally, and how to onboard new services or languages.

Location
- Workflow: `.github/workflows/ci.yml`
- This guide: `docs/ci-guide.md`

Overview
- The CI workflow runs on every `pull_request` targeting `main`.
- It performs:
  - Language-specific linting and style checks (Go, Python).
  - Unit tests with coverage reporting and enforcement (≥ 80% threshold).
  - Docker image builds for services that include a `Dockerfile`.
- If the CI job fails, a human-friendly summary is posted as a PR comment and full logs are uploaded as workflow artifacts (retained for 30 days).
- The CI is optimized for monorepo layout: it detects changed services and libraries and only runs checks for affected targets to keep runtime low.

Design goals & constraints
- Fast feedback: typical PRs should finish within ~5 minutes for changed units.
- Fail fast: lint errors and failing tests cause the job to fail early.
- Machine-readable logs and a concise human summary are produced for reviewers.
- Security: workflow contains no hard-coded secrets and uses least-privilege permission scopes for the runner.

What the CI runs (per acceptance criteria)
- For changed Go targets (services or `shared/libs/go`):
  - `gofmt` (format check)
  - `golint` (style/lint)
  - `go test ./... -coverprofile=coverage.out` and coverage check (threshold 80%)
- For changed Python targets (services or `shared/libs/py`):
  - `ruff check` (lint)
  - `black --check` (format)
  - `pytest --cov` with `--cov-report=xml` and coverage check (threshold 80%)
- For changed services with Dockerfiles:
  - `docker build` is attempted to ensure images build successfully.

How the workflow detects what to run
- The workflow inspects the diff between the PR head and the base (`main`) to determine:
  - Changed Go files => run Go lint & tests for the containing service or `shared/libs/go`.
  - Changed Python files => run Python lint & tests for the containing service or `shared/libs/py`.
  - Changed Dockerfiles or presence of a Dockerfile in a changed service => run `docker build`.
  - Doc-only / YAML-only changes => skip code lint/tests, but run YAML validation.

Running the checks locally
- Reproduce (Go)
  - Run formatting check:
    - `gofmt -l ./path/to/service`
  - Run lint:
    - `golint ./path/to/service` (install: `go install golang.org/x/lint/golint@latest`)
  - Run tests & coverage:
    - `go test ./... -coverprofile=coverage.out`
    - `go tool cover -func=coverage.out` to inspect results
- Reproduce (Python)
  - Install tools in a venv:
    - `python -m venv .venv && source .venv/bin/activate`
    - `pip install ruff black pytest pytest-cov`
  - Lint and format checks:
    - `ruff check path/to/service`
    - `black --check path/to/service`
  - Tests & coverage:
    - `pytest --maxfail=1 --disable-warnings --cov=. --cov-report=xml`
    - Inspect `coverage.xml` or use `coverage` CLI to see percentage
- Reproduce Docker build:
  - `docker build -t local/test:pr -f path/to/service/Dockerfile path/to/service`

Interpreting CI results
- PR checks summary: GitHub shows job success/failure per job.
- On failure:
  - The workflow posts a PR comment containing `ci_summary.txt` (human readable).
  - Full logs are attached as workflow artifacts named `ci-logs-pr-<PR_NUMBER>`.
- Lint errors:
  - The summary lists offending files and messages; CI also emits GitHub annotation errors to surface the issue inline when possible.
- Coverage failures:
  - The summary contains the percentage and indicates if it failed the 80% threshold.

Adding a new service
- Standard layout: `apps/services/<service-name>/...`
- Language detection:
  - Go service: has `.go` files (or `go.mod`) under the service directory.
  - Python service: has `.py` files, `requirements.txt` or `pyproject.toml`.
- Include a `Dockerfile` at `apps/services/<service-name>/Dockerfile` (or `apps/services/<service-name>/docker/Dockerfile`) if the service is containerized.
- No workflow edits required for properly structured services. The workflow auto-detects changed files.

Extending CI to a new language (e.g., TypeScript)
- The workflow intentionally fails for unknown languages to prevent silent gaps.
- To add support:
  - Update `.github/workflows/ci.yml` to include path patterns and jobs for the new language.
  - Add linter / formatter / test / coverage commands with a coverage threshold if applicable.
  - Document the new language steps in this guide.

Common troubleshooting & guidance
- Flaky tests:
  - Retry the failed workflow run once (GitHub UI -> Re-run jobs).
  - Add deterministic test fixes (mock network/time, avoid shared state).
  - For intermittent failures, add a short retry wrapper in tests or mark tests as flaky with guidance in test comments.
- Long-running test suites:
  - Break tests into smaller units and ensure only affected tests execute for the changed service.
- Large PRs:
  - Consider splitting into smaller PRs to keep CI run times under the target.
- Secrets:
  - Do NOT add secrets in workflow YAML. Use GitHub Actions secrets and reference them via `${{ secrets.YOUR_SECRET }}` (not needed for current jobs).
- Logs & retention:
  - Artifacts are retained for 30 days by the workflow; download them from the run if needed.

Developer ergonomics
- For local parity, use the same versions of tools as specified in the workflow (`go 1.20`, `python 3.11`).
- Use a local runner like `act` or run the same commands locally to debug failures before pushing changes.

Best practices
- Keep unit tests fast and deterministic.
- Add or update unit tests and coverage when adding features to keep coverage above threshold.
- Fix formatting and lint issues immediately to avoid noisy comments in PRs.

If something is missing or broken
- If CI behavior seems incorrect (e.g., it did not detect changed services correctly), open an issue and include:
  - PR number / workflow run URL
  - A copy of the `ci_summary.txt` from artifacts
  - Short reproduction steps

Quick reference — key commands
- Go:
  - `gofmt -l ./...`
  - `golint ./...`
  - `go test ./... -coverprofile=coverage.out`
- Python:
  - `ruff check .`
  - `black --check .`
  - `pytest --cov=. --cov-report=xml`

Contact / ownership
- CI workflow and docs maintained under `ops/` and `.github/workflows/`.
- For changes affecting detection rules or global thresholds, create a PR and tag the CI owners / reviewers as defined in the repository's CODEOWNERS.

Change log
- Initial guide for the CI Quality Gate workflow (matches `.github/workflows/ci.yml`).