# Academics Service

## Overview

The Academics Service is responsible for managing the core academic structure of GradeLoop, including faculties, departments, courses, and more. This service follows the standard GradeLoop Clean Architecture pattern.

## Features

- **Faculty Management**: Create, update, and deactivate academic faculties.
- **Leadership Management**: Assign and manage leadership roles within faculties.

## Tech Stack

- **Go**: 1.25+
- **Framework**: GoFiber v3
- **ORM**: GORM
- **Database**: PostgreSQL

## API Endpoints

### Faculties

- `POST /api/academics/faculties`: Create a new faculty.
- `GET /api/academics/faculties`: List all faculties.
- `GET /api/academics/faculties?include_inactive=true`: List all faculties including inactive ones.
- `GET /api/academics/faculties/{id}`: Get a single faculty by ID.
- `PATCH /api/academics/faculties/{id}`: Update a faculty's metadata.
- `DELETE /api/academics-service/faculties/{id}`: Deactivate a faculty.
- `GET /api/academics/faculties/{id}/leaders`: Get the leadership panel for a faculty.

## Development

### Prerequisites
- Go 1.25+
- Docker & Docker Compose

### Setup
1. **Navigate to the service:**
   ```bash
   cd apps/services/academics-service
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

```bash
# From within apps/services/academics-service
go test ./...
```
