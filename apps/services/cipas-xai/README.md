# CIPAS XAI Service

A Go Fiber v3 microservice for connecting with LLM providers using OpenRouter (OpenAI-compatible) APIs. Supports both synchronous chat responses and Server-Sent Events (SSE) streaming.

## Features

- **OpenRouter Integration**: Works with hundreds of models via OpenRouter's unified API
- **Streaming Support**: Real-time response streaming using Server-Sent Events (SSE)
- **Fiber v3**: Built with the latest Go Fiber framework
- **Configurable**: Easy configuration via environment variables with `CIPAS_XAI_` prefix

## Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
CIPAS_XAI_SVC_PORT=8085
CIPAS_XAI_LLM_API_KEY=your-openrouter-api-key-here
CIPAS_XAI_LLM_BASE_URL=https://openrouter.ai/api/v1
CIPAS_XAI_LLM_MODEL=z-ai/glm-4.5-air:free
CIPAS_XAI_LLM_EXTRA_HEADERS=HTTP-Referer=http://localhost:3000,X-OpenRouter-Title=GradeLoop CIPAS-XAI
```

### 2. Run the Service

```bash
go run ./cmd/main.go
```

### 3. Test the Endpoints

#### Non-streaming Chat (Text Only)

```bash
curl -X POST http://localhost:8085/api/v1/cipas-xai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### Non-streaming Chat with Image (Multi-modal)

```bash
curl -X POST http://localhost:8085/api/v1/cipas-xai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What is in this image?"},
          {"type": "image_url", "image_url": {"url": "https://live.staticflickr.com/3851/14825276609_098cac593d_b.jpg"}}
        ]
      }
    ]
  }'
```

#### Streaming Chat (SSE)

```bash
curl -X POST http://localhost:8085/api/v1/cipas-xai/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a story"}
    ]
  }'
```

## API Reference

### POST `/api/v1/cipas-xai/chat`

Send a chat message and receive the complete response.

**Request Body:**

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 2048
}
```

**Response:**

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "z-ai/glm-4.5-air:free",
  "content": "Hello! How can I help you today?",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### POST `/api/v1/cipas-xai/chat/stream`

Send a chat message and receive a streamed response via SSE.

**Request Body:** Same as `/api/v1/cipas-xai/chat`

**Response:** Server-Sent Events stream

```
data: {"id":"chatcmpl-123","content":"Hello","done":false}

data: {"id":"chatcmpl-123","content":"! How","done":false}

data: {"id":"chatcmpl-123","content":" can I help?","done":true}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CIPAS_XAI_SVC_PORT` | Server port | `8085` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `CIPAS_XAI_LLM_PROVIDER` | LLM provider name | `openrouter` |
| `CIPAS_XAI_LLM_API_KEY` | API key for LLM provider | *required* |
| `CIPAS_XAI_LLM_BASE_URL` | Base URL for LLM API | `https://openrouter.ai/api/v1` |
| `CIPAS_XAI_LLM_MODEL` | Model to use | `z-ai/glm-4.5-air:free` |
| `CIPAS_XAI_LLM_EXTRA_HEADERS` | Extra headers (comma-separated key=value) | `` |
| `CIPAS_XAI_LLM_MAX_TOKENS` | Maximum tokens in response | `2048` |
| `CIPAS_XAI_LLM_TEMPERATURE` | Response temperature (0.0-2.0) | `0.7` |
| `CIPAS_XAI_LLM_TIMEOUT` | Request timeout in seconds | `60` |

## Provider Examples

### OpenRouter (Default)

```env
CIPAS_XAI_LLM_API_KEY=sk-or-...
CIPAS_XAI_LLM_BASE_URL=https://openrouter.ai/api/v1
CIPAS_XAI_LLM_MODEL=z-ai/glm-4.5-air:free
CIPAS_XAI_LLM_EXTRA_HEADERS=HTTP-Referer=http://localhost:3000,X-OpenRouter-Title=GradeLoop CIPAS-XAI
```

### OpenAI

```env
CIPAS_XAI_LLM_API_KEY=sk-...
CIPAS_XAI_LLM_BASE_URL=https://api.openai.com/v1
CIPAS_XAI_LLM_MODEL=gpt-4o-mini
```

### Ollama (Local)

```env
CIPAS_XAI_LLM_API_KEY=ollama
CIPAS_XAI_LLM_BASE_URL=http://localhost:11434/v1
CIPAS_XAI_LLM_MODEL=llama2
```

## Docker

Build and run with Docker:

```bash
docker build -t cipas-xai .
docker run -p 8085:8085 --env-file .env cipas-xai
```

## Project Structure

```
cipas-xai/
├── cmd/
│   └── main.go              # Application entry point
├── internal/
│   ├── client/
│   │   └── openrouter.go    # OpenRouter/OpenAI-compatible client
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
