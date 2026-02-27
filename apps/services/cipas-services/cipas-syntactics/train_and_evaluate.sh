#!/bin/bash
# Train and Evaluate Syntactic Clone Detection Pipeline

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATASETS_DIR="$(dirname $(dirname $(dirname "$SCRIPT_DIR")))/datasets/bigclonebench"

echo "========================================"
echo "Train and Evaluate Syntactic Clone Detector"
echo "========================================"
echo ""

# Step 1: Extract balanced dataset (if not already done)
if [ ! -f "$DATASETS_DIR/bigclonebench_balanced.json" ]; then
    echo "Step 1: Extracting balanced dataset..."
    poetry run python extract_balanced_dataset.py \
        --input "$DATASETS_DIR/bigclonebench.jsonl" \
        --output "$DATASETS_DIR/bigclonebench_balanced.json" \
        --samples-per-class 20000 \
        --seed 42
else
    echo "Step 1: Balanced dataset already exists ✓"
fi

echo ""

# Step 2: Split balanced dataset into train/test (80/20)
echo "Step 2: Splitting dataset into train/test (80/20)..."
poetry run python split_dataset.py

echo ""

# Step 3: Train the model
echo "Step 3: Training syntactic clone detection model..."
poetry run python train_model.py \
    --dataset "$DATASETS_DIR/bigclonebench_train.json" \
    --dataset-format json \
    --language java \
    --model-name type3_xgb.pkl \
    --n-estimators 100 \
    --max-depth 6 \
    --learning-rate 0.1

echo ""

# Step 4: Evaluate on balanced test set
echo "Step 4: Evaluating on balanced test set..."
poetry run python evaluate_balanced.py \
    --model models/type3_xgb.pkl \
    --dataset "$DATASETS_DIR/bigclonebench_test.json" \
    --language java \
    --output-dir results/

echo ""
echo "========================================"
echo "Training and Evaluation Complete!"
echo "========================================"
echo ""
echo "Results saved to: $SCRIPT_DIR/results/"
