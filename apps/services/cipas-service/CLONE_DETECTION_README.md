# Clone Detection System

A multi-language code clone detection system using Tree-sitter CST parsing and machine learning. This system implements the TOMA (Token-based) approach with extended semantic feature fusion for detecting Type-1 through Type-4 clones.

## Overview

This system provides:

- **Multi-language Support**: Java, C, and Python via Tree-sitter
- **Two Detection Pipelines**:
  - **Pipeline A**: Syntactic similarity (Type-1/2/3 clones) using Random Forest
  - **Pipeline B**: Semantic feature fusion (Type-4 clones) using XGBoost
- **BigCloneBench Evaluation**: Benchmarking against industry-standard datasets

## Architecture

```
clone_detection/
├── tokenizers/           # Tree-sitter based tokenization
│   └── tree_sitter_tokenizer.py
├── features/             # Feature extraction pipelines
│   ├── syntactic_features.py   # Pipeline A (Jaccard, Dice, Levenshtein, Jaro)
│   └── semantic_features.py    # Pipeline B (CST + PDG-like features)
├── models/               # ML classifiers
│   └── classifiers.py    # Random Forest & XGBoost
├── evaluators/           # Evaluation utilities
└── utils/                # Common utilities
    └── common_setup.py
```

## Installation

### 1. Environment Setup

```bash
# Navigate to the service directory
cd apps/services/cipas-service

# Run the setup script
bash scripts/setup_env.sh
```

Or manually:

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .
```

### 2. Dependencies

The system requires:
- Python 3.14+
- Tree-sitter with language packages (java, c, python)
- scikit-learn
- XGBoost
- pandas, numpy
- python-Levenshtein

## Usage

### Quick Start - Full Pipeline

Run the complete training and evaluation pipeline:

```bash
python scripts/run_pipeline.py --all
```

### Individual Steps

#### 1. Train Type-3 Model (Syntactic)

```bash
python scripts/train_type3.py --sample-size 10000 --test
```

This trains a Random Forest classifier using 6 syntactic similarity features:
- Jaccard Similarity
- Dice Coefficient
- Levenshtein Distance & Ratio
- Jaro Similarity
- Jaro-Winkler Similarity

#### 2. Train Type-4 Model (Semantic)

```bash
python scripts/train_type4.py --sample-size 15000 --test
```

This trains an XGBoost classifier using 100+ fused semantic features:
- Traditional: LOC, keyword counts
- Syntactic (CST): Tree-sitter node frequencies
- Semantic (PDG-like): Dependency relationships

#### 3. Evaluate on BigCloneBench

```bash
python scripts/evaluate_bcb.py --sample-size 5000
```

Compares results against benchmarks:
- SourcererCC (token-based)
- ASTNN (tree-based)
- DeepSim (neural)

### Command-Line Options

#### run_pipeline.py

```
--setup          Check environment setup
--train-type3    Train Type-3 model only
--train-type4    Train Type-4 model only
--evaluate       Run BigCloneBench evaluation only
--all            Run complete pipeline
--type3-samples  Number of Type-3 training samples (default: 10000)
--type4-samples  Number of Type-4 training samples (default: 15000)
--eval-samples   Number of evaluation samples (default: 5000)
```

#### train_type3.py

```
--dataset        Dataset file (default: type-3.csv)
--sample-size    Training samples (default: 10000)
--test           Run evaluation after training
--eval-only      Skip training, only evaluate
```

#### train_type4.py

```
--dataset        Dataset file (default: type-5.csv for Type-4)
--sample-size    Training samples (default: 15000)
--test           Run evaluation after training
--eval-only      Skip training, only evaluate
```

## Dataset Structure

### TOMA Dataset

```
datasets/toma-dataset/
├── id2sourcecode/      # Source code files ({id}.java)
├── type-3.csv          # Type-3 clone pairs
├── type-4.csv          # Type-4 clone pairs (intermediate)
└── type-5.csv          # Type-4 clone pairs (final)
```

CSV Format: `id1, id2, label, similarity_line, similarity_token`

### BigCloneBench

```
datasets/bigclonebench/
└── bigclonebench.jsonl  # JSONL format with code pairs
```

## Feature Engineering

### Pipeline A: Syntactic Features (6 features)

| Feature | Description | Clone Types |
|---------|-------------|-------------|
| Jaccard | Set overlap | Type-1, Type-2 |
| Dice | Weighted overlap | Type-1, Type-2 |
| Levenshtein Distance | Edit distance | Type-3 |
| Levenshtein Ratio | Normalized edit | Type-3 |
| Jaro | Character matching | Type-2, Type-3 |
| Jaro-Winkler | Prefix-weighted Jaro | Type-2, Type-3 |

### Pipeline B: Semantic Features (100+ features)

**Traditional (7 features)**:
- Lines of Code (LOC)
- Keyword category counts (control, declaration, memory, import, exception)

**Syntactic/CST (30+ features)**:
- Function/method definitions
- Control structures (if, for, while, switch, try)
- Declarations and assignments
- Expressions and invocations

**Semantic/PDG-like (5 features)**:
- Control construct frequency
- Assignment patterns
- Function call patterns
- Return statements
- Binary operations

## Model Performance

### Expected Metrics (F1 Score)

| Clone Type | Model | Expected F1 |
|------------|-------|-------------|
| Type-1 | Random Forest | 95%+ |
| Type-2 | Random Forest | 92%+ |
| Type-3 | Random Forest | 90%+ |
| Type-4 | XGBoost | 85%+ |

### Speed Comparison

- **Random Forest (Type-3)**: ~65x faster than DeepSim
- **XGBoost (Type-4)**: CPU-only, suitable for LMS deployment

## Token Abstraction

For Type-2 clone detection, variable names are abstracted to `V`:

```java
// Original
int x = calculate(a, b);
int result = compute(param1, param2);

// After abstraction
V V = V(V, V);
V V = V(V, V);
```

This enables detection of structurally similar code with different identifiers.

## Token Type Mapping

The system uses 15 standardized token types covering 99.7% of code tokens:

1. MODIFIER (public, private, static, final)
2. TYPE (int, float, class, void)
3. CONTROL (if, else, for, while, return)
4. OPERATOR (+, -, *, /, ==, &&)
5. DELIMITER ((, ), {, }, ;, ,)
6. LITERAL (null, True, False, this)
7. NUMBER (numeric literals)
8. STRING (string literals)
9. IDENTIFIER (variable names → abstracted to V)
10. COMMENT (//, /*, #)
11. ANNOTATION (@)
12. FUNCTION (def, function, lambda)
13. IMPORT (import, include, from)
14. MEMORY (new, delete, malloc)
15. OTHER

## Saving and Loading Models

Models are automatically saved to `clone_detection/models/saved/`:

```python
# Save model
classifier.save("type3_rf.pkl")

# Load model
from clone_detection.models.classifiers import SyntacticClassifier
model = SyntacticClassifier.load("type3_rf.pkl")
```

## API Usage

### Programmatic Usage

```python
from clone_detection.tokenizers.tree_sitter_tokenizer import TreeSitterTokenizer
from clone_detection.features.syntactic_features import SyntacticFeatureExtractor
from clone_detection.models.classifiers import SyntacticClassifier

# Initialize
tokenizer = TreeSitterTokenizer()
feature_extractor = SyntacticFeatureExtractor()
model = SyntacticClassifier.load("type3_rf.pkl")

# Tokenize
code1 = "public void foo() { int x = 1; }"
code2 = "public void bar() { int y = 1; }"

tokens1 = tokenizer.tokenize(code1, 'java', abstract_identifiers=True)
tokens2 = tokenizer.tokenize(code2, 'java', abstract_identifiers=True)

# Extract features
features = feature_extractor.extract_features(tokens1, tokens2)

# Predict
prediction = model.predict(features.reshape(1, -1))
probability = model.predict_proba(features.reshape(1, -1))

print(f"Clone: {prediction[0]}, Confidence: {probability[0][1]:.4f}")
```

## Troubleshooting

### Tree-sitter Parser Issues

If Tree-sitter parsers fail to load:

```bash
# Reinstall language packages
pip install --force-reinstall tree-sitter-java tree-sitter-c tree-sitter-python
```

### Model Not Found

Ensure models are trained first:

```bash
python scripts/run_pipeline.py --train-type3 --train-type4
```

### Memory Issues

Reduce sample sizes:

```bash
python scripts/train_type3.py --sample-size 5000
python scripts/train_type4.py --sample-size 8000
```

## Performance Optimization

- **Parallel Processing**: Random Forest uses all CPU cores (`n_jobs=-1`)
- **Early Stopping**: XGBoost stops when validation loss plateaus
- **Feature Caching**: Token cache reduces redundant parsing
- **Sampling**: Large datasets are automatically sampled

## References

- Tree-sitter: https://tree-sitter.github.io/
- BigCloneBench: https://github.com/clonebench/BigCloneBench
- TOMA Approach: Token-based clone detection with abstraction
- XGBoost: https://xgboost.readthedocs.io/

## License

Part of the Gradeloop Core project.
