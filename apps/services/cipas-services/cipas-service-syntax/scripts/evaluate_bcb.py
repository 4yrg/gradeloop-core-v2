#!/usr/bin/env python3
"""
BigCloneBench Evaluation Script

Evaluates the trained clone detection model against BigCloneBench ground truth.
Calculates Precision, Recall, F1-Score for different clone types:
    - Type-1: Exact clones (copy-paste)
    - Type-2: Renamed clones (identifier/literal renaming)
    - Type-3: Modified clones (statements added/removed/refactored)
        - Strong Type-3 (similarity >= 0.7)
        - Moderate Type-3 (0.5 <= similarity < 0.7)
        - Weak Type-3 (similarity < 0.5)
    - Non-clones: Functionally different code pairs

Usage:
    python scripts/evaluate_bcb.py \\
        --model data/models/clone_classifier.joblib \\
        --bcb datasets/bigclonebench \\
        --output reports/evaluations/bcb_evaluation.json

Example:
    python scripts/evaluate_bcb.py \\
        -m data/models/clone_classifier.joblib \\
        -d ../../../../datasets/bigclonebench \\
        -o reports/evaluations/bcb_evaluation.json \\
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
            Path(__file__).parent.parent / "reports" / "bcb_evaluation.log"
        ),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class BCBEvaluationMetrics:
    """Metrics for BCB evaluation."""

    # Overall metrics
    overall_precision: float
    overall_recall: float
    overall_f1_score: float
    overall_accuracy: float

    # By clone type (BigCloneBench classification)
    type1_metrics: Dict[str, float]  # Type-1 (exact)
    type2_metrics: Dict[str, float]  # Type-2 (renamed)
    st3_metrics: Dict[str, float]  # Strong Type-3 (sim >= 0.7)
    mt3_metrics: Dict[str, float]  # Moderate Type-3 (0.5 <= sim < 0.7)
    wt3_metrics: Dict[str, float]  # Weak Type-3 (sim < 0.5)

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
    clone_type: int  # 1, 2, 3, 4, or 0 for non-clone
    similarity: float  # Similarity score from BCB
    code1: str = ""  # Embedded code from JSONL
    code2: str = ""  # Embedded code from JSONL


def load_bcb_dataset(
    bcb_path: str, sample_size: int = 5000
) -> Tuple[List[ClonePair], Optional[Path]]:
    """
    Load BigCloneBench dataset from JSONL format.

    Args:
        bcb_path: Path to BigCloneBench directory
        sample_size: Number of pairs to sample

    Returns:
        Tuple of (pairs_list, source_code_path)
    """
    import pandas as pd

    bcb_dir = Path(bcb_path)

    # Try JSONL format first (our dataset format)
    jsonl_file = bcb_dir / "bigclonebench.jsonl"

    if not jsonl_file.exists():
        # Try other formats
        gt_file = bcb_dir / "groundTruth.json"
        if not gt_file.exists():
            gt_file = bcb_dir / "clones.json"
        if not gt_file.exists():
            gt_file = bcb_dir / "groundTruth.csv"
        if not gt_file.exists():
            raise FileNotFoundError(
                f"Ground truth file not found in {bcb_dir}. "
                "Expected: bigclonebench.jsonl, groundTruth.json, clones.json, or groundTruth.csv"
            )

        # Load from CSV/JSON
        return load_bcb_legacy(gt_file, sample_size)

    logger.info(f"Loading BigCloneBench from {jsonl_file}")

    pairs = []
    with open(jsonl_file, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= sample_size:
                break
            try:
                data = json.loads(line.strip())

                # Extract fields from JSONL format
                id1 = str(data.get("id1", data.get("functionId1", "")))
                id2 = str(data.get("id2", data.get("functionId2", "")))
                clone_type = int(data.get("type", data.get("cloneType", 3)))
                similarity = float(
                    data.get(
                        "similarity", data.get("sim", data.get("similarity_token", 0.5))
                    )
                )

                # Extract embedded code (JSONL format has code1 and code2)
                code1 = data.get("code1", "")
                code2 = data.get("code2", "")

                # Label: 1 for clone types 1-4, 0 for non-clone
                label = 1 if clone_type in [1, 2, 3, 4] else 0

                pairs.append(
                    ClonePair(
                        id1=id1,
                        id2=id2,
                        label=label,
                        clone_type=clone_type,
                        similarity=similarity,
                        code1=code1,
                        code2=code2,
                    )
                )
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Error parsing line {i}: {e}")

    logger.info(f"Loaded {len(pairs)} clone pairs from BCB JSONL")
    logger.info(f"Type distribution:")
    type_dist = {}
    for p in pairs:
        type_dist[p.clone_type] = type_dist.get(p.clone_type, 0) + 1
    for t, c in sorted(type_dist.items()):
        logger.info(f"  Type-{t}: {c}")

    # Source code path (optional for JSONL as code is embedded)
    source_path = bcb_dir / "code"
    if not source_path.exists():
        source_path = None
        logger.info("No external source code directory found (using embedded code)")

    return pairs, source_path


def load_bcb_legacy(
    gt_file: Path, sample_size: int = 5000
) -> Tuple[List[ClonePair], Path]:
    """Load BigCloneBench from legacy CSV/JSON formats."""
    import pandas as pd

    bcb_dir = gt_file.parent
    source_path = bcb_dir / "code"

    logger.info(f"Loading BigCloneBench from {gt_file}")

    # Load based on file format
    if gt_file.suffix == ".json":
        with open(gt_file, "r") as f:
            data = json.load(f)

        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            if "clones" in data:
                df = pd.DataFrame(data["clones"])
            elif "pairs" in data:
                df = pd.DataFrame(data["pairs"])
            else:
                for key, value in data.items():
                    if isinstance(value, list):
                        df = pd.DataFrame(value)
                        break
        else:
            raise ValueError(f"Unsupported JSON structure in {gt_file}")
    else:
        df = pd.read_csv(gt_file)

    # Normalize column names
    df.columns = (
        df.columns.str.lower()
        .str.replace("clone", "")
        .str.replace("id", "id")
        .str.replace("_", "")
    )

    # Find required columns
    id1_col = id2_col = type_col = sim_col = None
    for col in df.columns:
        if "id1" in col or "func1" in col or "source1" in col:
            id1_col = col
        elif "id2" in col or "func2" in col or "source2" in col:
            id2_col = col
        elif "type" in col or "class" in col:
            type_col = col
        elif "sim" in col or "score" in col:
            sim_col = col

    if id1_col is None or id2_col is None:
        id1_col = df.columns[0]
        id2_col = df.columns[1]

    # Sample pairs
    if len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=42)

    pairs = []
    for _, row in df.iterrows():
        id1 = str(row[id1_col])
        id2 = str(row[id2_col])

        clone_type = (
            int(row[type_col])
            if type_col and pd.notna(row.get(type_col, float("nan")))
            else 3
        )
        similarity = (
            float(row[sim_col])
            if sim_col and pd.notna(row.get(sim_col, float("nan")))
            else 0.5
        )

        label = 1 if clone_type in [1, 2, 3, 4] else 0

        pairs.append(
            ClonePair(
                id1=id1,
                id2=id2,
                label=label,
                clone_type=clone_type,
                similarity=similarity,
            )
        )

    logger.info(f"Loaded {len(pairs)} clone pairs from BCB")

    return pairs, source_path


def load_code_for_pair(
    pair: ClonePair, source_path: Optional[Path] = None
) -> Tuple[str, str]:
    """
    Load source code for a clone pair.

    Args:
        pair: ClonePair object
        source_path: Path to source code directory (not needed if code is embedded)

    Returns:
        Tuple of (code1, code2)
    """
    # If code is embedded in JSONL, use it
    if pair.code1 and pair.code2:
        return pair.code1, pair.code2

    if source_path is None:
        return "", ""

    # Try to find files
    file1 = source_path / f"{pair.id1}.java"
    file2 = source_path / f"{pair.id2}.java"

    # Try alternative path structure
    if not file1.exists():
        for java_file in source_path.rglob(f"{pair.id1}.java"):
            file1 = java_file
            break

    if not file2.exists():
        for java_file in source_path.rglob(f"{pair.id2}.java"):
            file2 = java_file
            break

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

    # Handle empty code
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


def classify_clone_type_bcb(similarity: float) -> str:
    """
    Classify clone type based on similarity (BigCloneBench classification).

    Args:
        similarity: Similarity score

    Returns:
        Clone type string ('ST3', 'MT3', 'WT3')
    """
    if similarity >= 0.7:
        return "ST3"  # Strong Type-3
    elif similarity >= 0.5:
        return "MT3"  # Moderate Type-3
    else:
        return "WT3"  # Weak Type-3


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


def evaluate_on_bcb(
    model_path: str,
    bcb_path: str,
    language: str = "java",
    sample_size: int = 5000,
) -> BCBEvaluationMetrics:
    """
    Evaluate trained model on BigCloneBench.

    Args:
        model_path: Path to trained model
        bcb_path: Path to BCB directory
        language: Programming language
        sample_size: Number of pairs to evaluate

    Returns:
        BCBEvaluationMetrics object
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

    # Load BCB dataset
    logger.info("Loading BigCloneBench dataset...")
    pairs, source_path = load_bcb_dataset(bcb_path, sample_size)

    # Evaluate each pair
    logger.info(f"Evaluating {len(pairs)} pairs...")

    y_true = []
    y_pred = []

    # Group by clone type for detailed metrics
    type_groups = {
        1: {"true": [], "pred": []},  # Type-1
        2: {"true": [], "pred": []},  # Type-2
        "ST3": {"true": [], "pred": []},  # Strong Type-3
        "MT3": {"true": [], "pred": []},  # Moderate Type-3
        "WT3": {"true": [], "pred": []},  # Weak Type-3
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
            continue

        # Extract features
        features = extract_features_for_pair(code1, code2, language)

        # Predict
        X = features.reshape(1, -1)
        prediction = clf.predict(X)[0]

        y_true.append(pair.label)
        y_pred.append(prediction)

        # Classify by BCB type (1, 2)
        if pair.clone_type in [1, 2]:
            type_groups[pair.clone_type]["true"].append(pair.label)
            type_groups[pair.clone_type]["pred"].append(prediction)

        # Classify by similarity (ST3, MT3, WT3)
        sim_type = classify_clone_type_bcb(pair.similarity)
        type_groups[sim_type]["true"].append(pair.label)
        type_groups[sim_type]["pred"].append(prediction)

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
    st3_metrics = (
        compute_metrics(type_groups["ST3"]["true"], type_groups["ST3"]["pred"])
        if type_groups["ST3"]["true"]
        else {}
    )
    mt3_metrics = (
        compute_metrics(type_groups["MT3"]["true"], type_groups["MT3"]["pred"])
        if type_groups["MT3"]["true"]
        else {}
    )
    wt3_metrics = (
        compute_metrics(type_groups["WT3"]["true"], type_groups["WT3"]["pred"])
        if type_groups["WT3"]["true"]
        else {}
    )

    total_time = time.time() - start_time

    metrics = BCBEvaluationMetrics(
        overall_precision=overall_metrics["precision"],
        overall_recall=overall_metrics["recall"],
        overall_f1_score=overall_metrics["f1_score"],
        overall_accuracy=overall_metrics["accuracy"],
        type1_metrics=type1_metrics,
        type2_metrics=type2_metrics,
        st3_metrics=st3_metrics,
        mt3_metrics=mt3_metrics,
        wt3_metrics=wt3_metrics,
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


def save_results(metrics: BCBEvaluationMetrics, output_path: str):
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
            "dataset": "BigCloneBench",
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
            "ST3 (Strong Type-3, sim >= 0.7)": {
                k: round(v, 4) for k, v in metrics.st3_metrics.items()
            }
            if metrics.st3_metrics
            else "N/A",
            "MT3 (Moderate Type-3, 0.5 <= sim < 0.7)": {
                k: round(v, 4) for k, v in metrics.mt3_metrics.items()
            }
            if metrics.mt3_metrics
            else "N/A",
            "WT3 (Weak Type-3, sim < 0.5)": {
                k: round(v, 4) for k, v in metrics.wt3_metrics.items()
            }
            if metrics.wt3_metrics
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


def print_results(metrics: BCBEvaluationMetrics):
    """Print evaluation results to console."""
    print("\n" + "=" * 70)
    print("BigCloneBench Evaluation Results")
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

    if metrics.st3_metrics:
        print(f"\n   ST3 (Strong Type-3, sim >= 0.7):")
        print(f"      Precision: {metrics.st3_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.st3_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.st3_metrics.get('f1_score', 0):.4f}")

    if metrics.mt3_metrics:
        print(f"\n   MT3 (Moderate Type-3, 0.5 <= sim < 0.7):")
        print(f"      Precision: {metrics.mt3_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.mt3_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.mt3_metrics.get('f1_score', 0):.4f}")

    if metrics.wt3_metrics:
        print(f"\n   WT3 (Weak Type-3, sim < 0.5):")
        print(f"      Precision: {metrics.wt3_metrics.get('precision', 0):.4f}")
        print(f"      Recall:    {metrics.wt3_metrics.get('recall', 0):.4f}")
        print(f"      F1-Score:  {metrics.wt3_metrics.get('f1_score', 0):.4f}")

    print(f"\n📋 Confusion Matrix:")
    print(f"   True Positives:  {metrics.true_positives}")
    print(f"   False Positives: {metrics.false_positives}")
    print(f"   True Negatives:  {metrics.true_negatives}")
    print(f"   False Negatives: {metrics.false_negatives}")

    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate clone detection model on BigCloneBench"
    )
    parser.add_argument(
        "--model", "-m", type=str, required=True, help="Path to trained model file"
    )
    parser.add_argument(
        "--bcb", "-d", type=str, required=True, help="Path to BigCloneBench directory"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="reports/evaluations/bcb_evaluation.json",
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
    logger.info("BigCloneBench Model Evaluation")
    logger.info("=" * 70)
    logger.info(f"Model:        {args.model}")
    logger.info(f"Dataset:      {args.bcb}")
    logger.info(f"Output:       {args.output}")
    logger.info(f"Language:     {args.language}")
    logger.info(f"Sample Size:  {args.sample_size}")
    logger.info("=" * 70)

    # Run evaluation
    try:
        metrics = evaluate_on_bcb(
            model_path=args.model,
            bcb_path=args.bcb,
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
        logger.error("Make sure BigCloneBench dataset is downloaded and extracted")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        raise


if __name__ == "__main__":
    main()
