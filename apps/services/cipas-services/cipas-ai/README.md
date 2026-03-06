# CIPAS-AI: Code Intelligence and Plagiarism Assessment System

A modern FastAPI-based service for AI-powered code classification and clone detection, supporting both CatBoost and DroidDetect models with CUDA acceleration.

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- CUDA 11.8 (for GPU acceleration)
- Poetry (recommended) or pip

### Installation

1. **Install dependencies with Poetry:**
   ```bash
   poetry install
   ```

2. **Or with pip:**
   ```bash
   pip install -e .
   ```

### Configuration

All configuration is managed through the central `config.yaml` file:

```yaml
# Example: Key settings in config.yaml
datasets:
  base_path: "../../datasets"
  evaluation_dataset: "aicd-bench"
  
models:
  catboost:
    iterations: 1000
    learning_rate: 0.1
    
system:
  device: "cuda"  # or "cpu"
```

## 💻 Usage

### CLI Interface

**Train models:**
```bash
# Train the full pipeline (CatBoost → DroidDetect, all configured datasets)
python train.py

# Train a specific stage
python train.py --model catboost
python train.py --model droiddetect

# Target a specific dataset
python train.py --dataset DroidCollection

# Limit samples (quick sanity run)
python train.py --max-samples 2000 --verbose
```

**Evaluate models:**
```bash
# Evaluate the full pipeline against aicd-bench (default)
python evaluate.py

# Evaluate a specific stage
python evaluate.py --stage catboost
python evaluate.py --stage droiddetect

# Evaluate on a different dataset or limit samples
python evaluate.py --dataset DroidCollection --max-samples 500

# Save detailed results to a file
python evaluate.py --output results/my_run.json --verbose
```

### FastAPI Service

**Start the service:**
```bash
# Start with default settings
python start.py

# Development mode with auto-reload
python start.py --reload --port 8080

# Using Poetry
poetry run cipas-ai
```

**Access the API:**
- **Documentation:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/api/v1/health
- **Training:** http://localhost:8000/api/v1/train/run
- **Evaluation:** http://localhost:8000/api/v1/evaluate/run

## 📁 Project Structure

```
cipas-ai/
├── config.yaml                 # Central configuration
├── pyproject.toml              # Poetry dependencies (CUDA 11.8)
├── train.py                    # CLI training entry point
├── evaluate.py                 # CLI evaluation entry point  
├── start.py                    # FastAPI service launcher
├── cipas_ai/                   # Main package
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── config/                 # Configuration management
│   │   ├── __init__.py
│   │   └── settings.py         # Pydantic settings with YAML
│   ├── api/v1/                 # REST API endpoints
│   │   ├── __init__.py
│   │   ├── health.py          # Health & system info
│   │   ├── train.py           # Training endpoints
│   │   ├── evaluate.py        # Evaluation endpoints
│   │   └── models.py          # Model management
│   ├── pipeline/               # Training/evaluation orchestration
│   │   ├── __init__.py
│   │   └── orchestrator.py    # Main pipeline logic
│   └── trainers/               # Model-specific trainers
│       ├── __init__.py
│       ├── catboost.py        # CatBoost trainer
│       └── droiddetect.py     # DroidDetect trainer
├── models/                     # Trained models storage
└── results/                    # Evaluation results
```

## 🤖 API Endpoints

### Health & System
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed system info with GPU status

### Training
- `POST /api/v1/train/run` - Start training job
- `GET /api/v1/train/status/{job_id}` - Check training status
- `GET /api/v1/train/status` - List all training jobs

### Evaluation  
- `POST /api/v1/evaluate/run` - Start evaluation job
- `POST /api/v1/evaluate/quick` - Quick synchronous evaluation
- `GET /api/v1/evaluate/datasets` - List available datasets
- `GET /api/v1/evaluate/status/{job_id}` - Check evaluation status

### Models
- `GET /api/v1/models` - List available models
- `GET /api/v1/models/{model_id}` - Get model info
- `DELETE /api/v1/models/{model_id}` - Delete model

## 📊 Example API Usage

### Train a Model
```bash
curl -X POST "http://localhost:8000/api/v1/train/run" \
     -H "Content-Type: application/json" \
     -d '{
       "model_type": "catboost",
       "dataset": "synthetic",
       "config_overrides": {"iterations": 500}
     }'
```

### Quick Evaluation
```bash  
curl -X POST "http://localhost:8000/api/v1/evaluate/quick" \
     -H "Content-Type: application/json" \
     -d '{
       "code_samples": ["def hello(): return \"world\""],
       "stage": "pipeline"
     }'
```

### Check System Health
```bash
curl "http://localhost:8000/api/v1/health/detailed"
```

## ⚙️ Configuration

The `config.yaml` file controls all aspects of the system:

### Key Configuration Sections

**Datasets:**
```yaml
datasets:
  base_path: "../../datasets"
  evaluation_dataset: "aicd-bench"
  available:
    aicd-bench:
      train: "aicd-bench/T1_train.csv"
      test: "aicd-bench/T1_test.csv"
```

**Models:**
```yaml
models:
  catboost:
    iterations: 1000
    learning_rate: 0.1
    fast_path_threshold: 0.8
  droiddetect:
    model_name: "microsoft/codebert-base"
    epochs: 3
    batch_size: 8
```

**System:**
```yaml
system:
  device: "cuda"  # "cuda" or "cpu"
  
api:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["*"]
```

## 🔧 Development

### Adding New Models

1. Create trainer in `cipas_ai/trainers/your_model.py`
2. Implement `train()` and `evaluate()` methods
3. Update orchestrator to support new model type
4. Add configuration section to `config.yaml`

### Running Tests

```bash
# Install dev dependencies
poetry install --with dev

# Run tests (when implemented)
pytest tests/

# Type checking
mypy cipas_ai/
```

### CUDA Setup

The project is configured for CUDA 11.8:

```toml
# pyproject.toml
torch = {version = "2.1.2+cu118", source = "pytorch-cu118"}
torchvision = {version = "0.16.2+cu118", source = "pytorch-cu118"}
torchaudio = {version = "2.1.2+cu118", source = "pytorch-cu118"}
```

## 📈 Performance Features

- **Fast Path:** CatBoost for quick classification with confidence thresholding
- **Slow Path:** DroidDetect for complex cases requiring deep analysis  
- **GPU Acceleration:** CUDA 11.8 support for training and inference
- **Background Jobs:** Asynchronous training/evaluation with progress tracking
- **Batch Processing:** Configurable batch sizes for efficient GPU utilization

## 🐛 Troubleshooting

**CUDA Issues:**
```bash
# Check CUDA availability
python -c "import torch; print(torch.cuda.is_available())"
```

**Missing Dependencies:**
```bash
# Reinstall with CUDA support
poetry install --with cuda
```

**Configuration Errors:**
- Verify `config.yaml` syntax with a YAML validator
- Check file paths in dataset configuration
- Ensure models directory has write permissions

- **AI-refined**: AI-generated code that has been edited/refined by humans (adversarial)

### Supported Languages

- Python
- Java
- C/C++

### Structural Features (Tier 1)

The CatBoost classifier analyzes 8 structural features:

1. **whitespace_ratio**: Ratio of whitespace characters to total
2. **avg_identifier_length**: Average length of variable/function names
3. **ast_density**: Number of AST nodes per line
4. **line_count**: Total lines of code
5. **avg_line_length**: Average characters per line
6. **comment_density**: Ratio of comment characters
7. **max_nesting_depth**: Maximum control structure nesting
8. **unique_node_ratio**: Ratio of unique AST node types

## Installation

### Prerequisites

- Python 3.10+
- Poetry (for dependency management)
- Git (for cloning tree-sitter parsers)

### Quick Start

```bash
# Navigate to service directory
cd apps/services/cipas-services/cipas-ai

# Copy environment configuration
cp .env.example .env

# Install dependencies
poetry install

# Install tree-sitter parsers
python scripts/build_parsers.py

# Start the server
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8087
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d cipas-ai

# View logs
docker-compose logs -f cipas-ai

# Check health
curl http://localhost:8000/api/v1/cipas-ai/health
```

## Usage

### API Endpoints

#### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "tier1_model": {
    "name": "CatBoost Classifier",
    "loaded": true,
    "path_or_name": "models/catboost_classifier.cbm"
  },
  "tier2_model": {
    "name": "ModernBERT-Large (DroidDetect)",
    "loaded": true,
    "path_or_name": "project-droid/DroidDetect-Large"
  },
  "device": "cuda",
  "version": "0.2.0"
}
```

#### Single Code Detection

```bash
POST /api/v1/cipas-ai/detect
Content-Type: application/json

{
  "code_snippet": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
  "language": "python",
  "use_hybrid": true
}
```

Response:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "verdict": "Human-written",
  "confidence": 0.982,
  "metadata": {
    "model": "CatBoost + ModernBERT-Large (DroidDetect)",
    "processing_time_ms": 240.5,
    "token_count": 156,
    "tier_used": "tier2_modernbert",
    "tier1_confidence": 0.65,
    "tier2_confidence": 0.982
  },
  "all_scores": {
    "Human-written": 0.982,
    "AI-generated": 0.012,
    "AI-refined": 0.006
  },
  "warning": null
}
```

#### Batch Detection

```bash
POST /api/v1/cipas-ai/detect/batch
Content-Type: application/json

{
  "snippets": [
    {
      "code_snippet": "def hello(): pass",
      "language": "python"
    },
    {
      "code_snippet": "public void hello() {}",
      "language": "java"
    }
  ]
}
```

#### Extract Structural Features

```bash
POST /api/v1/cipas-ai/features
Content-Type: application/json

{
  "code_snippet": "def hello():\n    print('world')",
  "language": "python"
}
```

Response:
```json
{
  "request_id": "uuid",
  "features": {
    "whitespace_ratio": 0.15,
    "avg_identifier_length": 5.2,
    "ast_density": 3.5,
    "line_count": 2,
    "avg_line_length": 14.5,
    "comment_density": 0.0,
    "max_nesting_depth": 1,
    "unique_node_ratio": 0.4
  },
  "feature_list": [0.15, 5.2, 3.5, 2, 14.5, 0.0, 1, 0.4]
}
```

### Python Client

```python
import httpx

async def detect_code(code: str, language: str = "python"):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8087/api/v1/cipas-ai/detect",
            json={
                "code_snippet": code,
                "language": language,
                "use_hybrid": True
            }
        )
        return response.json()

# Example usage
result = await detect_code("""
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
""")

print(f"Verdict: {result['verdict']}")
print(f"Confidence: {result['confidence']:.2%}")
print(f"Tier used: {result['metadata']['tier_used']}")
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CIPAS_AI_PORT` | 8087 | Service port |
| `CIPAS_AI_TIER1_MODEL_PATH` | `models/catboost_classifier.cbm` | Path to CatBoost model |
| `CIPAS_AI_TIER2_MODEL_NAME` | `project-droid/DroidDetect-Large` | HuggingFace model for Tier 2 |
| `CIPAS_AI_TIER1_HIGH_THRESHOLD` | 0.92 | Confidence threshold for immediate human verdict |
| `CIPAS_AI_TIER1_LOW_THRESHOLD` | 0.08 | Confidence threshold for immediate AI verdict |
| `CIPAS_AI_ENABLE_4BIT_QUANTIZATION` | false | Enable 4-bit quantization (reduces VRAM) |
| `CIPAS_AI_ENABLE_8BIT_QUANTIZATION` | false | Enable 8-bit quantization (reduces VRAM) |
| `CIPAS_AI_MAX_TOKENS` | 8192 | Maximum token count for ModernBERT |
| `CIPAS_AI_SLIDING_WINDOW_SIZE` | 4096 | Sliding window size for long inputs |

### Quantization

For deployments with limited VRAM, enable quantization:

```bash
# 4-bit quantization (recommended for < 8GB VRAM)
export CIPAS_AI_ENABLE_4BIT_QUANTIZATION=true

# 8-bit quantization (good balance for 8-16GB VRAM)
export CIPAS_AI_ENABLE_8BIT_QUANTIZATION=true
```

**Note**: Cannot enable both simultaneously.

## Performance

### Benchmarks

| Scenario | Tier Used | Avg Latency | Memory |
|----------|-----------|-------------|--------|
| Clear human code | Tier 1 | ~8ms | ~500MB |
| Clear AI code | Tier 1 | ~8ms | ~500MB |
| Ambiguous code | Tier 2 | ~250ms | ~2GB |
| Long files (8k tokens) | Tier 2 | ~500ms | ~4GB |

### Optimization Tips

1. **Enable quantization** for limited VRAM environments
2. **Use async inference** for high-throughput deployments
3. **Configure Redis** for distributed task queuing
4. **Adjust thresholds** based on your precision/recall requirements

## Project Structure

```
cipas-ai/
├── main.py              # FastAPI application and routes
├── model_engine.py      # Tier 1 & Tier 2 inference logic
├── feature_extractor.py # Tree-sitter AST feature extraction
├── schemas.py           # Pydantic request/response models
├── config.py            # Configuration management
├── pyproject.toml       # Dependencies
├── Dockerfile           # Production Docker image
├── .env.example         # Environment template
├── scripts/
│   └── build_parsers.py # Tree-sitter parser builder
└── models/
    ├── catboost_classifier.cbm  # Tier 1 model (train separately)
    ├── tree-sitter-python.so    # Parsers
    ├── tree-sitter-java.so
    ├── tree-sitter-c.so
    └── tree-sitter-cpp.so
```

## Training Tier 1 Model

To train the CatBoost classifier:

```python
from catboost import CatBoostClassifier
from feature_extractor import extract_features

# Prepare training data
X_train = []
y_train = []

for code, label in training_data:
    features = extract_features(code, language="python")
    X_train.append(features.to_list())
    y_train.append(label)  # 0 = Human, 1 = AI

# Train model
model = CatBoostClassifier(
    iterations=1000,
    depth=6,
    learning_rate=0.1,
    loss_function='Logloss',
    verbose=True
)

model.fit(X_train, y_train)
model.save_model('models/catboost_classifier.cbm')
```

## API Response Schema

The service follows the Gradeloop API response schema:

```json
{
  "request_id": "uuid",
  "verdict": "AI-generated",
  "confidence": 0.982,
  "metadata": {
    "model": "CatBoost + ModernBERT-Large (DroidDetect)",
    "processing_time_ms": 240,
    "tier_used": "tier2_modernbert",
    "tier1_confidence": 0.65,
    "tier2_confidence": 0.982
  }
}
```

## Troubleshooting

### Model Not Loading

```bash
# Check HuggingFace authentication
export HUGGING_FACE_TOKEN=your_token

# Verify model files exist
ls -la models/
```

### Out of Memory

```bash
# Enable 4-bit quantization
export CIPAS_AI_ENABLE_4BIT_QUANTIZATION=true

# Reduce max tokens
export CIPAS_AI_MAX_TOKENS=4096
```

### Slow Inference

- Ensure GPU is being used (check `/health` endpoint)
- Enable async inference for concurrent requests
- Consider batching multiple detections

## License

Part of the Gradeloop Core project.
