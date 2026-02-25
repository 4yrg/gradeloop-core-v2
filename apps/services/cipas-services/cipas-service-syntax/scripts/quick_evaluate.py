#!/usr/bin/env python3
"""
Quick Model Evaluation Script

Evaluates the trained model on a small sample from TOMA dataset.

Usage:
    cd /home/iamdasun/Projects/4yrg/gradeloop-core-v2/apps/services/cipas-services/cipas-service-syntax
    PYTHONPATH=src .venv-cipas-syntax/bin/python scripts/quick_evaluate.py
"""

import json
import sys
import time
from pathlib import Path

# Add src to path - use absolute path
script_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(script_dir / "src"))

import numpy as np
import pandas as pd

from ml import RandomForestClassifier
from parser import ParserEngine
from toma import FeatureExtractor, ToMAMapper


def main():
    print("=" * 70)
    print("Quick Model Evaluation")
    print("=" * 70)

    # Configuration - use absolute paths
    model_path = script_dir.parent / "data/models/clone_classifier.joblib"
    dataset_path = Path(
        "/home/iamdasun/Projects/4yrg/gradeloop-core-v2/datasets/toma-dataset"
    )
    source_path = dataset_path / "id2sourcecode"
    sample_size = 100  # Small sample for quick test

    print(f"\nModel: {model_path}")
    print(f"Dataset: {dataset_path}")
    print(f"Sample: {sample_size} pairs")
    print()

    # Load model
    print("Loading model...")
    clf = RandomForestClassifier()
    clf.load(str(model_path))
    print("✓ Model loaded")

    # Load TOMA clone pairs
    print("\nLoading dataset...")
    clone_file = dataset_path / "clone.csv"
    df = pd.read_csv(clone_file, header=None, nrows=sample_size)
    print(f"✓ Loaded {len(df)} clone pairs")

    # Initialize components
    engine = ParserEngine()
    mapper = ToMAMapper("java")
    extractor = FeatureExtractor()

    # Evaluate
    print("\nEvaluating...")
    y_true = []
    y_pred = []

    start_time = time.time()
    evaluated = 0
    missing = 0

    for i, row in df.iterrows():
        id1 = str(row.iloc[0])
        id2 = str(row.iloc[1])
        label = 1  # All in clone.csv are clones

        # Load source code
        file1 = source_path / f"{id1}.java"
        file2 = source_path / f"{id2}.java"

        code1 = ""
        code2 = ""

        if file1.exists():
            code1 = file1.read_text(encoding="utf-8", errors="ignore")
        else:
            missing += 1

        if file2.exists():
            code2 = file2.read_text(encoding="utf-8", errors="ignore")
        else:
            missing += 1

        if not code1.strip() or not code2.strip():
            continue

        # Extract features
        try:
            tree1 = engine.parse(code1.encode(), "java")
            tree2 = engine.parse(code2.encode(), "java")

            tokens1 = mapper.map_fragment(tree1.root_node, code1.encode())
            tokens2 = mapper.map_fragment(tree2.root_node, code2.encode())

            if len(tokens1) == 0 or len(tokens2) == 0:
                continue

            features = extractor.extract_features(tokens1, tokens2)
            X = np.array([features])

            # Predict
            prediction = clf.predict(X)[0]

            y_true.append(label)
            y_pred.append(prediction)
            evaluated += 1

        except Exception as e:
            continue

        if (i + 1) % 50 == 0:
            print(f"  Processed {i + 1}/{len(df)} pairs...")

    total_time = time.time() - start_time

    # Calculate metrics
    if len(y_true) > 0:
        from sklearn.metrics import (
            accuracy_score,
            f1_score,
            precision_score,
            recall_score,
        )

        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        accuracy = accuracy_score(y_true, y_pred)

        tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

        print("\n" + "=" * 70)
        print("Evaluation Results")
        print("=" * 70)
        print(f"\n📊 Performance:")
        print(f"   Pairs Evaluated: {evaluated}")
        print(f"   Missing Files:   {missing}")
        print(f"   Total Time:      {total_time:.2f} seconds")
        print(f"   Pairs/Second:    {evaluated / max(total_time, 0.1):.1f}")

        print(f"\n📈 Metrics:")
        print(f"   Precision:  {precision:.4f}")
        print(f"   Recall:     {recall:.4f}")
        print(f"   F1-Score:   {f1:.4f}")
        print(f"   Accuracy:   {accuracy:.4f}")

        print(f"\n📋 Confusion Matrix:")
        print(f"   True Positives:  {tp}")
        print(f"   False Negatives: {fn}")
        print(f"   (All samples are clones in this test)")

        print("\n" + "=" * 70)

        # Save results
        results = {
            "pairs_evaluated": evaluated,
            "missing_files": missing,
            "total_time_seconds": round(total_time, 2),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "accuracy": round(accuracy, 4),
            "true_positives": tp,
            "false_negatives": fn,
        }

        output_file = script_dir / "reports/quick_evaluation.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Results saved to: {output_file}")

    else:
        print("\n⚠️  No pairs could be evaluated")
        print("   Check if source files exist in:", source_path)


if __name__ == "__main__":
    main()
