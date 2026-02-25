# Clone Detection Service

Language-agnostic code clone detection using Tree-sitter parsing, NiCAD normalization, ToMA IR transformation, and Machine Learning classification.

## Overview

This service implements a comprehensive code clone detection pipeline supporting:

- **Type-1 Clones**: Exact clones (copy-paste with whitespace/comment changes)
- **Type-2 Clones**: Renamed clones (identifier/literal renaming)
- **Type-3 Clones**: Modified clones (statements added/removed/refactored)

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
│  └── JSON/HTML report generation                                │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.11+
- GCC/G++ for Tree-sitter grammar compilation
- Git for cloning grammar repositories

### Quick Start

```bash
# Clone the repository
cd /home/iamdasun/Projects/4yrg/gradeloop-core-v2/apps/services/cipas-services/cipas-service-syntax

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup Tree-sitter grammars
chmod +x scripts/setup_grammars.sh
./scripts/setup_grammars.sh
```

### Docker

```bash
# Build production image
docker build -t gradeloop/clone-detection:latest .

# Run container
docker run -p 8000:8000 gradeloop/clone-detection:latest
```

## Usage

### Basic Example

```python
from src.parser import ParserEngine, Fragmenter
from src.nicad import NiCADPipeline
from src.toma import ToMAPipeline

# Initialize parser
engine = ParserEngine("config/languages.yaml")
fragmenter = Fragmenter(engine)

# Parse and extract fragments
with open("example.py", "rb") as f:
    source = f.read()

fragments = fragmenter.extract_fragments(
    source_code=source,
    language="python",
    source_file="example.py"
)

# NiCAD pipeline for Type-1/Type-2 detection
nicad = NiCADPipeline("python", similarity_threshold=0.85)

# ToMA pipeline for Type-3 detection
toma = ToMAPipeline("python")

# Process fragments...
```

### NiCAD Pipeline (Type-1 & Type-2)

```python
from src.nicad import NiCADPipeline

pipeline = NiCADPipeline("java", similarity_threshold=0.85)

result = pipeline.detect_clone(
    fragment_a=frag_a,
    fragment_b=frag_b,
    tree_a=tree_a,
    tree_b=tree_b
)

if result.is_clone:
    print(f"Clone detected: {result.clone_type}")
    print(f"Similarity: {result.similarity_score:.2%}")
```

### ToMA Pipeline (Type-3)

```python
from src.toma import ToMAPipeline

pipeline = ToMAPipeline("python")

result = pipeline.extract_features(
    fragment_a=frag_a,
    fragment_b=frag_b,
    tree_a=tree_a,
    tree_b=tree_b
)

print(f"Feature vector: {result.feature_vector}")
# Output: (45.0, 0.75, 0.82, 0.85, 0.68, 0.81)
```

### ML Classification

```python
from src.ml import RandomForestClassifier, InvertedIndex, FAISSIndex
import numpy as np

# Train classifier
clf = RandomForestClassifier(n_estimators=100, max_depth=10)
metrics = clf.train(X_train, y_train)

print(f"F1-Score: {metrics['f1_score']:.4f}")

# Use inverted index for search pruning
index = InvertedIndex()
index.add_fragments(fragment_data)
candidates = index.get_candidates(query_tokens)

# Use FAISS for approximate nearest neighbor search
faiss = FAISSIndex(dimension=6, index_type='IVF')
faiss.add(vectors, fragment_ids)
results = faiss.search(query_vector, k=10)
```

### Evaluation

```python
from src.evaluation import BCBEvaluator, ReportGenerator

# Evaluate against BigCloneBench
evaluator = BCBEvaluator("datasets/bigclonebench/groundTruth.csv")

predictions = [
    ("frag_1", "frag_2", 0.92),
    ("frag_3", "frag_4", 0.45),
    # ...
]

metrics = evaluator.evaluate(predictions, threshold=0.5)
print(f"Precision: {metrics.precision:.4f}")
print(f"Recall: {metrics.recall:.4f}")
print(f"F1-Score: {metrics.f1_score:.4f}")

# Generate report
from src.evaluation import ReportGenerator, CloneMatch

generator = ReportGenerator("reports/")
generator.generate_json_report(matches, metrics)
generator.generate_html_report(matches, metrics)
```

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
├── scripts/
│   └── setup_grammars.sh # Grammar compilation script
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── reports/              # Generated reports
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

## API Reference

### ParserEngine

| Method | Description |
|--------|-------------|
| `parse(source_code, language)` | Parse source code to CST |
| `load_language(language)` | Load grammar for language |
| `get_supported_languages()` | List supported languages |

### Fragmenter

| Method | Description |
|--------|-------------|
| `extract_fragments(source_code, language, source_file)` | Extract code fragments |
| `extract_from_file(file_path, language)` | Extract from file directly |

### NiCADPipeline

| Method | Description |
|--------|-------------|
| `detect_clone(fragment_a, fragment_b, tree_a, tree_b)` | Detect Type-1/Type-2 clones |
| `compare_fragments_batch(fragments, trees)` | Batch comparison |

### ToMAPipeline

| Method | Description |
|--------|-------------|
| `extract_features(fragment_a, fragment_b, tree_a, tree_b)` | Extract 6D features |
| `get_feature_matrix(fragments, trees)` | Get feature matrix for all pairs |

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

## License

MIT License - See LICENSE file for details.

## Contributing

See [CONTRIBUTING.md](../../../../CONTRIBUTING.md) for contribution guidelines.

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [NiCAD Clone Detector](https://www.cs.uregina.ca/Research/Projects/NiCAD/)
- [ToMA Paper](https://ieeexplore.ieee.org/document/TODO)
- [BigCloneBench](https://github.com/clonebench/BigCloneBench)
- [FAISS Library](https://github.com/facebookresearch/faiss)
