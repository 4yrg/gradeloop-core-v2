# LLM Service

A Go Fiber v3 microservice for connecting with LLM providers using OpenAI-compatible APIs. Supports both synchronous chat responses and Server-Sent Events (SSE) streaming.

## Features

- **OpenAI-Compatible API**: Works with OpenAI, Ollama, and other providers that support the OpenAI API format
- **Streaming Support**: Real-time response streaming using Server-Sent Events (SSE)
- **Fiber v3**: Built with the latest Go Fiber framework
- **Configurable**: Easy configuration via environment variables

## Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
SERVER_PORT=8085
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### 2. Run the Service

```bash
go run ./cmd/main.go
```

### 3. Test the Endpoints

#### Non-streaming Chat

```bash
curl -X POST http://localhost:8085/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### Streaming Chat (SSE)

```bash
curl -X POST http://localhost:8085/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a story"}
    ]
  }'
```

## API Reference

### POST `/api/v1/chat`

Send a chat message and receive the complete response.

**Request Body:**

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "model": "gpt-4o-mini",
  "max_tokens": 2048
}
```

**Response:**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4o-mini",
  "content": "Hello! How can I help you today?",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### POST `/api/v1/chat/stream`

Send a chat message and receive a streamed response via SSE.

**Request Body:** Same as `/api/v1/chat`

**Response:** Server-Sent Events stream

```
data: {"id":"chatcmpl-123","content":"Hello","done":false}

data: {"id":"chatcmpl-123","content":"! How","done":false}

data: {"id":"chatcmpl-123","content":" can I help?","done":true}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Server port | `8085` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `LLM_PROVIDER` | LLM provider name | `openai` |
| `LLM_API_KEY` | API key for LLM provider | *required* |
| `LLM_BASE_URL` | Base URL for LLM API | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model to use | `gpt-4o-mini` |
| `LLM_MAX_TOKENS` | Maximum tokens in response | `2048` |
| `LLM_TEMPERATURE` | Response temperature (0.0-2.0) | `0.7` |
| `LLM_TIMEOUT` | Request timeout in seconds | `60` |

## Provider Examples

### OpenAI

```env
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### Ollama (Local)

```env
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama2
```

### Other OpenAI-Compatible Providers

```env
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://your-provider.com/v1
LLM_MODEL=your-model
```

## Docker

Build and run with Docker:

```bash
docker build -t llm-service .
docker run -p 8085:8085 --env-file .env llm-service
```

## Project Structure

```
llm-service/
├── cmd/
│   └── main.go              # Application entry point
├── internal/
│   ├── client/
│   │   └── openai.go        # OpenAI-compatible client
│   ├── config/
│   │   └── config.go        # Configuration management
│   ├── dto/
│   │   └── chat.go          # Data transfer objects
│   ├── handler/
│   │   └── chat.go          # HTTP handlers
│   ├── router/
│   │   └── router.go        # Route configuration
│   └── service/
│       └── chat.go          # Business logic
├── .env.example
├── Dockerfile
├── go.mod
└── go.sum
```

## License

MIT
