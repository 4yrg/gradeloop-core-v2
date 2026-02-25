"""
BCB Evaluator: Evaluate clone detection against BigCloneBench ground truth.

This module provides evaluation metrics (Precision, Recall, F1-score)
for assessing clone detection performance against BigCloneBench ground truth.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple

try:
    from sklearn.metrics import f1_score, precision_score, recall_score
except ImportError:
    precision_score = None  # type: ignore
    recall_score = None  # type: ignore
    f1_score = None  # type: ignore


@dataclass
class EvaluationMetrics:
    """
    Evaluation metrics for clone detection.

    Attributes:
        precision: Precision score (TP / (TP + FP))
        recall: Recall score (TP / (TP + FN))
        f1_score: F1 score (harmonic mean of precision and recall)
        true_positives: Number of correctly detected clones
        false_positives: Number of non-clones incorrectly flagged
        false_negatives: Number of clones missed
        true_negatives: Number of correctly identified non-clones
        accuracy: Overall accuracy
    """

    precision: float
    recall: float
    f1_score: float
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    accuracy: float = 0.0

    def to_dict(self) -> dict:
        """Convert metrics to dictionary."""
        return {
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "true_negatives": self.true_negatives,
            "accuracy": self.accuracy,
        }

    def __str__(self) -> str:
        """String representation."""
        return (
            f"EvaluationMetrics(\n"
            f"  Precision: {self.precision:.4f}\n"
            f"  Recall:    {self.recall:.4f}\n"
            f"  F1-Score:  {self.f1_score:.4f}\n"
            f"  Accuracy:  {self.accuracy:.4f}\n"
            f"  TP: {self.true_positives}, FP: {self.false_positives}, "
            f"FN: {self.false_negatives}, TN: {self.true_negatives}\n"
            f")"
        )


class BCBEvaluator:
    """
    Evaluate clone detection pipeline against BigCloneBench ground truth.

    Calculates Precision, Recall, and F1-score for different clone types:
    - ST3 (Strong Type-3): High similarity (>0.7)
    - MT3 (Moderate Type-3): Medium similarity (0.5-0.7)
    - WT3 (Weak Type-3): Low similarity (<0.5)

    Example:
        >>> evaluator = BCBEvaluator("datasets/bigclonebench/groundTruth.csv")
        >>> metrics = evaluator.evaluate(predictions, ground_truth)
        >>> print(metrics.f1_score)
    """

    def __init__(self, ground_truth_path: str):
        """
        Initialize with BigCloneBench ground truth.

        Args:
            ground_truth_path: Path to BCB ground truth file
        """
        self.ground_truth_path = ground_truth_path
        self.ground_truth: Dict[Tuple[str, str], int] = {}
        self._load_ground_truth()

    def _load_ground_truth(self):
        """Load ground truth clone pairs."""
        try:
            import pandas as pd
        except ImportError:
            raise ImportError("pandas is required for BCB evaluation")

        try:
            df = pd.read_csv(self.ground_truth_path)
            for _, row in df.iterrows():
                # Store as bidirectional pairs
                id1, id2 = str(row["clone1Id"]), str(row["clone2Id"])
                label = 1  # Clone
                self.ground_truth[(id1, id2)] = label
                self.ground_truth[(id2, id1)] = label  # Symmetric
        except FileNotFoundError:
            print(f"Warning: Ground truth file not found: {self.ground_truth_path}")
        except Exception as e:
            print(f"Warning: Error loading ground truth: {e}")

    def evaluate(
        self,
        predictions: List[Tuple[str, str, float]],
        threshold: float = 0.5,
    ) -> EvaluationMetrics:
        """
        Evaluate predictions against ground truth.

        Args:
            predictions: List of (frag_a, frag_b, score) tuples
            threshold: Similarity threshold for clone classification

        Returns:
            EvaluationMetrics object
        """
        if precision_score is None:
            raise ImportError(
                "scikit-learn is required. Install with: pip install scikit-learn"
            )

        y_true = []
        y_pred = []

        for frag_a, frag_b, score in predictions:
            # Get ground truth label
            gt_label = self.ground_truth.get((frag_a, frag_b), 0)
            gt_label = gt_label or self.ground_truth.get((frag_b, frag_a), 0)

            # Apply threshold
            pred_label = 1 if score >= threshold else 0

            y_true.append(gt_label)
            y_pred.append(pred_label)

        # Calculate metrics
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
        tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)

        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        accuracy = (tp + tn) / len(y_true) if len(y_true) > 0 else 0.0

        return EvaluationMetrics(
            precision=precision,
            recall=recall,
            f1_score=f1,
            true_positives=tp,
            false_positives=fp,
            false_negatives=fn,
            true_negatives=tn,
            accuracy=accuracy,
        )

    def evaluate_by_type(
        self,
        predictions: List[Tuple[str, str, float, int]],
        threshold: float = 0.5,
    ) -> Dict[str, EvaluationMetrics]:
        """
        Evaluate separately for ST3, MT3, WT3 categories.

        Args:
            predictions: List of (frag_a, frag_b, score, clone_type) tuples
            threshold: Similarity threshold

        Returns:
            Dictionary mapping clone type to EvaluationMetrics
        """
        results = {}

        # Group predictions by type
        type_predictions: Dict[str, List[Tuple[str, str, float]]] = {
            "ST3": [],
            "MT3": [],
            "WT3": [],
        }

        for frag_a, frag_b, score, clone_type in predictions:
            if clone_type == 3:
                if score >= 0.7:
                    type_predictions["ST3"].append((frag_a, frag_b, score))
                elif score >= 0.5:
                    type_predictions["MT3"].append((frag_a, frag_b, score))
                else:
                    type_predictions["WT3"].append((frag_a, frag_b, score))

        # Evaluate each type
        for clone_type, type_preds in type_predictions.items():
            if type_preds:
                results[clone_type] = self.evaluate(type_preds, threshold)
            else:
                results[clone_type] = EvaluationMetrics(
                    precision=0.0,
                    recall=0.0,
                    f1_score=0.0,
                    true_positives=0,
                    false_positives=0,
                    false_negatives=0,
                    true_negatives=0,
                    accuracy=0.0,
                )

        return results

    def evaluate_with_thresholds(
        self,
        predictions: List[Tuple[str, str, float]],
        thresholds: List[float] = None,
    ) -> List[EvaluationMetrics]:
        """
        Evaluate with multiple thresholds to find optimal threshold.

        Args:
            predictions: List of (frag_a, frag_b, score) tuples
            thresholds: List of thresholds to try (default: 0.3 to 0.9)

        Returns:
            List of EvaluationMetrics for each threshold
        """
        if thresholds is None:
            thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

        results = []
        for threshold in thresholds:
            metrics = self.evaluate(predictions, threshold)
            results.append(metrics)

        return results

    def find_optimal_threshold(
        self,
        predictions: List[Tuple[str, str, float]],
        metric: str = "f1_score",
    ) -> Tuple[float, float]:
        """
        Find optimal threshold for a given metric.

        Args:
            predictions: List of (frag_a, frag_b, score) tuples
            metric: Metric to optimize ('precision', 'recall', 'f1_score')

        Returns:
            Tuple of (optimal_threshold, best_metric_value)
        """
        results = self.evaluate_with_thresholds(predictions)

        best_threshold = 0.5
        best_value = 0.0

        for i, metrics in enumerate(results):
            thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
            value = getattr(metrics, metric)

            if value > best_value:
                best_value = value
                best_threshold = thresholds[i]

        return best_threshold, best_value
