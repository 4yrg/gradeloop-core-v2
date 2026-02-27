"""
Evaluate Syntactic Clone Detection Pipeline with Balanced Dataset.

Evaluates the trained syntactic model on a balanced dataset with:
- Type-1 clones (exact matches)
- Type-2 clones (renamed identifiers)
- Type-3 clones (modified statements)
- Type-4 clones (semantic clones)
- Non-clones

Produces comprehensive metrics including per-class performance.

Usage:
    # Evaluate with balanced dataset
    poetry run python evaluate_balanced.py \
        --model models/type3_xgb.pkl \
        --dataset /path/to/bigclonebench_balanced.json \
        --language java

    # With custom output directory
    poetry run python evaluate_balanced.py \
        --model models/type3_xgb.pkl \
        --dataset /path/to/bigclonebench_balanced.json \
        --output-dir results/ \
        --language java
"""

import json
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from tqdm import tqdm

from clone_detection.features.syntactic_features import SyntacticFeatureExtractor
from clone_detection.models.classifiers import SyntacticClassifier
from clone_detection.tokenizers.tree_sitter_tokenizer import TreeSitterTokenizer
from clone_detection.utils.common_setup import setup_logging

logger = setup_logging(__name__)


def load_balanced_dataset(
    dataset_path: str,
) -> tuple[list[str], list[str], list[int], list[int]]:
    """
    Load balanced dataset with clone type information.

    Args:
        dataset_path: Path to balanced JSON dataset

    Returns:
        Tuple of (code1_list, code2_list, labels, clone_types)
    """
    logger.info(f"Loading balanced dataset from {dataset_path}...")

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    code1_list = []
    code2_list = []
    labels = []
    clone_types = []

    for item in data:
        code1 = item.get("code1", "")
        code2 = item.get("code2", "")
        label = item.get("label", 0)
        clone_type = item.get("clone_type", 0) if label == 1 else 0

        if code1 and code2:
            code1_list.append(code1)
            code2_list.append(code2)
            labels.append(label)
            clone_types.append(clone_type)

    logger.info(f"Loaded {len(code1_list)} code pairs")
    return code1_list, code2_list, labels, clone_types


def map_clone_type_to_label(clone_type: int) -> int:
    """
    Map clone type to binary label for syntactic detection.

    Syntactic detection focuses on Type-1/2/3 (syntactic similarity).
    Type-4 (semantic clones) are typically not detectable syntactically.

    Args:
        clone_type: Clone type (0=non-clone, 1-4=clone types)

    Returns:
        Binary label (0=non-clone, 1=clone)
    """
    if clone_type == 0:
        return 0
    return 1


def evaluate_model(
    model_path: str,
    dataset_path: str,
    language: str = "java",
    output_dir: str | None = None,
) -> dict:
    """
    Evaluate syntactic model on balanced dataset.

    Args:
        model_path: Path to trained model (.pkl file)
        dataset_path: Path to balanced dataset (JSON)
        language: Programming language
        output_dir: Directory to save results

    Returns:
        Comprehensive evaluation metrics dictionary
    """
    logger.info(f"Loading model from {model_path}...")
    model = SyntacticClassifier.load(Path(model_path).name)

    # Load dataset
    code1_list, code2_list, labels, clone_types = load_balanced_dataset(dataset_path)

    # Extract features
    logger.info(f"Extracting features for {len(code1_list)} pairs...")
    tokenizer = TreeSitterTokenizer()
    extractor = SyntacticFeatureExtractor()
    features = []

    for code1, code2 in tqdm(
        zip(code1_list, code2_list), total=len(code1_list), desc="Extracting features"
    ):
        try:
            tokens1 = tokenizer.tokenize(code1, language, abstract_identifiers=True)
            tokens2 = tokenizer.tokenize(code2, language, abstract_identifiers=True)
            feat = extractor.extract_features(tokens1, tokens2)
            features.append(feat)
        except Exception as e:
            logger.warning(f"Feature extraction failed: {e}")
            features.append(np.zeros(6))

    X_test = np.array(features)
    y_test = np.array(labels)

    # Predict
    logger.info("Making predictions...")
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    # Overall metrics
    overall_metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_proba)),
    }

    # Per-clone-type metrics
    clone_type_metrics = {}
    for ct in [0, 1, 2, 3, 4]:
        type_name = "Non-clone" if ct == 0 else f"Type-{ct}"
        indices = [i for i, ct_val in enumerate(clone_types) if ct_val == ct]

        if len(indices) == 0:
            continue

        y_test_type = y_test[indices]
        y_pred_type = y_pred[indices]
        y_proba_type = y_proba[indices]

        metrics = {
            "count": int(len(indices)),
            "accuracy": float(accuracy_score(y_test_type, y_pred_type)),
            "precision": float(
                precision_score(y_test_type, y_pred_type, zero_division=0)
            ),
            "recall": float(recall_score(y_test_type, y_pred_type, zero_division=0)),
            "f1": float(f1_score(y_test_type, y_pred_type, zero_division=0)),
        }

        if len(set(y_test_type)) > 1:
            metrics["roc_auc"] = float(roc_auc_score(y_test_type, y_proba_type))
        else:
            metrics["roc_auc"] = float("nan")

        clone_type_metrics[type_name] = metrics

    # Feature importance
    feature_importance = {
        k: float(v) for k, v in model.get_feature_importance().items()
    }

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)

    # Compile results
    results = {
        "model_path": model_path,
        "dataset_path": dataset_path,
        "language": language,
        "timestamp": datetime.now().isoformat(),
        "total_samples": int(len(y_test)),
        "overall_metrics": {k: float(v) for k, v in overall_metrics.items()},
        "per_clone_type_metrics": clone_type_metrics,
        "feature_importance": feature_importance,
        "confusion_matrix": cm.tolist(),
    }

    # Print report
    print("\n" + "=" * 70)
    print("BALANCED DATASET EVALUATION REPORT")
    print("=" * 70)
    print(f"Model: {model_path}")
    print(f"Dataset: {dataset_path}")
    print(f"Language: {language}")
    print(f"Total samples: {len(y_test):,}")
    print("\n" + "-" * 70)
    print("OVERALL METRICS")
    print("-" * 70)
    print(f"Accuracy:  {overall_metrics['accuracy']:.4f}")
    print(f"Precision: {overall_metrics['precision']:.4f}")
    print(f"Recall:    {overall_metrics['recall']:.4f}")
    print(f"F1 Score:  {overall_metrics['f1']:.4f}")
    print(f"ROC AUC:   {overall_metrics['roc_auc']:.4f}")

    print("\n" + "-" * 70)
    print("PER-CLONE-TYPE METRICS")
    print("-" * 70)
    print(
        f"{'Class':<15} {'Count':>10} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}"
    )
    print("-" * 70)

    for type_name, metrics in clone_type_metrics.items():
        print(
            f"{type_name:<15} {metrics['count']:>10,} {metrics['accuracy']:>10.4f} "
            f"{metrics['precision']:>10.4f} {metrics['recall']:>10.4f} {metrics['f1']:>10.4f}"
        )

    print("-" * 70)

    print("\n" + "-" * 70)
    print("CONFUSION MATRIX")
    print("-" * 70)
    print(cm)
    print("Labels: [Non-clone, Clone]")

    print("\n" + "-" * 70)
    print("FEATURE IMPORTANCES")
    print("-" * 70)
    for name, score in feature_importance.items():
        print(f"  {name}: {score:.4f}")

    # Save results
    if output_dir:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save JSON results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = output_path / f"evaluation_results_{timestamp}.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"Results saved to {results_file}")

        # Save CSV summary
        summary_data = []
        for type_name, metrics in clone_type_metrics.items():
            row = {"class": type_name, **metrics}
            summary_data.append(row)

        summary_df = pd.DataFrame(summary_data)
        summary_df["overall_accuracy"] = overall_metrics["accuracy"]
        summary_df["overall_precision"] = overall_metrics["precision"]
        summary_df["overall_recall"] = overall_metrics["recall"]
        summary_df["overall_f1"] = overall_metrics["f1"]
        summary_df["overall_roc_auc"] = overall_metrics["roc_auc"]

        csv_file = output_path / f"evaluation_summary_{timestamp}.csv"
        summary_df.to_csv(csv_file, index=False)
        logger.info(f"Summary saved to {csv_file}")

    print("\n" + "=" * 70)
    print("Evaluation complete!")
    print("=" * 70)

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Evaluate syntactic clone detection on balanced dataset"
    )
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="Path to trained model (.pkl file)",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to balanced dataset (JSON)",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="java",
        choices=["java", "c", "python"],
        help="Programming language",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory to save evaluation results",
    )

    args = parser.parse_args()

    evaluate_model(
        model_path=args.model,
        dataset_path=args.dataset,
        language=args.language,
        output_dir=args.output_dir,
    )
