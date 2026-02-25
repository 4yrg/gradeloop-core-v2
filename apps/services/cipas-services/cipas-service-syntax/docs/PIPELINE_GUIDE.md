# Clone Detection Pipeline Guide

Complete guide for setting up, training, and evaluating the code clone detection pipeline.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Pipeline Setup](#pipeline-setup)
4. [Training](#training)
5. [Evaluation](#evaluation)
6. [Results Export](#results-export)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This pipeline implements a comprehensive code clone detection system using:

- **Tree-sitter Parsing**: Language-agnostic code parsing (Python, Java, C)
- **NiCAD Normalization**: Type-1 and Type-2 clone detection
- **ToMA IR Transformation**: Type-3 clone feature extraction
- **Machine Learning**: Random Forest classifier for clone detection

### Clone Types Detected

| Type | Description | Similarity | Example |
|------|-------------|------------|---------|
| **Type-1** | Exact clones | 100% | Copy-paste with whitespace/comment changes |
| **Type-2** | Renamed clones | ~90-100% | Identifier/literal renaming |
| **Type-3** | Modified clones | ~50-90% | Statements added/removed/refactored |
| **Type-4** | Semantic clones | <50% | Different implementation, same functionality |

### ToMa Dataset Type Mapping

The ToMa dataset uses the following type encoding:

```
Type 1 → Type-1 (exact clones)
Type 2 → Type-2 (renamed clones)
Type 3 → Type-3 strong (mapped to Type-3)
Type 4 → Type-3 moderate (mapped to Type-3)
Type 5 → Type-4 semantic (mapped to Type-4)
```

---

## Quick Start

```bash
# Navigate to the service directory
cd apps/services/cipas-services/cipas-service-syntax

# 1. Setup pipeline
chmod +x scripts/setup_pipeline.sh
./scripts/setup_pipeline.sh

# 2. Activate virtual environment
source .venv-cipas-syntax/bin/activate

# 3. Train the model
python scripts/train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o data/models/clone_classifier.joblib \
  -l java \
  -n 10000

# 4. Evaluate on BigCloneBench
python scripts/evaluate_bcb.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o reports/evaluations/bcb_evaluation.json

# 5. Export results
python scripts/export_results.py \
  -i reports/evaluations/ \
  -o reports/results/ \
  -f all
```

---

## Pipeline Setup

### Prerequisites

- **Python**: 3.11 or higher
- **GCC/G++**: For Tree-sitter grammar compilation
- **Git**: For downloading grammars
- **Disk Space**: ~2GB for datasets and models

### Step-by-Step Setup

#### 1. Run Setup Script

```bash
chmod +x scripts/setup_pipeline.sh
./scripts/setup_pipeline.sh
```

The setup script will:
- Create a Python virtual environment
- Install all dependencies
- Download Tree-sitter grammars (Python, Java, C)
- Create necessary directories

#### 2. Verify Installation

```bash
source .venv-cipas-syntax/bin/activate
python -c "import tree_sitter; import sklearn; import pandas; print('✓ All dependencies installed')"
```

#### 3. Directory Structure

After setup, your directory structure should look like:

```
cipas-service-syntax/
├── .venv-cipas-syntax/      # Virtual environment
├── data/
│   ├── grammars/            # Tree-sitter grammars
│   ├── models/              # Trained models
│   └── indices/             # FAISS indices
├── reports/
│   ├── evaluations/         # Evaluation results
│   └── results/             # Exported reports
├── scripts/                 # Pipeline scripts
└── src/                     # Source code
```

---

## Training

### Training on ToMa Dataset

The training script uses a **70:15:15** split for training, validation, and testing.

#### Basic Training

```bash
python scripts/train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o data/models/clone_classifier.joblib \
  -l java \
  -n 10000
```

#### Training Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--dataset` | `-d` | `datasets/toma-dataset` | Path to ToMa dataset |
| `--source-dir` | `-s` | `datasets/toma-dataset/id2sourcecode` | Source code directory |
| `--output` | `-o` | `data/models/clone_classifier.joblib` | Model output path |
| `--language` | `-l` | `java` | Programming language (python/java/c) |
| `--sample-size` | `-n` | `5000` | Number of pairs to sample |
| `--n-estimators` | | `100` | Number of trees in Random Forest |
| `--max-depth` | | `10` | Maximum tree depth |
| `--train-ratio` | | `0.70` | Training set ratio |
| `--val-ratio` | | `0.15` | Validation set ratio |
| `--test-ratio` | | `0.15` | Test set ratio |

#### Example: Large-Scale Training

```bash
python scripts/train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o data/models/clone_classifier_large.joblib \
  -l java \
  -n 50000 \
  --n-estimators 200 \
  --max-depth 20
```

#### Training Output

After training completes, you'll find:

1. **Model File**: `data/models/clone_classifier.joblib`
2. **Metrics File**: `data/models/clone_classifier.json`
3. **Training Report**: `reports/training_report.json`
4. **Training Log**: `reports/training.log`

#### Expected Performance

| Metric | Target |
|--------|--------|
| Accuracy | > 0.90 |
| Precision | > 0.88 |
| Recall | > 0.88 |
| F1-Score | > 0.88 |

---

## Evaluation

### Evaluating on BigCloneBench

BigCloneBench is the standard benchmark for code clone detection.

#### Basic Evaluation

```bash
python scripts/evaluate_bcb.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o reports/evaluations/bcb_evaluation.json \
  -l java \
  -n 5000
```

#### Evaluation Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--model` | `-m` | (required) | Path to trained model |
| `--bcb` | `-d` | (required) | Path to BigCloneBench |
| `--output` | `-o` | `reports/evaluations/bcb_evaluation.json` | Output file |
| `--language` | `-l` | `java` | Programming language |
| `--sample-size` | `-n` | `5000` | Number of pairs to evaluate |

#### Clone Type Classification (BigCloneBench)

BigCloneBench classifies Type-3 clones by similarity:

- **ST3** (Strong Type-3): similarity ≥ 0.7
- **MT3** (Moderate Type-3): 0.5 ≤ similarity < 0.7
- **WT3** (Weak Type-3): similarity < 0.5

### Evaluating on ToMa Dataset

```bash
python scripts/evaluate_toma.py \
  -m data/models/clone_classifier.joblib \
  -d ../../../../datasets/toma-dataset \
  -o reports/evaluations/toma_evaluation.json \
  -l java \
  -n 5000
```

#### ToMa Type Classification

The ToMa evaluation reports performance on:

- **Type-1**: Exact clones
- **Type-2**: Renamed clones
- **Type-3**: Modified clones (includes types 3+4 from original dataset)
- **Type-4**: Semantic clones (type 5 from original dataset)

### Evaluation Output

After evaluation, you'll find:

1. **JSON Results**: `reports/evaluations/bcb_evaluation.json`
2. **Evaluation Log**: `reports/bcb_evaluation.log`

#### Expected Performance on BigCloneBench

| Clone Type | Target F1-Score |
|------------|-----------------|
| Type-1 | > 0.95 |
| Type-2 | > 0.90 |
| ST3 | > 0.85 |
| MT3 | > 0.75 |
| WT3 | > 0.60 |

---

## Results Export

Export evaluation results to multiple formats for reporting.

### Basic Export

```bash
python scripts/export_results.py \
  -i reports/evaluations/ \
  -o reports/results/ \
  -f all
```

### Export Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--input` | `-i` | `reports/evaluations/` | Input directory |
| `--output` | `-o` | `reports/results/` | Output directory |
| `--format` | `-f` | `all` | Format (json/csv/html/md/all) |
| `--experiment-name` | | auto | Experiment name |

### Export Formats

1. **JSON**: Machine-readable format for further processing
2. **CSV**: Spreadsheet-compatible format
3. **HTML**: Interactive web report
4. **Markdown**: Documentation-friendly format

### Example: HTML Report

```bash
python scripts/export_results.py \
  -i reports/evaluations/ \
  -o reports/results/ \
  -f html \
  --experiment-name "ToMa-Training-Run-1"
```

Open `reports/results/consolidated_results.html` in a browser to view the interactive report.

---

## Troubleshooting

### Common Issues

#### 1. Tree-sitter Grammar Compilation Fails

**Error**: `tree-sitter failed to compile grammar`

**Solution**:
```bash
# Install build tools
sudo apt-get install build-essential  # Ubuntu/Debian
# or
xcode-select --install  # macOS

# Re-run setup
./scripts/setup_pipeline.sh
```

#### 2. Missing Source Code Files

**Warning**: `Missing files for pair (id1, id2)`

**Solution**: Verify the source code directory path:
```bash
ls ../../../../datasets/toma-dataset/id2sourcecode/ | head
```

#### 3. Memory Error During Training

**Error**: `MemoryError: Unable to allocate...`

**Solution**: Reduce sample size:
```bash
python scripts/train_model.py -n 5000  # Instead of 50000
```

#### 4. Model Loading Error

**Error**: `FileNotFoundError: [Errno 2] No such file or directory`

**Solution**: Check the model path:
```bash
ls -la data/models/
```

#### 5. Low Accuracy/F1-Score

**Problem**: Model performance below expected thresholds

**Solutions**:
- Increase training sample size: `-n 20000`
- Increase number of trees: `--n-estimators 200`
- Increase tree depth: `--max-depth 20`
- Verify dataset integrity

### Getting Help

If you encounter issues not covered here:

1. Check the log files in `reports/`
2. Review the error message carefully
3. Verify all paths are correct
4. Ensure virtual environment is activated

---

## Performance Benchmarks

### Training Time

| Sample Size | Time (approx) |
|-------------|---------------|
| 5,000 pairs | ~2 minutes |
| 10,000 pairs | ~5 minutes |
| 50,000 pairs | ~25 minutes |

### Evaluation Time

| Sample Size | Time (approx) |
|-------------|---------------|
| 1,000 pairs | ~30 seconds |
| 5,000 pairs | ~2 minutes |
| 10,000 pairs | ~5 minutes |

---

## Best Practices

1. **Always use the virtual environment**
   ```bash
   source .venv-cipas-syntax/bin/activate
   ```

2. **Backup trained models**
   ```bash
   cp data/models/clone_classifier.joblib \
      data/models/clone_classifier_backup.joblib
   ```

3. **Document experiments**
   ```bash
   python scripts/export_results.py \
     --experiment-name "Experiment-1-Java-10k-samples"
   ```

4. **Use appropriate sample sizes**
   - Development: 1,000-5,000 pairs
   - Testing: 10,000-50,000 pairs
   - Production: 100,000+ pairs

5. **Monitor resource usage**
   - Training: CPU-intensive
   - Evaluation: Memory-intensive

---

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [NiCAD Clone Detector](https://www.cs.uregina.ca/Research/Projects/NiCAD/)
- [BigCloneBench](https://github.com/clonebench/BigCloneBench)
- [ToMa Dataset](https://github.com/ToMa-clone/ToMa)
- [scikit-learn Random Forest](https://scikit-learn.org/stable/modules/ensemble.html#forest)
