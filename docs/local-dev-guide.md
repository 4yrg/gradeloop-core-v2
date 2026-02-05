# Local Development Guide

> **Complete setup and debugging instructions for GradeLoop V2 development**

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Running the Full Stack](#running-the-full-stack)
- [Running Individual Services](#running-individual-services)
- [Database Management](#database-management)
- [Debugging](#debugging)
- [Hot Reload & Development Workflow](#hot-reload--development-workflow)
- [IDE Setup](#ide-setup)
- [Common Issues & Troubleshooting](#common-issues--troubleshooting)
- [Performance Optimization](#performance-optimization)

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| **Docker** | 24.0+ | [Get Docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2.x+ | Included with Docker Desktop |
| **Go** | 1.23+ | [Go Installation](https://go.dev/doc/install) |
| **Python** | 3.11+ | [Python Installation](https://www.python.org/downloads/) |
| **Node.js** | 20+ | [Node Installation](https://nodejs.org/) |
| **Make** | Any | Pre-installed on macOS/Linux, [Windows](https://gnuwin32.sourceforge.net/packages/make.htm) |
| **Git** | 2.40+ | [Git Installation](https://git-scm.com/downloads) |

### Optional but Recommended

- **Go Tools**: `golangci-lint`, `air` (hot reload)
- **Python Tools**: `poetry`, `black`, `ruff`
- **Database Tools**: `psql`, DBeaver, or TablePlus
- **API Testing**: Postman, Insomnia, or HTTPie
- **gRPC Testing**: grpcurl or BloomRPC

### System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Disk Space**: 20GB free space (for Docker images, dependencies, databases)
- **OS**: macOS, Linux, or Windows with WSL2

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/gradeloop/gradeloop-core-v2.git
cd gradeloop-core-v2
```

### 2. Environment Configuration

```bash
# Copy environment template
cp infra/env/.env.example .env

# Edit environment variables
vim .env  # or your preferred editor
```

**Required environment variables:**

```bash
# Database
POSTGRES_USER=gradeloop
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=gradeloop_dev

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=24h

# API Gateway
GATEWAY_PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Service Ports
ACADEMICS_SERVICE_PORT=8081
ASSIGNMENT_SERVICE_PORT=8082
EMAIL_SERVICE_PORT=8083

# Python Services
CIPAS_SERVICE_PORT=8085
IVAS_SERVICE_PORT=8086

# Redis
REDIS_URL=redis://localhost:6379

# Email Configuration (for local testing)
SMTP_HOST=localhost
SMTP_PORT=1025  # Use MailHog for local dev
SMTP_USER=
SMTP_PASSWORD=

# Observability
JAEGER_ENDPOINT=http://localhost:14268/api/traces
PROMETHEUS_PORT=9090
```

### 3. Install Dependencies

**Go Dependencies:**
```bash
# Install Go tools
go install github.com/cosmtrek/air@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Install dependencies for each service
cd apps/services/academics-service && go mod download && cd ../../..
cd apps/services/assignment-service && go mod download && cd ../../..
cd apps/gateway && go mod download && cd ../..
```

**Python Dependencies:**
```bash
# Install Poetry (recommended)
curl -sSL https://install.python-poetry.org | python3 -

# Or use pip
cd apps/services/cipas-service
pip install -r requirements.txt
cd ../../..
```

**Frontend Dependencies:**
```bash
cd apps/web
npm install
cd ../..
```

### 4. Pre-commit Hooks (Optional but Recommended)

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Test hooks
pre-commit run --all-files
```

---

## Running the Full Stack

### Quick Start (Docker Compose)

```bash
# Start all services
docker compose -f infra/compose/docker-compose.yml up

# Start in detached mode
docker compose -f infra/compose/docker-compose.yml up -d

# View logs
docker compose -f infra/compose/docker-compose.yml logs -f

# View logs for specific service
docker compose -f infra/compose/docker-compose.yml logs -f assignment-service
```

**Access points:**
- Frontend: http://localhost:5173
- API Gateway: http://localhost:8080
- Academics Service: http://localhost:8081
- Assignment Service: http://localhost:8082
- MailHog (Email Testing): http://localhost:8025

### Rebuild After Code Changes

```bash
# Rebuild all services
docker compose -f infra/compose/docker-compose.yml up --build

# Rebuild specific service
docker compose -f infra/compose/docker-compose.yml up --build assignment-service

# Force recreate containers
docker compose -f infra/compose/docker-compose.yml up --force-recreate
```

### Stop Services

```bash
# Stop all services
docker compose -f infra/compose/docker-compose.yml down

# Stop and remove volumes (clears databases)
docker compose -f infra/compose/docker-compose.yml down -v

# Stop specific service
docker compose -f infra/compose/docker-compose.yml stop assignment-service
```

---

## Running Individual Services

For faster iteration during development, run services outside Docker.

### Go Services

**Example: Assignment Service**

```bash
cd apps/services/assignment-service

# Install dependencies
go mod download

# Run with live reload (using air)
air

# Or run directly
go run cmd/server/main.go

# Run with environment variables
DATABASE_URL="postgres://user:pass@localhost:5432/gradeloop" \
go run cmd/server/main.go
```

**Example: API Gateway**

```bash
cd apps/gateway

# Run gateway
go run cmd/gateway/main.go
```

### Python Services

**Example: CIPAS Service (Plagiarism Detection)**

```bash
cd apps/services/cipas-service

# Using Poetry
poetry install
poetry run python src/main.py

# Using pip + venv
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/main.py

# With environment variables
CIPAS_PORT=8085 python src/main.py
```

### Frontend (SvelteKit)

```bash
cd apps/web

# Install dependencies
npm install

# Run dev server with hot reload
npm run dev

# Run on specific port
npm run dev -- --port 3000

# Build for production (test)
npm run build
npm run preview
```

---

## Database Management

### Access PostgreSQL

```bash
# Using Docker
docker compose -f infra/compose/docker-compose.yml exec postgres psql -U gradeloop -d gradeloop_dev

# Using local psql (if Postgres running on host)
psql -h localhost -U gradeloop -d gradeloop_dev
```

### Run Migrations

```bash
# Run all pending migrations
./scripts/migrate.sh up

# Rollback last migration
./scripts/migrate.sh down

# Create new migration
./scripts/migrate.sh create add_user_roles

# Check migration status
./scripts/migrate.sh status
```

### Seed Database

```bash
# Seed with test data
./scripts/seed.sh

# Seed specific dataset
./scripts/seed.sh users
./scripts/seed.sh courses
```

### Reset Database

```bash
# Drop and recreate all databases
./scripts/reset-db.sh

# Or manually with Docker Compose
docker compose -f infra/compose/docker-compose.yml down -v
docker compose -f infra/compose/docker-compose.yml up -d postgres
./scripts/migrate.sh up
./scripts/seed.sh
```

---

## Debugging

### Go Services

**Using Delve Debugger:**

```bash
cd apps/services/assignment-service

# Install delve
go install github.com/go-delve/delve/cmd/dlv@latest

# Start debugger
dlv debug cmd/server/main.go

# Or attach to running process
dlv attach $(pgrep assignment-service)
```

**VS Code Configuration:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Assignment Service",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/apps/services/assignment-service/cmd/server",
      "env": {
        "DATABASE_URL": "postgres://gradeloop:password@localhost:5432/gradeloop_dev"
      }
    }
  ]
}
```

### Python Services

**Using pdb:**

```python
# Add breakpoint in code
import pdb; pdb.set_trace()
```

**Using debugpy (VS Code):**

```bash
# Install debugpy
pip install debugpy

# Run with debugger
python -m debugpy --listen 5678 --wait-for-client src/main.py
```

**VS Code Configuration:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CIPAS Service",
      "type": "python",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 5678
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}/apps/services/cipas-service",
          "remoteRoot": "."
        }
      ]
    }
  ]
}
```

### Frontend Debugging

**Browser DevTools:**
- Open Chrome/Firefox DevTools (F12)
- Use Sources tab for breakpoints
- Console for logging

**VS Code Debugging:**

Install "Debugger for Chrome" extension, then:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/apps/web"
    }
  ]
}
```

### Debugging Docker Containers

```bash
# View container logs
docker logs -f assignment-service

# Execute commands in running container
docker exec -it assignment-service sh

# Inspect container
docker inspect assignment-service

# View resource usage
docker stats
```

---

## Hot Reload & Development Workflow

### Go - Using Air

Create `.air.toml` in service root:

```toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main ./cmd/server"
  bin = "tmp/main"
  include_ext = ["go", "tpl", "tmpl", "html"]
  exclude_dir = ["assets", "tmp", "vendor"]
  delay = 1000
```

Run: `air`

### Python - Using Watchdog

```bash
# Install watchdog
pip install watchdog[watchmedo]

# Run with auto-reload
watchmedo auto-restart --pattern="*.py" --recursive -- python src/main.py
```

### SvelteKit - Built-in HMR

```bash
npm run dev  # Hot Module Replacement enabled by default
```

### Docker Compose with Volume Mounts

For hot reload in Docker, mount source code as volumes:

```yaml
services:
  assignment-service:
    build: ./apps/services/assignment-service
    volumes:
      - ./apps/services/assignment-service:/app
    command: air  # Assuming air is installed in container
```

---

## IDE Setup

### Visual Studio Code

**Recommended Extensions:**

```json
{
  "recommendations": [
    "golang.go",
    "ms-python.python",
    "svelte.svelte-vscode",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

**Workspace Settings (`.vscode/settings.json`):**

```json
{
  "go.useLanguageServer": true,
  "go.lintTool": "golangci-lint",
  "go.formatTool": "goimports",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "files.exclude": {
    "**/.git": true,
    "**/__pycache__": true,
    "**/node_modules": true
  }
}
```

### GoLand / IntelliJ IDEA

1. **Import as Go Module**:
   - File → Open → Select `gradeloop-core-v2`
   
2. **Configure Go SDK**:
   - Preferences → Go → GOROOT → Select Go 1.23+

3. **Enable Go Modules**:
   - Preferences → Go → Go Modules → Enable integration

### PyCharm

1. **Configure Python Interpreter**:
   - Preferences → Project → Python Interpreter
   - Add Poetry environment or virtualenv

2. **Mark Directories**:
   - Right-click `apps/services/cipas-service/src` → Mark as Sources Root

---

## Common Issues & Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Kill process
kill -9 <PID>
```

### Database Connection Refused

```bash
# Check if Postgres is running
docker compose -f infra/compose/docker-compose.yml ps postgres

# Restart Postgres
docker compose -f infra/compose/docker-compose.yml restart postgres

# Check logs
docker compose -f infra/compose/docker-compose.yml logs postgres
```

### Go Module Issues

```bash
# Clear module cache
go clean -modcache

# Tidy dependencies
go mod tidy

# Download dependencies
go mod download
```

### Python Import Errors

```bash
# Reinstall dependencies
pip install --force-reinstall -r requirements.txt

# Clear pip cache
pip cache purge

# Verify Python path
python -c "import sys; print(sys.path)"
```

### Docker Build Failures

```bash
# Clear Docker cache
docker system prune -a

# Build without cache
docker compose -f infra/compose/docker-compose.yml build --no-cache

# Check disk space
docker system df
```

### Frontend Build Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear SvelteKit cache
rm -rf .svelte-kit
```

---

## Performance Optimization

### Docker Performance

**macOS/Windows:**
```bash
# Increase Docker Desktop resources
# Docker Desktop → Preferences → Resources
# - CPUs: 4+
# - Memory: 8GB+
# - Swap: 2GB+
```

**Use BuildKit:**
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### Database Performance

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_assignments_course_id ON assignments(course_id);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM assignments WHERE course_id = 1;
```

### Go Build Performance

```bash
# Use build cache
go build -o bin/app ./cmd/server

# Parallel builds
go build -p 8 ./...
```

### Frontend Build Performance

```bash
# Use Vite's fast refresh
npm run dev

# Optimize production build
npm run build -- --mode production
```

---

## Testing Locally

### Unit Tests

```bash
# Go tests
cd apps/services/assignment-service
go test ./... -v

# Python tests
cd apps/services/cipas-service
pytest

# Frontend tests
cd apps/web
npm test
```

### Integration Tests

```bash
# Run integration test suite
./scripts/test-integration.sh

# Test specific service
./scripts/test-integration.sh assignment-service
```

### API Testing with HTTPie

```bash
# Install HTTPie
pip install httpie

# Test assignment creation
http POST localhost:8080/api/v1/assignments \
  Authorization:"Bearer $TOKEN" \
  title="Test Assignment" \
  course_id=1
```

### gRPC Testing with grpcurl

```bash
# Install grpcurl
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# List services
grpcurl -plaintext localhost:8081 list

# Call method
grpcurl -plaintext -d '{"id": 1}' \
  localhost:8081 academics.v1.AcademicsService/GetCourse
```

---

## Next Steps

- Review [Service Communication Patterns](service-communication.md)
- Set up [Observability Stack](observability.md)
- Read [Database Migrations Guide](migrations.md)
- Check out [Deployment Guide](deployment.md)

---

**Need help?** Ask in `#gradeloop-dev` Slack channel or consult the team wiki.