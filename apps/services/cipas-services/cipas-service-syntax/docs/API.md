# Clone Detection API Documentation

FastAPI-based REST API for code clone detection and comparison.

## Quick Start

### 1. Start the Server

```bash
# Activate virtual environment
source .venv-cipas-syntax/bin/activate

# Start with uvicorn
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Or use the main.py script
python main.py
```

### 2. Access the API

- **Interactive Docs (Swagger UI)**: http://localhost:8000/docs
- **Alternative Docs (ReDoc)**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## API Endpoints

### Health Check

#### `GET /health`
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-25T15:00:00",
  "version": "1.0.0",
  "service": "Clone Detection Service"
}
```

#### `GET /health/detailed`
Detailed health check with model status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-25T15:00:00",
  "version": "1.0.0",
  "service": "Clone Detection Service",
  "model_loaded": true,
  "supported_languages": ["python", "java", "c"]
}
```

### Code Comparison

#### `POST /api/v1/compare/`
Compare two code segments for clone detection.

**Request Body:**
```json
{
  "code1": "def hello():\n    print('Hello')",
  "code2": "def hi():\n    print('Hi')",
  "language": "python",
  "threshold": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "sample1": {
    "name": "Sample 1",
    "characters": 37,
    "tokens": 7
  },
  "sample2": {
    "name": "Sample 2",
    "characters": 37,
    "tokens": 7
  },
  "similarity_metrics": {
    "levenshtein_distance": 0.0,
    "levenshtein_similarity": 1.0,
    "jaro_similarity": 1.0,
    "jaro_winkler_similarity": 1.0,
    "jaccard_similarity": 1.0,
    "dice_coefficient": 1.0,
    "average_similarity": 1.0
  },
  "prediction": {
    "is_clone": true,
    "clone_probability": 0.9998,
    "threshold": 0.5
  },
  "feature_importances": {
    "levenshtein_distance": 0.2221,
    "levenshtein_ratio": 0.2221,
    "jaro_similarity": 0.2222,
    "jaro_winkler_similarity": 0.2532,
    "jaccard_similarity": 0.0447,
    "dice_coefficient": 0.0357
  },
  "language": "python",
  "message": "Clone detected with high confidence"
}
```

**Request Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code1` | string | Yes | - | First code snippet (max 100,000 chars) |
| `code2` | string | Yes | - | Second code snippet (max 100,000 chars) |
| `language` | enum | No | "java" | Programming language: `python`, `java`, `c` |
| `threshold` | float | No | 0.5 | Classification threshold (0.0-1.0) |

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether comparison was successful |
| `sample1` | object | First sample information |
| `sample2` | object | Second sample information |
| `similarity_metrics` | object | Detailed similarity scores |
| `prediction` | object | Clone prediction results |
| `feature_importances` | object | Model feature importances |
| `language` | string | Language used for analysis |
| `message` | string | Human-readable result message |

#### `POST /api/v1/compare/quick`
Quick comparison using query parameters.

**Request:**
```
POST /api/v1/compare/quick?code1=def+hello():+pass&code2=def+hi():+pass&language=python
```

**Response:** Same as full comparison endpoint.

#### `GET /api/v1/compare/languages`
Get supported programming languages.

**Response:**
```json
["python", "java", "c"]
```

#### `GET /api/v1/compare/model/info`
Get information about the loaded ML model.

**Response:**
```json
{
  "loaded": true,
  "model_path": "data/models/clone_classifier.joblib",
  "feature_names": [
    "levenshtein_distance",
    "levenshtein_ratio",
    "jaro_similarity",
    "jaro_winkler_similarity",
    "jaccard_similarity",
    "dice_coefficient"
  ],
  "feature_importances": {
    "jaro_winkler_similarity": 0.2532,
    "jaro_similarity": 0.2222,
    "levenshtein_ratio": 0.2221,
    "levenshtein_distance": 0.2221,
    "jaccard_similarity": 0.0447,
    "dice_coefficient": 0.0357
  }
}
```

## Usage Examples

### cURL

#### Compare Python Code
```bash
curl -X POST "http://localhost:8000/api/v1/compare/" \
  -H "Content-Type: application/json" \
  -d '{
    "code1": "def calculate_sum(a, b): return a + b",
    "code2": "def compute_total(x, y): return x + y",
    "language": "python",
    "threshold": 0.5
  }'
```

#### Quick Comparison
```bash
curl -X POST "http://localhost:8000/api/v1/compare/quick" \
  -G \
  --data-urlencode "code1=def hello(): print('Hi')" \
  --data-urlencode "code2=def hi(): print('Hello')" \
  --data-urlencode "language=python"
```

### Python (requests)

```python
import requests

# Compare two code snippets
response = requests.post(
    "http://localhost:8000/api/v1/compare/",
    json={
        "code1": "def hello():\n    print('Hello')",
        "code2": "def hi():\n    print('Hi')",
        "language": "python",
        "threshold": 0.5
    }
)

result = response.json()
print(f"Is clone: {result['prediction']['is_clone']}")
print(f"Probability: {result['prediction']['clone_probability']:.2%}")
print(f"Average similarity: {result['similarity_metrics']['average_similarity']:.2%}")
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:8000/api/v1/compare/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code1: "def hello(): print('Hello')",
    code2: "def hi(): print('Hi')",
    language: 'python',
    threshold: 0.5
  })
});

const result = await response.json();
console.log(`Clone detected: ${result.prediction.is_clone}`);
console.log(`Probability: ${(result.prediction.clone_probability * 100).toFixed(2)}%`);
```

## Error Handling

The API returns standard HTTP status codes:

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input (empty code, too long, etc.) |
| 403 | Forbidden - Unsupported language |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Model not loaded |

**Error Response Format:**
```json
{
  "error": true,
  "message": "Error description",
  "detail": "Additional details (optional)"
}
```

## Configuration

Environment variables (set in `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `DEBUG` | true | Debug mode |
| `MODEL_PATH` | data/models/clone_classifier.joblib | Path to ML model |
| `DEFAULT_LANGUAGE` | java | Default programming language |
| `DEFAULT_THRESHOLD` | 0.5 | Default classification threshold |
| `MAX_CODE_LENGTH` | 100000 | Maximum code length (chars) |
| `ALLOWED_ORIGINS` | ["*"] | CORS allowed origins |

## Docker

```bash
# Build image
docker build -t clone-detection-api:latest .

# Run container
docker run -p 8000:8000 clone-detection-api:latest

# With volume for model
docker run -p 8000:8000 \
  -v $(pwd)/data/models:/app/data/models \
  clone-detection-api:latest
```

## Testing

```bash
# Run tests
pytest

# Test specific endpoint
pytest tests/api/test_compare.py -v
```

## Performance

| Operation | Latency |
|-----------|---------|
| Health check | < 10ms |
| Code comparison (small) | < 100ms |
| Code comparison (large) | < 500ms |

## Rate Limiting

Currently, no rate limiting is implemented. For production use, consider adding:
- Request rate limiting
- API key authentication
- Request size limits

## Support

For issues or questions:
1. Check the API docs: http://localhost:8000/docs
2. Review logs in stderr
3. Check the main documentation in README.md
