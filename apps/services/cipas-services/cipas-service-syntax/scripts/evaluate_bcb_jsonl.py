#!/usr/bin/env python3
"""
BigCloneBench JSONL Evaluation Script

Evaluates the trained model on BigCloneBench JSONL dataset.
The JSONL file contains inline code (code1, code2), so no separate source files needed.

Usage:
    cd /home/iamdasun/Projects/4yrg/gradeloop-core-v2/apps/services/cipas-services/cipas-service-syntax
    PYTHONPATH=src .venv-cipas-syntax/bin/python scripts/evaluate_bcb_jsonl.py
"""

import json
import sys
import time
from pathlib import Path

# Add src to path
script_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(script_dir / "src"))

import numpy as np

from ml import RandomForestClassifier
from parser import ParserEngine
from toma import FeatureExtractor, ToMAMapper


def main():
    print("=" * 70)
    print("BigCloneBench JSONL Evaluation")
    print("=" * 70)

    # Configuration
    model_path = script_dir.parent / "data/models/clone_classifier.joblib"
    dataset_path = Path(
        "/home/iamdasun/Projects/4yrg/gradeloop-core-v2/datasets/bigclonebench/bigclonebench.jsonl"
    )
    sample_size = 500  # Start with small sample for testing

    print(f"\nModel: {model_path}")
    print(f"Dataset: {dataset_path}")
    print(f"Sample: {sample_size} pairs")
    print()

    # Load model
    print("Loading model...")
    clf = RandomForestClassifier()
    clf.load(str(model_path))
    print("✓ Model loaded")

    # Load JSONL dataset
    print(f"\nLoading BigCloneBench JSONL...")
    pairs = []
    with open(dataset_path, "r") as f:
        for i, line in enumerate(f):
            if i >= sample_size:
                break
            if line.strip():
                pairs.append(json.loads(line))
    print(f"✓ Loaded {len(pairs)} pairs")

    # Initialize components
    print("\nInitializing ToMA components...")
    engine = ParserEngine()
    mapper = ToMAMapper("java")
    extractor = FeatureExtractor()
    print("✓ Components ready")

    # Evaluate
    print(f"\nEvaluating {len(pairs)} pairs...")
    y_true = []
    y_pred = []

    start_time = time.time()
    evaluated = 0
    errors = 0

    for i, pair in enumerate(pairs):
        label = pair.get("label", 1)
        code1 = pair.get("code1", "")
        code2 = pair.get("code2", "")
        clone_type = pair.get("clone_type", 3)

        if not code1.strip() or not code2.strip():
            continue

        try:
            # Parse code
            tree1 = engine.parse(code1.encode(), "java")
            tree2 = engine.parse(code2.encode(), "java")

            # Map to tokens
            tokens1 = mapper.map_fragment(tree1.root_node, code1.encode())
            tokens2 = mapper.map_fragment(tree2.root_node, code2.encode())

            if len(tokens1) == 0 or len(tokens2) == 0:
                continue

            # Extract features
            features = extractor.extract_features(tokens1, tokens2)
            X = np.array([features])

            # Predict
            prediction = clf.predict(X)[0]

            y_true.append(label)
            y_pred.append(prediction)
            evaluated += 1

        except Exception as e:
            errors += 1
            continue

        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(pairs)} pairs...")

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
        fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
        tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)

        print("\n" + "=" * 70)
        print("BigCloneBench Evaluation Results")
        print("=" * 70)

        print(f"\n📊 Performance:")
        print(f"   Pairs Evaluated: {evaluated}")
        print(f"   Errors:          {errors}")
        print(f"   Total Time:      {total_time:.2f} seconds")
        print(f"   Pairs/Second:    {evaluated / max(total_time, 0.1):.1f}")

        print(f"\n📈 Overall Metrics:")
        print(f"   Precision:  {precision:.4f} ({precision * 100:.2f}%)")
        print(f"   Recall:     {recall:.4f} ({recall * 100:.2f}%)")
        print(f"   F1-Score:   {f1:.4f} ({f1 * 100:.2f}%)")
        print(f"   Accuracy:   {accuracy:.4f} ({accuracy * 100:.2f}%)")

        print(f"\n📋 Confusion Matrix:")
        print(f"   True Positives:  {tp}")
        print(f"   False Positives: {fp}")
        print(f"   True Negatives:  {tn}")
        print(f"   False Negatives: {fn}")

        # Save results
        results = {
            "dataset": "BigCloneBench JSONL",
            "pairs_evaluated": evaluated,
            "errors": errors,
            "total_time_seconds": round(total_time, 2),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "accuracy": round(accuracy, 4),
            "confusion_matrix": {
                "true_positives": tp,
                "false_positives": fp,
                "true_negatives": tn,
                "false_negatives": fn,
            },
        }

        output_file = script_dir / "reports/bcb_jsonl_evaluation.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Results saved to: {output_file}")

        print("\n" + "=" * 70)
        print("✅ Evaluation complete!")
        print("=" * 70)

    else:
        print("\n❌ No pairs could be evaluated")
        print("   Check if the JSONL file has code1/code2 fields")


if __name__ == "__main__":
    main()
