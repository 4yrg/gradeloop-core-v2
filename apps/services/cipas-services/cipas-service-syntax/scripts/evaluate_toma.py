#!/usr/bin/env python3
"""
TOMA Dataset Evaluation Script

Evaluates the trained clone detection model using the TOMA dataset.
This script uses the ToMa dataset for evaluating Type-1, Type-2, Type-3, and Type-4 clones.

ToMa Dataset Type Mapping:
    - Type 1 = Type-1 (exact clones)
    - Type 2 = Type-2 (renamed clones)
    - Type 3 = Type-3 strong (mapped to Type-3)
    - Type 4 = Type-3 moderate (mapped to Type-3)
    - Type 5 = Type-4 (semantic clones)

Usage:
    python scripts/evaluate_toma.py \\
        --model data/models/clone_classifier.joblib \\
        --toma datasets/toma-dataset \\
        --output reports/evaluations/toma_evaluation.json

Example:
    python scripts/evaluate_toma.py \\
        -m data/models/clone_classifier.joblib \\
        -d ../../../../datasets/toma-dataset \\
        -o reports/evaluations/toma_evaluation.json \\
        -l java \\
        -n 5000
"""

import argparse
import json
import logging
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            Path(__file__).parent.parent / "reports" / "toma_evaluation.log"
        ),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class TOMAEvaluationMetrics:
    """Metrics for TOMA evaluation."""

    # Overall metrics
    overall_precision: float
    overall_recall: float
    overall_f1_score: float
    overall_accuracy: float

    # By clone type (ToMa dataset format)
    type1_metrics: Dict[str, float]  # Type-1 (exact)
    type2_metrics: Dict[str, float]  # Type-2 (renamed)
    type3_metrics: Dict[str, float]  # Type-3 (modified) - includes types 3+4
    type4_metrics: Dict[str, float]  # Type-4 (semantic) - type 5

    # Confusion matrix
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int

    # Runtime
    total_time_seconds: float
    pairs_evaluated: int
    timestamp: str

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class ClonePair:
    """Represents a code pair for evaluation."""

    id1: str
    id2: str
    label: int  # 1 = clone, 0 = non-clone
    clone_type: int  # 1, 2, 3, 4, 5, or 0 for non-clone
    similarity1: float
    similarity2: float


def load_toma_dataset(
    dataset_path: str,
    sample_size: int = 5000,
    type_mapping: Optional[Dict[int, int]] = None,
) -> Tuple[List[ClonePair], Path]:
    """
    Load TOMA dataset with proper type mapping.

    ToMa Dataset Format:
        - type-1.csv: Type-1 clones (exact)
        - type-2.csv: Type-2 clones (renamed)
        - type-3.csv: Type-3 clones (strong and moderate)
        - type-5.csv: Type-4 clones (semantic)
        - clone.csv: All clones combined
        - nonclone.csv: Non-clone pairs

    Type Mapping (configurable):
        1 = Type-1 (exact clones)
        2 = Type-2 (renamed clones)
        3 = Type-3 strong (mapped to Type-3)
        4 = Type-3 moderate (mapped to Type-3)
        5 = Type-4 semantic (mapped to Type-4)

    Args:
        dataset_path: Path to TOMA dataset directory
        sample_size: Number of pairs to sample per type
        type_mapping: Custom type mapping (default: {1:1, 2:2, 3:3, 4:3, 5:4})

    Returns:
        Tuple of (pairs_list, source_code_path)
    """
    import pandas as pd

    if type_mapping is None:
        # Default mapping: 3+4 -> Type-3, 5 -> Type-4
        type_mapping = {1: 1, 2: 2, 3: 3, 4: 3, 5: 4}

    dataset_dir = Path(dataset_path)
    source_path = dataset_dir / "id2sourcecode"

    pairs = []
    type_counts = {1: 0, 2: 0, 3: 0, 4: 0}

    # Load type-specific files
    type_files = {
        1: ("type-1.csv", "Type-1 (exact)"),
        2: ("type-2.csv", "Type-2 (renamed)"),
        3: ("type-3.csv", "Type-3 (strong)"),
        4: ("type-3.csv", "Type-3 (moderate)"),  # Same file, different interpretation
        5: ("type-5.csv", "Type-4 (semantic)"),
    }

    logger.info(f"Loading TOMA dataset from {dataset_dir}")

    for original_type, (filename, desc) in type_files.items():
        type_file = dataset_dir / filename
        if type_file.exists():
            logger.info(f"  Loading {filename} ({desc})...")
            try:
                df = pd.read_csv(type_file, header=None, nrows=sample_size)
                loaded_count = 0
                for _, row in df.iterrows():
                    id1 = str(row.iloc[0])
                    id2 = str(row.iloc[1])
                    mapped_type = type_mapping.get(original_type, 3)

                    pairs.append(
                        ClonePair(
                            id1=id1,
                            id2=id2,
                            label=1,  # All are clones
                            clone_type=mapped_type,
                            similarity1=float(row.iloc[2]) if len(row) > 2 else 0.0,
                            similarity2=float(row.iloc[3]) if len(row) > 3 else 0.0,
                        )
                    )
                    type_counts[mapped_type] += 1
                    loaded_count += 1

                logger.info(f"    Loaded {loaded_count} pairs")
            except Exception as e:
                logger.warning(f"  Error loading {filename}: {e}")

    # If no type-specific files, try clone.csv
    if len(pairs) == 0:
        clone_file = dataset_dir / "clone.csv"
        if clone_file.exists():
            logger.info(f"  Loading {clone_file}...")
            df = pd.read_csv(clone_file, header=None, nrows=sample_size * 5)
            for _, row in df.iterrows():
                id1 = str(row.iloc[0])
                id2 = str(row.iloc[1])
                original_type = int(row.iloc[2]) if len(row) > 2 else 3
                mapped_type = type_mapping.get(original_type, 3)

                pairs.append(
                    ClonePair(
                        id1=id1,
                        id2=id2,
                        label=1,
                        clone_type=mapped_type,
                        similarity1=float(row.iloc[3]) if len(row) > 3 else 0.0,
                        similarity2=float(row.iloc[4]) if len(row) > 4 else 0.0,
                    )
                )
                type_counts[mapped_type] += 1

    # Load non-clone pairs for negative samples
    nonclone_file = dataset_dir / "nonclone.csv"
    if nonclone_file.exists() and len(pairs) > 0:
        logger.info(f"  Loading non-clone pairs...")
        # Balance non-clones with clones
        non_sample_size = min(len(pairs), sample_size * 2)
        try:
            df_non = pd.read_csv(nonclone_file, header=None, nrows=non_sample_size)
            non_clone_count = 0
            for _, row in df_non.iterrows():
                id1 = str(row.iloc[0])
                id2 = str(row.iloc[1])
                pairs.append(
                    ClonePair(
                        id1=id1,
                        id2=id2,
                        label=0,  # Non-clone
                        clone_type=0,
                        similarity1=0.0,
                        similarity2=0.0,
                    )
                )
                non_clone_count += 1
            logger.info(f"    Loaded {non_clone_count} non-clone pairs")
        except Exception as e:
            logger.warning(f"  Error loading non-clone pairs: {e}")

    if len(pairs) == 0:
        raise FileNotFoundError(f"No clone pairs found in {dataset_dir}")

    logger.info(f"\nTotal pairs loaded: {len(pairs)}")
    logger.info(f"Type distribution:")
    logger.info(f"  Type-1 clones: {type_counts[1]}")
    logger.info(f"  Type-2 clones: {type_counts[2]}")
    logger.info(f"  Type-3 clones: {type_counts[3]}")
    logger.info(f"  Type-4 clones: {type_counts[4]}")
    logger.info(f"  Non-clones:    {len(pairs) - sum(type_counts.values())}")
    logger.info(f"Source code path: {source_path}")

    return pairs, source_path


def load_code_for_pair(pair: ClonePair, source_path: Path) -> Tuple[str, str]:
    """
    Load source code for a clone pair.

    Args:
        pair: ClonePair object
        source_path: Path to source code directory

    Returns:
        Tuple of (code1, code2)
    """
    # TOMA uses function IDs as filenames
    file1 = source_path / f"{pair.id1}.java"
    file2 = source_path / f"{pair.id2}.java"

    code1 = ""
    code2 = ""

    if file1.exists():
        code1 = file1.read_text(encoding="utf-8", errors="ignore")

    if file2.exists():
        code2 = file2.read_text(encoding="utf-8", errors="ignore")

    return code1, code2


def extract_features_for_pair(
    code1: str, code2: str, language: str = "java"
) -> np.ndarray:
    """
    Extract ToMA features for a code pair.

    Args:
        code1: First code snippet
        code2: Second code snippet
        language: Programming language

    Returns:
        6D feature vector
    """
    import sys
    from pathlib import Path

    # Add src to path for imports
    src_path = Path(__file__).parent.parent / "src"
    sys.path.insert(0, str(src_path))

    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    if not code1.strip() or not code2.strip():
        return np.array([0.0] * 6)

    try:
        engine = ParserEngine()
        mapper = ToMAMapper(language)
        extractor = FeatureExtractor()

        tree1 = engine.parse(code1.encode(), language)
        tree2 = engine.parse(code2.encode(), language)

        tokens1 = mapper.map_fragment(tree1.root_node, code1.encode())
        tokens2 = mapper.map_fragment(tree2.root_node, code2.encode())

        if len(tokens1) == 0 or len(tokens2) == 0:
            return np.array([0.0] * 6)

        features = extractor.extract_features(tokens1, tokens2)
        return np.array(features)

    except Exception as e:
        logger.debug(f"Error extracting features: {e}")
        return np.array([0.0] * 6)


def compute_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    """
    Compute evaluation metrics.

    Args:
        y_true: Ground truth labels
        y_pred: Predicted labels

    Returns:
        Dictionary with precision, recall, f1, accuracy
    """
    from sklearn.metrics import (
        accuracy_score,
        f1_score,
        precision_score,
        recall_score,
    )

    return {
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
    }


def evaluate_on_toma(
    model_path: str,
    dataset_path: str,
    language: str = "java",
    sample_size: int = 5000,
) -> TOMAEvaluationMetrics:
    """
    Evaluate trained model on TOMA dataset.

    Args:
        model_path: Path to trained model
        dataset_path: Path to TOMA dataset
        language: Programming language
        sample_size: Number of pairs to evaluate

    Returns:
        TOMAEvaluationMetrics object
    """
    import sys
    from pathlib import Path

    # Add src to path for imports
    src_path = Path(__file__).parent.parent / "src"
    sys.path.insert(0, str(src_path))

    from ml import RandomForestClassifier

    start_time = time.time()

    # Load model
    logger.info(f"Loading model from {model_path}")
    clf = RandomForestClassifier()
    clf.load(model_path)
    logger.info("Model loaded successfully")

    # Load TOMA dataset
    logger.info("Loading TOMA dataset...")
    pairs, source_path = load_toma_dataset(dataset_path, sample_size)

    # Evaluate each pair
    logger.info(f"Evaluating {len(pairs)} pairs...")

    y_true = []
    y_pred = []

    # Group by clone type for detailed metrics
    type_groups = {
        1: {"true": [], "pred": []},
        2: {"true": [], "pred": []},
        3: {"true": [], "pred": []},
        4: {"true": [], "pred": []},
    }

    tp = fp = tn = fn = 0
    missing_code = 0

    for i, pair in enumerate(pairs):
        # Load code
        code1, code2 = load_code_for_pair(pair, source_path)

        # Check if code is available
        if not code1.strip() or not code2.strip():
            missing_code += 1
            if missing_code <= 10:
                logger.debug(f"  Missing code for pair ({pair.id1}, {pair.id2})")
            # Skip pairs with missing code
            continue

        # Extract features
        features = extract_features_for_pair(code1, code2, language)

        # Predict
        X = features.reshape(1, -1)
        prediction = clf.predict(X)[0]

        y_true.append(pair.label)
        y_pred.append(prediction)

        # Classify by type
        if pair.clone_type in type_groups:
            type_groups[pair.clone_type]["true"].append(pair.label)
            type_groups[pair.clone_type]["pred"].append(prediction)

        # Confusion matrix
        if pair.label == 1 and prediction == 1:
            tp += 1
        elif pair.label == 0 and prediction == 1:
            fp += 1
        elif pair.label == 0 and prediction == 0:
            tn += 1
        else:
            fn += 1

        if (i + 1) % 500 == 0:
            logger.info(f"  Evaluated {i + 1}/{len(pairs)} pairs...")

    # Compute overall metrics
    overall_metrics = compute_metrics(y_true, y_pred)

    # Compute metrics by clone type
    type1_metrics = (
        compute_metrics(type_groups[1]["true"], type_groups[1]["pred"])
        if type_groups[1]["true"]
        else {}
    )
    type2_metrics = (
        compute_metrics(type_groups[2]["true"], type_groups[2]["pred"])
        if type_groups[2]["true"]
        else {}
    )
    type3_metrics = (
        compute_metrics(type_groups[3]["true"], type_groups[3]["pred"])
        if type_groups[3]["true"]
        else {}
    )
    type4_metrics = (
        compute_metrics(type_groups[4]["true"], type_groups[4]["pred"])
        if type_groups[4]["true"]
        else {}
    )

    total_time = time.time() - start_time

    metrics = TOMAEvaluationMetrics(
        overall_precision=overall_metrics["precision"],
        overall_recall=overall_metrics["recall"],
        overall_f1_score=overall_metrics["f1_score"],
        overall_accuracy=overall_metrics["accuracy"],
        type1_metrics=type1_metrics,
        type2_metrics=type2_metrics,
        type3_metrics=type3_metrics,
        type4_metrics=type4_metrics,
        true_positives=tp,
        false_positives=fp,
        true_negatives=tn,
        false_negatives=fn,
        total_time_seconds=total_time,
        pairs_evaluated=len(pairs),
        timestamp=datetime.now().isoformat(),
    )

    logger.info(f"Missing code files: {missing_code}/{len(pairs)}")

    return metrics


def save_results(metrics: TOMAEvaluationMetrics, output_path: str):
    """
    Save evaluation results to JSON file.

    Args:
        metrics: Evaluation metrics
        output_path: Output file path
    """
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    results = {
        "evaluation_summary": {
            "dataset": "TOMA",
            "pairs_evaluated": metrics.pairs_evaluated,
            "total_time_seconds": round(metrics.total_time_seconds, 2),
            "timestamp": metrics.timestamp,
        },
        "overall_metrics": {
            "precision": round(metrics.overall_precision, 4),
            "recall": round(metrics.overall_recall, 4),
            "f1_score": round(metrics.overall_f1_score, 4),
            "accuracy": round(metrics.overall_accuracy, 4),
        },
        "by_clone_type": {
            "Type-1 (Exact Clones)": {
                k: round(v, 4) for k, v in metrics.type1_metrics.items()
            }
            if metrics.type1_metrics
            else "N/A",
            "Type-2 (Renamed Clones)": {
                k: round(v, 4) for k, v in metrics.type2_metrics.items()
            }
            if metrics.type2_metrics
            else "N/A",
            "Type-3 (Modified Clones)": {
                k: round(v, 4) for k, v in metrics.type3_metrics.items()
            }
            if metrics.type3_metrics
            else "N/A",
            "Type-4 (Semantic Clones)": {
                k: round(v, 4) for k, v in metrics.type4_metrics.items()
            }
            if metrics.type4_metrics
            else "N/A",
        },
        "confusion_matrix": {
            "true_positives": metrics.true_positives,
            "false_positives": metrics.false_positives,
            "true_negatives": metrics.true_negatives,
            "false_negatives": metrics.false_negatives,
            "precision": round(
                metrics.true_positives
                / max(metrics.true_positives + metrics.false_positives, 1),
                4,
            ),
            "recall": round(
                metrics.true_positives
                / max(metrics.true_positives + metrics.false_negatives, 1),
                4,
            ),
        },
    }

    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Results saved to: {output_file}")


def print_results(metrics: TOMAEvaluationMetrics):
    """Print evaluation results to console."""
    print("\n" + "=" * 70)
    print("TOMA Dataset Evaluation Results")
    print("=" * 70)

    print(f"\n📊 Overall Performance:")
    print(f"   Pairs Evaluated: {metrics.pairs_evaluated}")
    print(f"   Total Time:      {metrics.total_time_seconds:.2f} seconds")
    print(
        f"   Pairs/Second:    {metrics.pairs_evaluated / max(metrics.total_time_seconds, 0.1):.1f}"
    )

    print(f"\n📈 Overall Metrics:")
    print(f"   Precision:  {metrics.overall_precision:.4f}")
    print(f"   Recall:     {metrics.overall_recall:.4f}")
    print(f"   F1-Score:   {metrics.overall_f1_score:.4f}")
    print(f"   Accuracy:   {metrics.overall_accuracy:.4f}")

    print(f"\n🔬 By Clone Type:")

    if metrics.type1_metrics:
        print(f"\n   Type-1 (Exact Clones):")
        print(f"      Precision: {metrics.type1_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.type1_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.type1_metrics.get('f1_score', 0):.4f}")

    if metrics.type2_metrics:
        print(f"\n   Type-2 (Renamed Clones):")
        print(f"      Precision: {metrics.type2_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.type2_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.type2_metrics.get('f1_score', 0):.4f}")

    if metrics.type3_metrics:
        print(f"\n   Type-3 (Modified Clones):")
        print(f"      Precision: {metrics.type3_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.type3_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.type3_metrics.get('f1_score', 0):.4f}")

    if metrics.type4_metrics:
        print(f"\n   Type-4 (Semantic Clones):")
        print(f"      Precision: {metrics.type4_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.type4_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.type4_metrics.get('f1_score', 0):.4f}")

    print(f"\n📋 Confusion Matrix:")
    print(f"   True Positives:  {metrics.true_positives}")
    print(f"   False Positives: {metrics.false_positives}")
    print(f"   True Negatives:  {metrics.true_negatives}")
    print(f"   False Negatives: {metrics.false_negatives}")

    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate clone detection model on TOMA dataset"
    )
    parser.add_argument(
        "--model", "-m", type=str, required=True, help="Path to trained model file"
    )
    parser.add_argument(
        "--toma", "-d", type=str, required=True, help="Path to TOMA dataset directory"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="reports/evaluations/toma_evaluation.json",
        help="Output file path",
    )
    parser.add_argument(
        "--language",
        "-l",
        type=str,
        default="java",
        choices=["python", "java", "c"],
        help="Programming language",
    )
    parser.add_argument(
        "--sample-size",
        "-n",
        type=int,
        default=5000,
        help="Number of pairs to evaluate",
    )

    args = parser.parse_args()

    logger.info("=" * 70)
    logger.info("TOMA Dataset Model Evaluation")
    logger.info("=" * 70)
    logger.info(f"Model:        {args.model}")
    logger.info(f"Dataset:      {args.toma}")
    logger.info(f"Output:       {args.output}")
    logger.info(f"Language:     {args.language}")
    logger.info(f"Sample Size:  {args.sample_size}")
    logger.info("=" * 70)

    # Run evaluation
    try:
        metrics = evaluate_on_toma(
            model_path=args.model,
            dataset_path=args.toma,
            language=args.language,
            sample_size=args.sample_size,
        )

        # Print results
        print_results(metrics)

        # Save results
        save_results(metrics, args.output)

        logger.info("\n✅ Evaluation complete!")

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        logger.error("Make sure TOMA dataset is downloaded and extracted")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        raise


if __name__ == "__main__":
    main()
