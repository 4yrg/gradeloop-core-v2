# IAM Service

Identity and Access Management service for GradeLoop Core V2.

## Tech Stack

- **Framework**: Fiber v3 (Go)
- **Database**: PostgreSQL with GORM
- **Logging**: Zap (structured logging)
- **Architecture**: Clean Architecture

## Project Structure

```
apps/services/iam-service/
├── cmd/
│   └── main.go              # Application entrypoint
├── internal/
│   ├── config/              # Environment configuration
│   ├── domain/              # Business entities
│   ├── dto/                 # Data Transfer Objects
│   ├── handler/             # HTTP handlers
│   ├── middleware/          # Custom middleware
│   ├── repository/          # Data access layer
│   ├── router/              # Route definitions
│   ├── service/             # Business logic
│   └── utils/               # Helper functions
├── pkg/                     # Public packages
├── go.mod
├── Dockerfile
└── .env.example
```

## Getting Started

### Prerequisites

- Go 1.25.6+
- PostgreSQL 14+
- Docker (optional)

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the environment variables in `.env`

3. Install dependencies:
   ```bash
   go mod download
   ```

4. Run the service:
   ```bash
   go run ./cmd/main.go
   ```

### Docker

Build and run with Docker:
```bash
docker build -t gradeloop-iam-service .
docker run -p 8081:8081 --env-file .env gradeloop-iam-service
```

Or use Docker Compose from the project root:
```bash
docker compose up iam-service
```

## API Endpoints

| Method | Endpoint   | Description      |
|--------|------------|------------------|
| GET    | /          | Service info     |
| GET    | /health    | Health check     |

## Environment Variables

| Variable         | Description           | Default     |
|------------------|-----------------------|-------------|
| SERVER_PORT      | Server port           | 8081        |
| ENABLE_PREFORK   | Enable Fiber prefork  | false       |
| DB_HOST          | Database host         | localhost   |
| DB_PORT          | Database port         | 5432        |
| DB_USER          | Database user         | postgres    |
| DB_PASSWORD      | Database password     | postgres    |
| DB_NAME          | Database name         | iam_db      |
| DB_SSLMODE       | SSL mode for DB       | disable     |
