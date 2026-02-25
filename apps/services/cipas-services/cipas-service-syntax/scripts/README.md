# Clone Detection Scripts

This directory contains all scripts for the clone detection pipeline.

## Scripts Overview

### Setup Scripts

| Script | Description |
|--------|-------------|
| `setup_pipeline.sh` | Complete pipeline setup (dependencies, grammars, directories) |

### Training Scripts

| Script | Description |
|--------|-------------|
| `train_model.py` | Train the Random Forest classifier on ToMa dataset |

### Evaluation Scripts

| Script | Description |
|--------|-------------|
| `evaluate_bcb.py` | Evaluate on BigCloneBench dataset (Type 1-3, non-clones) |
| `evaluate_toma.py` | Evaluate on ToMa dataset (Type 1-4) |

### Utility Scripts

| Script | Description |
|--------|-------------|
| `compare_samples.py` | Compare two code samples for clone detection |

### Export Scripts

| Script | Description |
|--------|-------------|
| `export_results.py` | Export evaluation results to JSON/CSV/HTML/Markdown |

### Legacy Scripts

| Script | Description |
|--------|-------------|
| `download_bcb.sh` | Download BigCloneBench dataset |
| `evaluate_bcb_jsonl.py` | Alternative BCB evaluation (JSONL format) |
| `quick_evaluate.py` | Quick evaluation script |
| `demo_clone_detection.py` | Demo script for clone detection |

---

## Quick Start Workflow

### 1. Setup

```bash
chmod +x setup_pipeline.sh
./setup_pipeline.sh
source ../.venv-cipas-syntax/bin/activate
```

### 2. Train

```bash
python train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o ../data/models/clone_classifier.joblib \
  -l java \
  -n 10000
```

### 3. Evaluate

```bash
# Evaluate on BigCloneBench
python evaluate_bcb.py \
  -m ../data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o ../reports/evaluations/bcb_evaluation.json

# Evaluate on ToMa
python evaluate_toma.py \
  -m ../data/models/clone_classifier.joblib \
  -d ../../../../datasets/toma-dataset \
  -o ../reports/evaluations/toma_evaluation.json
```

### 4. Export Results

```bash
python export_results.py \
  -i ../reports/evaluations/ \
  -o ../reports/results/ \
  -f all \
  --experiment-name "My-First-Experiment"
```

---

## Detailed Usage

### setup_pipeline.sh

Sets up the complete clone detection pipeline.

```bash
./setup_pipeline.sh
```

**What it does:**
- Creates Python virtual environment
- Installs all dependencies
- Downloads Tree-sitter grammars (Python, Java, C)
- Creates directory structure
- Verifies installation

**Output:**
- `.venv-cipas-syntax/` - Virtual environment
- `data/grammars/` - Tree-sitter grammars
- `data/models/` - Model storage
- `data/indices/` - FAISS indices
- `reports/` - Reports directory

---

### train_model.py

Trains the Random Forest classifier using ToMa dataset features.

**Usage:**
```bash
python train_model.py [OPTIONS]
```

**Required Options:**
- None (all options have defaults)

**Common Options:**
```bash
# Dataset path
-d, --dataset PATH          # Default: datasets/toma-dataset

# Source code directory
-s, --source-dir PATH       # Default: datasets/toma-dataset/id2sourcecode

# Model output path
-o, --output PATH           # Default: data/models/clone_classifier.joblib

# Programming language
-l, --language [python|java|c]  # Default: java

# Sample size
-n, --sample-size INT       # Default: 5000
```

**Training Configuration:**
```bash
# Model hyperparameters
--n-estimators INT          # Number of trees (default: 100)
--max-depth INT             # Maximum tree depth (default: 10)

# Split ratios (must sum to 1.0)
--train-ratio FLOAT         # Training ratio (default: 0.70)
--val-ratio FLOAT           # Validation ratio (default: 0.15)
--test-ratio FLOAT          # Test ratio (default: 0.15)
```

**Examples:**

1. Quick training (small sample):
```bash
python train_model.py -n 1000
```

2. Full-scale training:
```bash
python train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o ../data/models/clone_classifier_full.joblib \
  -l java \
  -n 50000 \
  --n-estimators 200 \
  --max-depth 20
```

**Output Files:**
- `data/models/clone_classifier.joblib` - Trained model
- `data/models/clone_classifier.json` - Training metrics
- `reports/training_report.json` - Detailed training report
- `reports/training.log` - Training log

---

### evaluate_bcb.py

Evaluates the trained model on BigCloneBench dataset.

**Usage:**
```bash
python evaluate_bcb.py [OPTIONS]
```

**Required Options:**
```bash
-m, --model PATH            # Path to trained model
-d, --bcb PATH              # Path to BigCloneBench directory
```

**Optional Options:**
```bash
-o, --output PATH           # Output file (default: reports/evaluations/bcb_evaluation.json)
-l, --language [python|java|c]  # Language (default: java)
-n, --sample-size INT       # Sample size (default: 5000)
```

**Examples:**

1. Standard evaluation:
```bash
python evaluate_bcb.py \
  -m ../data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -o ../reports/evaluations/bcb_evaluation.json
```

2. Large-scale evaluation:
```bash
python evaluate_bcb.py \
  -m ../data/models/clone_classifier.joblib \
  -d ../../../../datasets/bigclonebench \
  -n 10000 \
  -o ../reports/evaluations/bcb_large_evaluation.json
```

**Clone Type Classification:**

BigCloneBench classifies clones by similarity:
- **Type-1**: Exact clones (copy-paste)
- **Type-2**: Renamed clones (identifier/literal renaming)
- **ST3**: Strong Type-3 (similarity ≥ 0.7)
- **MT3**: Moderate Type-3 (0.5 ≤ similarity < 0.7)
- **WT3**: Weak Type-3 (similarity < 0.5)

**Output Files:**
- `reports/evaluations/bcb_evaluation.json` - Evaluation results
- `reports/bcb_evaluation.log` - Evaluation log

---

### evaluate_toma.py

Evaluates the trained model on ToMa dataset.

**Usage:**
```bash
python evaluate_toma.py [OPTIONS]
```

**Required Options:**
```bash
-m, --model PATH            # Path to trained model
-d, --toma PATH             # Path to ToMa dataset directory
```

**Optional Options:**
```bash
-o, --output PATH           # Output file (default: reports/evaluations/toma_evaluation.json)
-l, --language [python|java|c]  # Language (default: java)
-n, --sample-size INT       # Sample size (default: 5000)
```

**ToMa Type Mapping:**
```
Type 1 → Type-1 (exact clones)
Type 2 → Type-2 (renamed clones)
Type 3 → Type-3 strong (mapped to Type-3)
Type 4 → Type-3 moderate (mapped to Type-3)
Type 5 → Type-4 semantic (mapped to Type-4)
```

**Output Files:**
- `reports/evaluations/toma_evaluation.json` - Evaluation results
- `reports/toma_evaluation.log` - Evaluation log

---

### compare_samples.py

Compares two code samples to determine if they are clones.

**Usage:**
```bash
# Compare two files
python compare_samples.py file1.java file2.java

# Compare code snippets
python compare_samples.py --code1 "def hello(): pass" --code2 "def hi(): pass"
```

**Options:**
```bash
# Input (mutually exclusive)
FILES                       # Two files to compare
--code1 TEXT                # First code snippet
--code2 TEXT                # Second code snippet

# Model options
-m, --model PATH            # Path to trained model (default: data/models/clone_classifier.joblib)
-l, --language [python|java|c]  # Language (default: java)
-t, --threshold FLOAT       # Classification threshold (default: 0.5)
-o, --output PATH           # Save results to JSON file
-q, --quiet                 # Only output JSON results
```

**Examples:**

1. Compare two Java files:
```bash
python compare_samples.py \
  ../../../../datasets/toma-dataset/id2sourcecode/10000061.java \
  ../../../../datasets/toma-dataset/id2sourcecode/23594635.java
```

2. Compare Python code snippets:
```bash
python compare_samples.py \
  --code1 "def calculate_sum(a, b): return a + b" \
  --code2 "def compute_total(x, y): return x + y" \
  -l python
```

3. Compare with JSON output:
```bash
python compare_samples.py \
  file1.java file2.java \
  -o reports/results/comparison.json \
  --quiet
```

**Output:**
- Console report with similarity metrics and clone detection result
- Optional JSON file with detailed results

**Features:**
- Supports multiple languages (Python, Java, C)
- Extracts ToMA 6D features
- Uses trained Random Forest model for prediction
- Provides similarity metrics (Levenshtein, Jaro, Jaccard, Dice)
- Shows feature importances
- Token preview for analysis

---

### export_results.py

Exports evaluation results to multiple formats.

**Usage:**
```bash
python export_results.py [OPTIONS]
```

**Options:**
```bash
-i, --input PATH            # Input directory (default: reports/evaluations/)
-o, --output PATH           # Output directory (default: reports/results/)
-f, --format [json|csv|html|md|all]  # Export format (default: all)
--experiment-name NAME      # Experiment name (default: auto-generated)
```

**Examples:**

1. Export all formats:
```bash
python export_results.py \
  -i ../reports/evaluations/ \
  -o ../reports/results/ \
  -f all
```

2. Export HTML only:
```bash
python export_results.py \
  -i ../reports/evaluations/ \
  -o ../reports/results/ \
  -f html \
  --experiment-name "Experiment-1"
```

3. Export JSON for further processing:
```bash
python export_results.py \
  -i ../reports/evaluations/ \
  -o ../reports/results/ \
  -f json
```

**Output Formats:**

1. **JSON** (`consolidated_results.json`):
   - Machine-readable
   - Suitable for further processing
   - Contains all metrics

2. **CSV** (`consolidated_results.csv`):
   - Spreadsheet-compatible
   - Easy to import into Excel/Google Sheets
   - Simple key-value format

3. **HTML** (`consolidated_results.html`):
   - Interactive web report
   - Visual metric cards
   - Responsive design

4. **Markdown** (`consolidated_results.md`):
   - Documentation-friendly
   - GitHub-compatible
   - Easy to include in reports

---

## Workflow Examples

### Example 1: Quick Development Cycle

```bash
# 1. Setup (one-time)
./setup_pipeline.sh
source ../.venv-cipas-syntax/bin/activate

# 2. Train with small sample
python train_model.py -n 1000 -o ../data/models/dev_model.joblib

# 3. Quick evaluation
python evaluate_toma.py \
  -m ../data/models/dev_model.joblib \
  -d ../../../../datasets/toma-dataset \
  -n 1000
```

### Example 2: Full Experiment

```bash
# 1. Train full model
python train_model.py \
  -d ../../../../datasets/toma-dataset \
  -s ../../../../datasets/toma-dataset/id2sourcecode \
  -o ../data/models/full_model.joblib \
  -l java \
  -n 50000 \
  --n-estimators 200

# 2. Evaluate on both datasets
python evaluate_bcb.py \
  -m ../data/models/full_model.joblib \
  -d ../../../../datasets/bigclonebench \
  -n 10000

python evaluate_toma.py \
  -m ../data/models/full_model.joblib \
  -d ../../../../datasets/toma-dataset \
  -n 10000

# 3. Export results
python export_results.py \
  -i ../reports/evaluations/ \
  -o ../reports/results/ \
  -f all \
  --experiment-name "Full-Experiment-Java-50k"
```

### Example 3: Comparative Study

```bash
# Train multiple models with different configurations
python train_model.py -n 10000 --n-estimators 100 -o model_100.joblib
python train_model.py -n 10000 --n-estimators 200 -o model_200.joblib
python train_model.py -n 10000 --n-estimators 300 -o model_300.joblib

# Evaluate all models
for model in model_100 joblib model_200.joblib model_300.joblib; do
  python evaluate_toma.py -m $model -n 5000
done

# Export comparative results
python export_results.py \
  --experiment-name "Comparative-Study-N-Estimators"
```

---

## Troubleshooting

### Common Issues

**Issue**: Script not found
```bash
# Ensure you're in the scripts directory
cd apps/services/cipas-services/cipas-service-syntax/scripts
```

**Issue**: Permission denied
```bash
chmod +x setup_pipeline.sh
```

**Issue**: Module not found
```bash
# Activate virtual environment
source ../.venv-cipas-syntax/bin/activate
```

**Issue**: Dataset not found
```bash
# Verify dataset paths
ls -la ../../../../datasets/toma-dataset/
ls -la ../../../../datasets/bigclonebench/
```

---

## Performance Tips

1. **Use appropriate sample sizes**
   - Development: 1,000-5,000
   - Testing: 10,000-50,000
   - Production: 100,000+

2. **Parallel training**
   - Run multiple training jobs with different hyperparameters
   - Compare results using export script

3. **Incremental evaluation**
   - Start with small samples for quick feedback
   - Scale up for final evaluation

4. **Resource management**
   - Training is CPU-intensive
   - Evaluation is memory-intensive
   - Monitor system resources

---

## Additional Resources

- [Pipeline Guide](../docs/PIPELINE_GUIDE.md)
- [Main README](../README.md)
- [Project Documentation](../../../../docs/)
