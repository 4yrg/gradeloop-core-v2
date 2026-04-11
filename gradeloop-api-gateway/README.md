# GradeLoop API Gateway

Modular Kong API Gateway configuration for GradeLoop microservices.

## Quick Start

```bash
# Start Kong Gateway
docker compose up -d

# Check status
curl http://localhost:8001/status
```

## Configuration Structure

```
config/
├── kong.yml              # Main config (imports others)
├── services/            # Service definitions
│   ├── iam.yaml
│   ├── academic.yaml
│   ├── assessment.yaml
│   ├── email.yaml
│   ├── keystroke.yaml
│   └── ivas.yaml
└── plugins/             # Plugin configurations
    ├── cors.yaml
    ├── jwt-validation.yaml
    └── rate-limit.yaml
```

## Ports

| Port | Service |
|------|---------|
| 8000 | HTTP Gateway |
| 8001 | Admin API |
| 8002 | Dashboard |

## Management Commands

```bash
make status   # Check gateway status
make logs    # View gateway logs
make restart # Restart gateway
```

## Services

- IAM Service: `/api/v1/auth/*`, `/api/v1/users/*`
- Academic Service: `/api/v1/departments/*`, `/api/v1/courses/*`
- Assessment Service: `/api/v1/assignments/*`, `/api/v1/submissions/*`
- Email Service: `/api/v1/emails/*`
- Keystroke Service: `/api/keystroke/*`, `/ws/monitor/*`
- IVAS Service: `/api/v1/ivas/*`, `/ws/ivas/*`