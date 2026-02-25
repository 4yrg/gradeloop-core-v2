# Clone Detection Service

Language-agnostic code clone detection using Tree-sitter parsing, NiCAD normalization, ToMA IR transformation, and Machine Learning classification.

## Overview

This service implements a comprehensive code clone detection pipeline supporting:

- **Type-1 Clones**: Exact clones (copy-paste with whitespace/comment changes)
- **Type-2 Clones**: Renamed clones (identifier/literal renaming)
- **Type-3 Clones**: Modified clones (statements added/removed/refactored)
- **Type-4 Clones**: Semantic clones (different implementation, same functionality)

## 🚀 FastAPI Server

### Quick Start

```bash
# 1. Setup (if not done already)
chmod +x scripts/setup_pipeline.sh
./scripts/setup_pipeline.sh

# 2. Start the API server
./start_server.sh

# Or manually:
source .venv-cipas-syntax/bin/activate
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Access the API

- **Swagger UI (Interactive Docs)**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Example API Request

```bash
# Compare two code snippets
curl -X POST "http://localhost:8000/api/v1/compare/" \
  -H "Content-Type: application/json" \
  -d '{
    "code1": "def calculate_sum(a, b): return a + b",
    "code2": "def compute_total(x, y): return x + y",
    "language": "python",
    "threshold": 0.5
  }'
```

**Response:**
```json
{
  "success": true,
  "prediction": {
    "is_clone": true,
    "clone_probability": 0.9998
  },
  "similarity_metrics": {
    "average_similarity": 1.0
  },
  "message": "Clone detected with high confidence"
}
```

## 📜 Command-Line Scripts

### Training

```bash
# Train the model on ToMa dataset
python scripts/train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o data/models/clone_classifier.joblib \
  -l java \
  -n 10000
```

### Evaluation

```bash
# Evaluate on BigCloneBench
python scripts/evaluate_bcb.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o reports/evaluations/bcb_evaluation.json

# Evaluate on ToMa dataset
python scripts/evaluate_toma.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/toma-dataset \
  -o reports/evaluations/toma_evaluation.json
```

### Compare Code Samples

```bash
# Compare two files
python scripts/compare_samples.py \
  ../../../../datasets/toma-dataset/id2sourcecode/10000061.java \
  ../../../../datasets/toma-dataset/id2sourcecode/23594635.java

# Compare code snippets
python scripts/compare_samples.py \
  --code1 "def hello(): pass" \
  --code2 "def hi(): pass" \
  -l python
```

### Export Results

```bash
python scripts/export_results.py \
  -i reports/evaluations/ \
  -o reports/results/ \
  -f all
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Clone Detection Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Parser Engine (Tree-sitter)                           │
│  ├── Multi-language support (Python, Java, C)                   │
│  └── Method-level fragment extraction                           │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: NiCAD Normalization (Type-1 & Type-2)                 │
│  ├── Noise removal (comments, whitespace)                       │
│  ├── Blind renaming (identifiers, literals)                     │
│  └── LCS-based similarity (UPI)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: ToMA IR (Type-3)                                      │
│  ├── 15-type token schema mapping                               │
│  └── 6D feature extraction (Lev, Jaro, JW, Jaccard, Dice)       │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: ML & Scalability                                      │
│  ├── Inverted index for search pruning                          │
│  ├── FAISS for approximate nearest neighbor search              │
│  └── Random Forest classifier                                   │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: Evaluation & Reporting                                │
│  ├── BigCloneBench evaluation                                   │
│  ├── ToMa dataset evaluation                                    │
│  └── JSON/HTML/CSV/Markdown report generation                   │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.11+
- GCC/G++ for Tree-sitter grammar compilation
- Git for cloning grammar repositories

### Quick Setup

```bash
# Clone the repository
cd /home/iamdasun/Projects/4yrg/gradeloop-core-v2/apps/services/cipas-services/cipas-service-syntax

# Run setup script
chmod +x scripts/setup_pipeline.sh
./scripts/setup_pipeline.sh
```

The setup script will:
- Create a Python virtual environment
- Install all dependencies
- Download Tree-sitter grammars (Python, Java, C)
- Create necessary directories

### Docker

```bash
# Build production image
docker build -t gradeloop/clone-detection:latest .

# Run container
docker run -p 8000:8000 gradeloop/clone-detection:latest
```

## Usage

### Training

Train the Random Forest classifier using the ToMa dataset with a 70:15:15 split:

```bash
python scripts/train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o data/models/clone_classifier.joblib \
  -l java \
  -n 10000
```

**Training Options:**
- `-d, --dataset`: Path to ToMa dataset
- `-s, --source-dir`: Path to source code files
- `-o, --output`: Output path for trained model
- `-l, --language`: Programming language (python/java/c)
- `-n, --sample-size`: Number of pairs to sample
- `--n-estimators`: Number of trees in Random Forest (default: 100)
- `--max-depth`: Maximum tree depth (default: 10)

### Evaluation

#### Evaluate on BigCloneBench

```bash
python scripts/evaluate_bcb.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o reports/evaluations/bcb_evaluation.json \
  -l java \
  -n 5000
```

#### Evaluate on ToMa Dataset

```bash
python scripts/evaluate_toma.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/toma-dataset \
  -o reports/evaluations/toma_evaluation.json \
  -l java \
  -n 5000
```

### Export Results

Export evaluation results to multiple formats:

```bash
python scripts/export_results.py \
  -i reports/evaluations/ \
  -o reports/results/ \
  -f all \
  --experiment-name "My-Experiment"
```

**Export Formats:**
- JSON: Machine-readable format
- CSV: Spreadsheet-compatible
- HTML: Interactive web report
- Markdown: Documentation-friendly

## ToMa Dataset Type Mapping

The ToMa dataset uses the following type encoding:

| ToMa Type | Clone Type | Description |
|-----------|------------|-------------|
| 1 | Type-1 | Exact clones |
| 2 | Type-2 | Renamed clones |
| 3 | Type-3 (strong) | Modified clones (strong) |
| 4 | Type-3 (moderate) | Modified clones (moderate) |
| 5 | Type-4 | Semantic clones |

Types 3 and 4 are both mapped to Type-3 in the evaluation.

## Project Structure

```
cipas-service-syntax/
├── src/
│   ├── parser/           # Tree-sitter parser engine
│   │   ├── engine.py     # ParserEngine class
│   │   └── fragmenter.py # Code fragment extraction
│   ├── nicad/            # NiCAD normalization pipeline
│   │   ├── noise_removal.py
│   │   ├── pretty_printer.py
│   │   ├── blind_renamer.py
│   │   ├── lcs_matcher.py
│   │   └── pipeline.py
│   ├── toma/             # ToMA IR transformation
│   │   ├── mapper.py     # 15-type token schema
│   │   ├── features.py   # 6D feature extraction
│   │   └── pipeline.py
│   ├── ml/               # Machine learning components
│   │   ├── inverted_index.py
│   │   ├── faiss_index.py
│   │   ├── classifier.py
│   │   └── bcb_training.py
│   └── evaluation/       # Evaluation & reporting
│       ├── bcb_evaluator.py
│       └── report_generator.py
├── config/
│   └── languages.yaml    # Language configurations
├── data/
│   ├── grammars/         # Compiled Tree-sitter grammars
│   ├── models/           # Trained ML models
│   └── indices/          # FAISS indices
├── docs/
│   └── PIPELINE_GUIDE.md # Comprehensive pipeline guide
├── scripts/
│   ├── setup_pipeline.sh # Pipeline setup script
│   ├── train_model.py    # Model training script
│   ├── evaluate_bcb.py   # BigCloneBench evaluation
│   ├── evaluate_toma.py  # ToMa dataset evaluation
│   └── export_results.py # Results export script
├── reports/
│   ├── evaluations/      # Evaluation results
│   └── results/          # Exported reports
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── requirements.txt
├── pyproject.toml
├── Dockerfile
└── README.md
```

## Configuration

### languages.yaml

```yaml
languages:
  python:
    name: "Python"
    grammar_path: "data/grammars/tree-sitter-python"
    library_file: "libpython.so"
    file_extensions: [".py"]
    fragment_queries:
      function: "(function_definition) @func"
      class: "(class_definition) @class"

  java:
    name: "Java"
    grammar_path: "data/grammars/tree-sitter-java"
    library_file: "libjava.so"
    file_extensions: [".java"]
    fragment_queries:
      method: "(method_declaration) @method"
      constructor: "(constructor_declaration) @constructor"
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_parser_engine.py -v
```

## Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| Parse (1000 LOC) | < 50ms | Tree-sitter CST |
| Fragment extraction | < 10ms | Per method |
| NiCAD comparison | < 100ms | Type-1/Type-2 |
| ToMA feature extraction | < 50ms | 6D vector |
| FAISS search (10K vectors) | < 10ms | k=10 neighbors |

## Expected Performance

### Training (70:15:15 split)

| Metric | Target |
|--------|--------|
| Accuracy | > 0.90 |
| Precision | > 0.88 |
| Recall | > 0.88 |
| F1-Score | > 0.88 |

### BigCloneBench Evaluation

| Clone Type | Target F1-Score |
|------------|-----------------|
| Type-1 | > 0.95 |
| Type-2 | > 0.90 |
| ST3 | > 0.85 |
| MT3 | > 0.75 |
| WT3 | > 0.60 |

## Documentation

- [Pipeline Guide](docs/PIPELINE_GUIDE.md) - Comprehensive guide for setup, training, and evaluation
- [Scripts README](scripts/README.md) - Detailed script documentation

## Troubleshooting

### Common Issues

**Tree-sitter Grammar Compilation Fails:**
```bash
# Install build tools
sudo apt-get install build-essential  # Ubuntu/Debian
xcode-select --install  # macOS

# Re-run setup
./scripts/setup_pipeline.sh
```

**Memory Error During Training:**
```bash
# Reduce sample size
python scripts/train_model.py -n 5000
```

**Missing Source Code Files:**
```bash
# Verify dataset path
ls ../../../../datasets/toma-dataset/id2sourcecode/
```

## License

MIT License - See LICENSE file for details.

## Contributing

See [CONTRIBUTING.md](../../../../CONTRIBUTING.md) for contribution guidelines.

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [NiCAD Clone Detector](https://www.cs.uregina.ca/Research/Projects/NiCAD/)
- [ToMa Dataset](https://github.com/ToMa-clone/ToMa)
- [BigCloneBench](https://github.com/clonebench/BigCloneBench)
- [FAISS Library](https://github.com/facebookresearch/faiss)
- [scikit-learn Random Forest](https://scikit-learn.org/stable/modules/ensemble.html#forest)
