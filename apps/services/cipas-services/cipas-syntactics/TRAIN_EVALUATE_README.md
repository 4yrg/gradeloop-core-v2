# TOMA Training & BigCloneBench Evaluation

Scripts for training a code clone detection model on TOMA datasets and evaluating on BigCloneBench balanced dataset.

## Overview

This pipeline consists of two scripts:
1. **train_toma.py** - Trains on TOMA format datasets
2. **evaluate_bigclonebench.py** - Evaluates on BigCloneBench balanced dataset

## Quick Start

### Full Pipeline (Train + Evaluate)

```bash
cd apps/services/cipas-services/cipas-syntactics

./scripts/train_evaluate_pipeline.sh \
    --toma-dataset /path/to/toma-dataset \
    --bcb-dataset /path/to/bigclonebench_balanced.json
```

### Training Only

```bash
./scripts/train_evaluate_pipeline.sh \
    --toma-dataset /path/to/toma-dataset \
    --train-only \
    --n-estimators 200 \
    --max-depth 8
```

### Evaluation Only

```bash
./scripts/train_evaluate_pipeline.sh \
    --bcb-dataset /path/to/bigclonebench_balanced.json \
    --model-name toma_trained_xgb.pkl \
    --eval-only
```

## Individual Scripts

### Training Script (train_toma.py)

Train on TOMA dataset:

```bash
poetry run python train_toma.py \
    --dataset /path/to/toma-dataset \
    --model-name toma_trained_xgb.pkl
```

**Training Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--dataset` | (required) | Path to TOMA dataset directory |
| `--model-name` | `toma_trained_xgb.pkl` | Output model filename |
| `--n-estimators` | `100` | Number of trees |
| `--max-depth` | `6` | Maximum tree depth |
| `--learning-rate` | `0.1` | Learning rate (eta) |
| `--subsample` | `0.8` | Training instance subsample ratio |
| `--colsample-bytree` | `0.8` | Column subsample ratio per tree |
| `--sample-size` | None | Sample size per class |
| `--clone-types` | None | Clone types to include (1-5) |
| `--no-node-types` | False | Disable node type features |
| `--use-gpu` | False | Enable GPU acceleration |
| `--no-cv` | False | Disable cross-validation |

### Evaluation Script (evaluate_bigclonebench.py)

Evaluate on BigCloneBench balanced dataset:

```bash
poetry run python evaluate_bigclonebench.py \
    --model models/toma_trained_xgb.pkl \
    --dataset /path/to/bigclonebench_balanced.json
```

**Evaluation Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--model` | (required) | Path to trained model (.pkl) |
| `--dataset` | (required) | Path to BigCloneBench JSON file |
| `--sample-size` | None | Sample size for faster evaluation |
| `--no-report` | False | Disable detailed report |
| `--output-json` | None | Save metrics to JSON file |

## TOMA Dataset Format

The TOMA dataset should have the following structure:

```
toma-dataset/
├── clone.csv           # FUNCTION_ID_ONE, FUNCTION_ID_TWO, CLONE_TYPE, SIM1, SIM2
├── nonclone.csv        # FUNCTION_ID_ONE, FUNCTION_ID_TWO
└── id2sourcecode/      # Directory with .java files named by function ID
    ├── 123.java
    ├── 456.java
    └── ...
```

## BigCloneBench Balanced Dataset Format

The BigCloneBench balanced dataset should be a JSON file with:

```json
[
  {
    "code1": "public void foo() { ... }",
    "code2": "public void bar() { ... }",
    "label": 1,
    "clone_type": 3,
    ...
  },
  ...
]
```

## Example Usage

### 1. Train on TOMA with specific clone types

```bash
poetry run python train_toma.py \
    --dataset /path/to/toma-dataset \
    --model-name type3_only_xgb.pkl \
    --clone-types 3 \
    --sample-size 10000 \
    --n-estimators 150 \
    --max-depth 8
```

### 2. Evaluate on full BigCloneBench balanced dataset

```bash
poetry run python evaluate_bigclonebench.py \
    --model models/type3_only_xgb.pkl \
    --dataset /path/to/bigclonebench_balanced.json \
    --output-json results/type3_metrics.json
```

### 3. Quick evaluation with sample

```bash
poetry run python evaluate_bigclonebench.py \
    --model models/toma_trained_xgb.pkl \
    --dataset /path/to/bigclonebench_balanced.json \
    --sample-size 5000
```

## Expected Output

### Training Output
```
================================================================================
TOMA Dataset Model Training
================================================================================
Dataset: /path/to/toma-dataset
Language: java
Model output: models/toma_trained_xgb.pkl
================================================================================
Loading clones from /path/to/toma-dataset/clone.csv...
Processing 5000 clone pairs...
Loaded 4823 clone pairs with valid code
Loading non-clones from /path/to/toma-dataset/nonclone.csv...
Processing 5000 non-clone pairs...
Loaded 4891 non-clone pairs with valid code
Loaded 9714 code pairs
Class distribution: 4823 clones (49.6%), 4891 non-clones (50.4%)

Extracting hybrid syntactic + structural features...
Feature matrix shape: (9714, 48)
Number of features: 48

Training XGBoost classifier...
...
Model saved to /path/to/models/toma_trained_xgb.pkl

Training Complete!
accuracy: 0.9234
precision: 0.9156
recall: 0.9312
f1: 0.9233
```

### Evaluation Output
```
================================================================================
BigCloneBench Balanced Dataset Evaluation
================================================================================
Model: models/toma_trained_xgb.pkl
Dataset: /path/to/bigclonebench_balanced.json
================================================================================

================================================================================
EVALUATION REPORT
================================================================================
Dataset: /path/to/bigclonebench_balanced.json
Total pairs: 64223

--------------------------------------------------------------------------------
Accuracy:  0.8934
Precision: 0.8856
Recall:    0.9012
F1 Score:  0.8933
ROC AUC:   0.9478

Classification Report:
              precision    recall  f1-score   support

   Non-Clone       0.91      0.87      0.89     20000
       Clone       0.88      0.90      0.89     44223

Confusion Matrix:
[[17400  2600]
 [ 4380 39843]]
```

## Performance Tips

### For Faster Training
1. **Use a sample**: `--sample-size 5000`
2. **Disable node types**: `--no-node-types`
3. **Reduce trees**: `--n-estimators 50`
4. **Shallow trees**: `--max-depth 4`

### For Better Accuracy
1. **More trees**: `--n-estimators 200`
2. **Deeper trees**: `--max-depth 8`
3. **Lower learning rate**: `--learning-rate 0.05` (with more estimators)
4. **Include node types**: Default behavior

## Output Files

After training and evaluation:
- `models/<model_name>.pkl` - Trained XGBoost model
- `models/evaluation_metrics.json` - Evaluation metrics in JSON format

## Dependencies

Ensure you have the required dependencies installed:

```bash
cd apps/services/cipas-services/cipas-syntactics
poetry install
```
