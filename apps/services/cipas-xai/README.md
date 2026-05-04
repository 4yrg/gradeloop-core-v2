# CIPAS XAI Service

A Go Fiber v3 microservice for Explainable AI (XAI) in the CIPAS pipeline. It provides detailed reasoning for why certain code snippets are classified as plagiarism (Type-1 to Type-4) or AI-generated.

## Features

- **Specialized Reasoning**: Generates professor-level technical reasoning for code clones and AI detection.
- **Support for N-Snippets**: Can analyze and compare multiple code snippets for clone detection.
- **JSON Response Format**: Returns structured reasoning ready for frontend display.
- **OpenRouter Integration**: Uses `openrouter/owl-alpha` by default for high-quality reasoning.

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
CIPAS_XAI_LLM_MODEL=openrouter/owl-alpha
```

### 2. Run the Service

```bash
go run ./cmd/main.go
```

### 3. Test the Endpoint

#### Reason for Clone Detection (TYPE-1 to TYPE-4)

Requires at least 2 code snippets.

```bash
curl -X POST http://localhost:8085/api/v1/cipas-xai/reason \
  -H "Content-Type: application/json" \
  -d '{
    "type": "TYPE-2",
    "code": [
      "function add(a, b) { return a + b; }",
      "function sum(x, y) { return x + y; }"
    ]
  }'
```

#### Reason for AI Detection (TYPE-AI)

Requires exactly 1 code snippet.

```bash
curl -X POST http://localhost:8085/api/v1/cipas-xai/reason \
  -H "Content-Type: application/json" \
  -d '{
    "type": "TYPE-AI",
    "code": [
      "// This function adds two numbers\nfunction add(a, b) {\n  return a + b;\n}"
    ]
  }'
```

## API Reference

### POST `/api/v1/cipas-xai/reason`

Explain why code matches a specific detection type.

**Request Body:**

```json
{
  "type": "TYPE-1" | "TYPE-2" | "TYPE-3" | "TYPE-4" | "TYPE-AI",
  "code": ["snippet1", "snippet2", "..."]
}
```

**Response:**

```json
{
  "reason": "The snippets are Type-2 clones because they share identical structural logic (a simple binary addition) but differ only in identifier names ('add' vs 'sum' and 'a,b' vs 'x,y')."
}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CIPAS_XAI_SVC_PORT` | Server port | `8085` |
| `CIPAS_XAI_LLM_API_KEY` | API key for LLM provider | *required* |
| `CIPAS_XAI_LLM_MODEL` | Model to use | `openrouter/owl-alpha` |

## Docker

Build and run with Docker:

```bash
docker build -t cipas-xai .
docker run -p 8085:8085 --env-file .env cipas-xai
```

## License

MIT
