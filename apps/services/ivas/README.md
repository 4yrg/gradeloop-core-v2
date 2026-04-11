# IVAS Service

**Intelligent Viva Assessment System** — AI-powered voice-based oral examination service.

## Architecture

- **Framework**: FastAPI + Uvicorn
- **Port**: 8088
- **Database**: Dedicated PostgreSQL (ivas-postgres, port 5434)
- **Voice AI**: Gemini Live API (real-time bidirectional voice)
- **Speaker Verification**: Resemblyzer (CPU-based voiceprint matching)
- **Storage**: MinIO (audio recordings), Redis (session state)

## Development

```bash
# Start with Docker Compose
docker compose up ivas-service ivas-postgres redis minio

# Health check
curl http://localhost:8000/api/v1/ivas/health
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ivas/health` | Health check |
| GET | `/api/v1/ivas/ready` | Readiness check |
| WS | `/ws/ivas/session/{session_id}` | Live viva session |

See [BUILD_PLAN.md](../../../docs/ivas/BUILD_PLAN.md) for full implementation plan.
