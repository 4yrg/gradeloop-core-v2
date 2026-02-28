# CIPAS AI - Code Detection Service

A production-ready FastAPI microservice for AI-generated code detection using the **DroidDetect-Large** model.

## Features

- **3-Class Classification**: Detects whether code is:
  - Human-written
  - AI-generated
  - AI-refined (adversarial code designed to look human)

- **Robust Detection**: Uses the DroidDetect-Large model (396M parameters, ModernBERT-Large backbone) which:
  - Achieves near-ideal scores in binary and ternary classification tasks
  - Maintains recall >0.9 against adversarial samples
  - Outperforms smaller backbones and zero-shot baselines

- **GPU Acceleration**: Automatically uses CUDA if available, falls back to CPU

- **Efficient Inference**: Model preloaded on startup, Singleton pattern ensures single memory load

## Installation

### Prerequisites

- Python 3.10+
- Poetry (for dependency management)

### Setup

```bash
# Navigate to the service directory
cd apps/services/cipas-services/cipas-ai

# Install dependencies
poetry install

# Copy environment configuration
cp .env.example .env
```

**Note:** This service is configured for CPU-only inference. For GPU support, modify `pyproject.toml` to use the CUDA version of PyTorch.

## Usage

### Start the Server

```bash
# Development mode
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
poetry run uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### API Endpoints

#### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu"
}
```

#### Code Detection
```bash
POST /detect
Content-Type: application/json

{
  "code_snippet": "def hello():\n    print('Hello, World!')",
  "language": "python"
}
```

Response:
```json
{
  "predicted_label": "Human-written",
  "confidence_score": 0.9234,
  "is_adversarial": false,
  "all_scores": {
    "Human-written": 0.9234,
    "AI-generated": 0.0512,
    "AI-refined": 0.0254
  },
  "token_count": 12,
  "warning": null
}
```

## API Schema

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code_snippet` | string | Yes | The code to analyze (1-50000 chars) |
| `language` | string | No | Optional programming language hint |

### Response Body

| Field | Type | Description |
|-------|------|-------------|
| `predicted_label` | string | One of: "Human-written", "AI-generated", "AI-refined" |
| `confidence_score` | float | Confidence for predicted label (0.0-1.0) |
| `is_adversarial` | boolean | True if AI-refined probability ≥ 0.5 |
| `all_scores` | object | Confidence scores for all classes |
| `token_count` | integer | Estimated token count of input |
| `warning` | string | Warning if input exceeds 512 tokens |

## Performance Notes

- **Optimal Input Length**: Model performs best on inputs up to **512 tokens**
- **Large Inputs**: Code exceeding 512 tokens will be truncated; consider splitting large files
- **Domain Sensitivity**: May show slightly lower performance on Research/Data Science code due to inherent complexity

## Development

### Run Tests
```bash
poetry run pytest
```

### Code Structure

```
cipas-ai/
├── main.py           # FastAPI application and endpoints
├── model_loader.py   # Singleton model loader utility
├── pyproject.toml    # Project dependencies
└── .env.example      # Environment configuration template
```

## Model Information

- **Model**: [project-droid/DroidDetect-Large](https://huggingface.co/project-droid/DroidDetect-Large)
- **Architecture**: ModernBERT-Large (encoder-only classifier)
- **Parameters**: 396M
- **Task**: Sequence Classification (3-class)

## License

Part of the Gradeloop Core project.
