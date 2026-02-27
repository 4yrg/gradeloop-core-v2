"""
Evaluation Script for BigCloneBench Balanced Dataset.

Evaluates a trained XGBoost classifier on the BigCloneBench balanced dataset.
Supports JSON format with code1, code2, label fields.

Usage:
    # Basic evaluation
    poetry run python evaluate_bigclonebench.py \
        --model models/toma_trained_xgb.pkl \
        --dataset /path/to/bigclonebench_balanced.json

    # Evaluation with sample size (faster)
    poetry run python evaluate_bigclonebench.py \
        --model models/toma_trained_xgb.pkl \
        --dataset /path/to/bigclonebench_balanced.json \
        --sample-size 10000

    # Save metrics to JSON
    poetry run python evaluate_bigclonebench.py \
        --model models/toma_trained_xgb.pkl \
        --dataset /path/to/bigclonebench_balanced.json \
        --output-json results/evaluation_metrics.json
"""

import json
import logging
import os
from pathlib import Path

import numpy as np
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
from clone_detection.utils.common_setup import setup_logging

logger = setup_logging(__name__)


def load_bigclonebench_balanced_dataset(
    dataset_path: str,
    sample_size: int | None = None,
) -> tuple[list[str], list[str], list[int]]:
    """
    Load BigCloneBench balanced dataset from JSON file.

    Args:
        dataset_path: Path to JSON file
        sample_size: Optional sample size for faster evaluation

    Returns:
        Tuple of (code1_list, code2_list, labels)
    """
    logger.info(f"Loading BigCloneBench balanced dataset from {dataset_path}...")

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_entries = len(data)
    logger.info(f"Found {total_entries} entries in dataset")

    if sample_size and sample_size < total_entries:
        logger.info(f"Sampling {sample_size} entries for evaluation...")
        import random

        random.seed(42)
        data = random.sample(data, sample_size)

    code1_list = []
    code2_list = []
    labels = []

    for item in tqdm(data, desc="Loading dataset"):
        code1 = item.get("code1", "")
        code2 = item.get("code2", "")
        label = item.get("label", 0)

        if code1 and code2:
            code1_list.append(code1)
            code2_list.append(code2)
            labels.append(label)

    logger.info(f"Loaded {len(code1_list)} valid code pairs")
    logger.info(
        f"Class distribution: {sum(labels)} clones ({sum(labels) / len(labels) * 100:.1f}%), "
        f"{len(labels) - sum(labels)} non-clones ({(len(labels) - sum(labels)) / len(labels) * 100:.1f}%)"
    )

    return code1_list, code2_list, labels


def evaluate_model(
    model_path: str,
    dataset_path: str,
    language: str = "java",
    sample_size: int | None = None,
    output_report: bool = True,
    output_json: str | None = None,
) -> dict:
    """
    Evaluate a trained syntactic model on BigCloneBench balanced dataset.

    Args:
        model_path: Path to trained model (.pkl file)
        dataset_path: Path to test dataset JSON file
        language: Programming language
        sample_size: Optional sample size for evaluation
        output_report: Whether to print detailed report
        output_json: Optional path to save metrics as JSON

    Returns:
        Evaluation metrics dictionary
    """
    logger.info("=" * 80)
    logger.info("BigCloneBench Balanced Dataset Evaluation")
    logger.info("=" * 80)
    logger.info(f"Model: {model_path}")
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Language: {language}")
    logger.info(f"Sample size: {sample_size if sample_size else 'All'}")
    logger.info("=" * 80)

    # Load model
    logger.info(f"\nLoading model from {model_path}...")
    model = SyntacticClassifier.load(Path(model_path).name)

    # Load dataset
    code1_list, code2_list, labels = load_bigclonebench_balanced_dataset(
        dataset_path, sample_size=sample_size
    )

    # Extract features
    logger.info("Extracting features...")
    extractor = SyntacticFeatureExtractor(language=language)
    features = []
    failed = 0

    for code1, code2 in tqdm(
        zip(code1_list, code2_list),
        total=len(code1_list),
        desc="Extracting features",
    ):
        try:
            feat = extractor.extract_features_from_code(code1, code2, language)
            features.append(feat)
        except Exception as e:
            logger.debug(f"Feature extraction failed: {e}")
            failed += 1
            features.append(np.zeros(len(extractor.get_feature_names())))

    if failed > 0:
        logger.warning(f"Failed to extract features for {failed} pairs")

    X_test = np.array(features)
    y_test = np.array(labels)

    # Make predictions
    logger.info("Making predictions...")
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    # Calculate metrics
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_proba),
    }

    # Save metrics to JSON if requested
    if output_json:
        os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
        with open(output_json, "w") as f:
            json.dump(metrics, f, indent=2)
        logger.info(f"Metrics saved to {output_json}")

    if output_report:
        logger.info("\n" + "=" * 80)
        logger.info("EVALUATION REPORT")
        logger.info("=" * 80)
        logger.info(f"Dataset: {dataset_path}")
        logger.info(f"Total pairs: {len(y_test)}")
        logger.info(
            f"Class distribution: {sum(y_test)} clones, {len(y_test) - sum(y_test)} non-clones"
        )
        logger.info("\n" + "-" * 80)
        logger.info(f"Accuracy:  {metrics['accuracy']:.4f}")
        logger.info(f"Precision: {metrics['precision']:.4f}")
        logger.info(f"Recall:    {metrics['recall']:.4f}")
        logger.info(f"F1 Score:  {metrics['f1']:.4f}")
        logger.info(f"ROC AUC:   {metrics['roc_auc']:.4f}")
        logger.info("\nClassification Report:")
        logger.info(
            classification_report(y_test, y_pred, target_names=["Non-Clone", "Clone"])
        )
        logger.info("\nConfusion Matrix:")
        cm = confusion_matrix(y_test, y_pred)
        logger.info(cm)
        logger.info("\nInterpretation:")
        logger.info(f"  True Negatives (correct non-clones): {cm[0][0]}")
        logger.info(f"  False Positives (wrongly predicted as clones): {cm[0][1]}")
        logger.info(f"  False Negatives (missed clones): {cm[1][0]}")
        logger.info(f"  True Positives (correct clones): {cm[1][1]}")

        # Feature importance
        logger.info("\n" + "=" * 80)
        logger.info("Feature Importances (Top 20):")
        logger.info("=" * 80)
        importance = model.get_feature_importance_sorted()
        for feat_name, score in importance[:20]:
            logger.info(f"  {feat_name}: {score:.4f}")

    logger.info("\n" + "=" * 80)
    logger.info("Evaluation Complete!")
    logger.info("=" * 80)

    return metrics


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Evaluate clone detection model on BigCloneBench balanced dataset"
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
        help="Path to BigCloneBench balanced JSON file",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="java",
        choices=["java", "c", "python"],
        help="Programming language (default: java)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=None,
        help="Sample size for evaluation (optional, for faster evaluation)",
    )
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="Disable detailed report output",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Path to save metrics as JSON (optional)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    evaluate_model(
        model_path=args.model,
        dataset_path=args.dataset,
        language=args.language,
        sample_size=args.sample_size,
        output_report=not args.no_report,
        output_json=args.output_json,
    )
