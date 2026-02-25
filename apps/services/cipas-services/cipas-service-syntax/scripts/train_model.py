#!/usr/bin/env python3
"""
Clone Detection Model Training Script

This script trains the Random Forest classifier using ToMA feature vectors
extracted from code clone pairs from the ToMa dataset.

ToMa Dataset Type Mapping:
    - Type 1 = Exact clones (Type-1)
    - Type 2 = Renamed clones (Type-2)
    - Type 3 = Strong Type-3 clones (mapped to Type-3)
    - Type 4 = Moderate Type-3 clones (mapped to Type-3)
    - Type 5 = Type-4 clones (semantic clones, mapped to Type-4)

Training Split: 70:15:15 (train:validate:test)

Usage:
    python scripts/train_model.py --dataset <path> --output <model_path>

Example:
    python scripts/train_model.py \\
        -d ../../../../datasets/toma-dataset \\
        -s ../../../../datasets/toma-dataset/id2sourcecode \\
        -o data/models/clone_classifier.joblib \\
        -l java \\
        -n 10000
"""

import argparse
import json
import logging
import sys
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
        logging.FileHandler(Path(__file__).parent.parent / "reports" / "training.log"),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training configuration."""

    dataset_path: str
    source_dir: str
    output_path: str
    language: str
    sample_size: int
    n_estimators: int
    max_depth: int
    train_ratio: float
    val_ratio: float
    test_ratio: float


@dataclass
class TrainingMetrics:
    """Training metrics."""

    # Dataset info
    total_pairs: int
    clone_pairs: int
    non_clone_pairs: int
    type1_count: int
    type2_count: int
    type3_count: int
    type4_count: int

    # Split info
    train_samples: int
    val_samples: int
    test_samples: int

    # Performance metrics
    accuracy: float
    precision: float
    recall: float
    f1_score: float

    # Training info
    training_time_seconds: float
    timestamp: str

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)


def load_toma_dataset(
    dataset_path: str,
    sample_size: int = 10000,
    type_mapping: Optional[Dict[int, int]] = None,
) -> Tuple[List[Tuple[str, str, int]], List[int]]:
    """
    Load clone pairs from TOMA dataset format.

    ToMa Dataset Format:
        clone.csv: id1, id2, type, sim1, sim2
        nonclone.csv: id1, id2

    Type Mapping (configurable):
        1 = Type-1 (exact clones)
        2 = Type-2 (renamed clones)
        3 = Type-3 strong (mapped to Type-3)
        4 = Type-3 moderate (mapped to Type-3)
        5 = Type-4 (semantic clones)

    Args:
        dataset_path: Path to TOMA dataset directory
        sample_size: Number of pairs to sample per type
        type_mapping: Custom type mapping (default: {1:1, 2:2, 3:3, 4:3, 5:4})

    Returns:
        Tuple of (pairs_list, labels_list)
        - pairs_list: List of (id1, id2, clone_type) tuples
        - labels_list: List of labels (1=clone, 0=non-clone)
    """
    import pandas as pd

    if type_mapping is None:
        # Default mapping: 3+4 -> Type-3, 5 -> Type-4
        type_mapping = {1: 1, 2: 2, 3: 3, 4: 3, 5: 4}

    dataset_dir = Path(dataset_path)
    pairs = []
    labels = []
    type_counts = {1: 0, 2: 0, 3: 0, 4: 0}

    # Load type-specific files if they exist
    type_files = {
        1: "type-1.csv",
        2: "type-2.csv",
        3: "type-3.csv",
        4: "type-3.csv",  # Type 4 (moderate) is in type-3.csv
        5: "type-5.csv",  # Type 5 (Type-4 semantic)
    }

    logger.info(f"Loading clone pairs from {dataset_dir}")

    # Try loading from type-specific files first
    for original_type, filename in type_files.items():
        type_file = dataset_dir / filename
        if type_file.exists():
            logger.info(f"  Loading {filename}...")
            try:
                df = pd.read_csv(type_file, header=None, nrows=sample_size)
                for _, row in df.iterrows():
                    id1 = str(row.iloc[0])
                    id2 = str(row.iloc[1])
                    mapped_type = type_mapping.get(original_type, 3)

                    pairs.append((id1, id2, mapped_type))
                    labels.append(1)  # All are clones
                    type_counts[mapped_type] += 1
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

                pairs.append((id1, id2, mapped_type))
                labels.append(1)
                type_counts[mapped_type] += 1

    # Load non-clone pairs for negative samples
    nonclone_file = dataset_dir / "nonclone.csv"
    if nonclone_file.exists() and len(pairs) > 0:
        logger.info(f"  Loading non-clone pairs...")
        # Balance non-clones with clones
        non_sample_size = min(len(pairs), sample_size)
        try:
            df_non = pd.read_csv(nonclone_file, header=None, nrows=non_sample_size)
            for _, row in df_non.iterrows():
                id1 = str(row.iloc[0])
                id2 = str(row.iloc[1])
                pairs.append((id1, id2, 0))  # 0 = non-clone
                labels.append(0)
        except Exception as e:
            logger.warning(f"  Error loading non-clone pairs: {e}")

    logger.info(f"Loaded {len(pairs)} total pairs")
    logger.info(f"  Type-1 clones: {type_counts[1]}")
    logger.info(f"  Type-2 clones: {type_counts[2]}")
    logger.info(f"  Type-3 clones: {type_counts[3]}")
    logger.info(f"  Type-4 clones: {type_counts[4]}")
    logger.info(f"  Non-clones:    {len(labels) - sum(labels)}")

    return pairs, labels, type_counts


def load_code_from_files(
    pairs: List[Tuple[str, str, int]], source_dir: str
) -> List[Tuple[str, str, int]]:
    """
    Load actual source code for fragment pairs.

    Args:
        pairs: List of (id1, id2, type) tuples
        source_dir: Directory containing source code files

    Returns:
        List of (code1, code2, type) tuples
    """
    source_path = Path(source_dir)
    code_pairs = []
    missing_files = 0

    for id1, id2, clone_type in pairs:
        file1 = source_path / f"{id1}.java"
        file2 = source_path / f"{id2}.java"

        if file1.exists() and file2.exists():
            code1 = file1.read_text(encoding="utf-8", errors="ignore")
            code2 = file2.read_text(encoding="utf-8", errors="ignore")
            code_pairs.append((code1, code2, clone_type))
        else:
            # Skip pairs with missing files
            missing_files += 1
            if missing_files <= 10:
                logger.warning(f"  Missing files for pair ({id1}, {id2})")

    if missing_files > 10:
        logger.warning(f"  ... and {missing_files - 10} more missing file pairs")

    logger.info(f"Loaded source code for {len(code_pairs)}/{len(pairs)} pairs")
    logger.info(f"  Missing files: {missing_files}")

    return code_pairs


def extract_toma_features(
    code_pairs: List[Tuple[str, str, int]], language: str = "java"
) -> Tuple[np.ndarray, List[int]]:
    """
    Extract ToMA 6D feature vectors from code pairs.

    Features:
        1. Levenshtein distance
        2. Levenshtein ratio
        3. Jaro similarity
        4. Jaro-Winkler similarity
        5. Jaccard similarity
        6. Dice coefficient

    Args:
        code_pairs: List of (code1, code2, type) tuples
        language: Programming language

    Returns:
        Tuple of (feature_matrix, labels)
    """
    import sys
    from pathlib import Path

    # Add src to path for imports
    src_path = Path(__file__).parent.parent / "src"
    sys.path.insert(0, str(src_path))

    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    logger.info(f"Extracting ToMA features for {len(code_pairs)} pairs...")

    engine = ParserEngine()
    mapper = ToMAMapper(language)
    extractor = FeatureExtractor()

    features = []
    labels = []
    valid_pairs = 0
    error_pairs = 0

    for i, (code1, code2, clone_type) in enumerate(code_pairs):
        if not code1.strip() or not code2.strip():
            features.append([0.0] * 6)
            labels.append(1 if clone_type > 0 else 0)
            continue

        try:
            tree1 = engine.parse(code1.encode(), language)
            tree2 = engine.parse(code2.encode(), language)

            tokens1 = mapper.map_fragment(tree1.root_node, code1.encode())
            tokens2 = mapper.map_fragment(tree2.root_node, code2.encode())

            if len(tokens1) == 0 or len(tokens2) == 0:
                features.append([0.0] * 6)
                labels.append(1 if clone_type > 0 else 0)
                continue

            feat = extractor.extract_features(tokens1, tokens2)
            features.append(list(feat))
            labels.append(1 if clone_type > 0 else 0)
            valid_pairs += 1

        except Exception as e:
            logger.debug(f"  Error processing pair {i}: {e}")
            features.append([0.0] * 6)
            labels.append(1 if clone_type > 0 else 0)
            error_pairs += 1

        if (i + 1) % 1000 == 0:
            logger.info(f"  Processed {i + 1}/{len(code_pairs)} pairs...")

    logger.info(
        f"Successfully extracted features for {valid_pairs}/{len(code_pairs)} pairs"
    )
    if error_pairs > 0:
        logger.warning(f"  Errors: {error_pairs}")

    return np.array(features), labels


def train_classifier(
    X: np.ndarray,
    y: List[int],
    config: TrainingConfig,
) -> Tuple["RandomForestClassifier", Dict, Dict]:
    """
    Train Random Forest classifier with 70:15:15 train:val:test split.

    Args:
        X: Feature matrix (N x 6)
        y: Labels (0 or 1)
        config: Training configuration

    Returns:
        Tuple of (trained_classifier, test_metrics, all_splits)
    """
    import sys
    from pathlib import Path

    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )
    from sklearn.model_selection import train_test_split

    # Add src to path for imports
    src_path = Path(__file__).parent.parent / "src"
    sys.path.insert(0, str(src_path))

    from ml import RandomForestClassifier

    train_ratio = config.train_ratio
    val_ratio = config.val_ratio
    test_ratio = config.test_ratio

    logger.info("Training Random Forest classifier...")
    logger.info(f"  - n_estimators: {config.n_estimators}")
    logger.info(f"  - max_depth: {config.max_depth}")
    logger.info(
        f"  - split ratios: {train_ratio:.0%} train, {val_ratio:.0%} val, {test_ratio:.0%} test"
    )

    # First split: separate test set
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=test_ratio, random_state=42, stratify=y
    )

    # Second split: separate train and validation from remaining
    val_adjusted = val_ratio / (train_ratio + val_ratio)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_adjusted, random_state=42, stratify=y_temp
    )

    logger.info(
        f"  - Train samples: {len(X_train)} ({len(X_train) / len(X) * 100:.1f}%)"
    )
    logger.info(f"  - Val samples:   {len(X_val)} ({len(X_val) / len(X) * 100:.1f}%)")
    logger.info(f"  - Test samples:  {len(X_test)} ({len(X_test) / len(X) * 100:.1f}%)")

    # Initialize classifier
    clf = RandomForestClassifier(
        n_estimators=config.n_estimators,
        max_depth=config.max_depth,
        random_state=42,
    )

    # Train on training set
    logger.info("\n[Training] Fitting model on training set...")
    import time

    start_time = time.time()
    clf.model.fit(X_train, y_train)
    training_time = time.time() - start_time
    clf.is_trained = True
    logger.info(f"  Training completed in {training_time:.2f} seconds")

    # Evaluate on validation set
    logger.info("\n[Validation] Evaluating on validation set...")
    y_val_pred = clf.predict(X_val)
    val_metrics = {
        "accuracy": float(accuracy_score(y_val, y_val_pred)),
        "precision": float(precision_score(y_val, y_val_pred)),
        "recall": float(recall_score(y_val, y_val_pred)),
        "f1_score": float(f1_score(y_val, y_val_pred)),
    }

    logger.info(f"  Validation Accuracy:  {val_metrics['accuracy']:.4f}")
    logger.info(f"  Validation Precision: {val_metrics['precision']:.4f}")
    logger.info(f"  Validation Recall:    {val_metrics['recall']:.4f}")
    logger.info(f"  Validation F1-Score:  {val_metrics['f1_score']:.4f}")

    # Final evaluation on test set
    logger.info("\n[Testing] Final evaluation on test set...")
    y_test_pred = clf.predict(X_test)

    test_metrics = {
        "accuracy": float(accuracy_score(y_test, y_test_pred)),
        "precision": float(precision_score(y_test, y_test_pred)),
        "recall": float(recall_score(y_test, y_test_pred)),
        "f1_score": float(f1_score(y_test, y_test_pred)),
        "confusion_matrix": confusion_matrix(y_test, y_test_pred).tolist(),
        "classification_report": classification_report(
            y_test, y_test_pred, target_names=["non-clone", "clone"]
        ),
        "feature_importances": dict(
            zip(clf.feature_names, clf.model.feature_importances_.tolist())
        ),
        "split_info": {
            "train_samples": len(X_train),
            "val_samples": len(X_val),
            "test_samples": len(X_test),
            "train_ratio": train_ratio,
            "val_ratio": val_ratio,
            "test_ratio": test_ratio,
        },
    }

    all_splits = {
        "X_train": X_train,
        "X_val": X_val,
        "X_test": X_test,
        "y_train": y_train,
        "y_val": y_val,
        "y_test": y_test,
        "y_val_pred": y_val_pred,
        "y_test_pred": y_test_pred,
    }

    return clf, test_metrics, all_splits, training_time


def save_model(
    clf: "RandomForestClassifier",
    output_path: str,
    metrics: Dict,
    config: TrainingConfig,
    type_counts: Dict[int, int],
    training_time: float,
):
    """
    Save trained model and metrics.

    Args:
        clf: Trained classifier
        output_path: Path to save model
        metrics: Training metrics
        config: Training configuration
        type_counts: Count of each clone type
        training_time: Total training time
    """
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Save model
    clf.save(str(output_file))
    logger.info(f"Model saved to: {output_file}")

    # Save metrics
    metrics_file = output_file.with_suffix(".json")
    training_metrics = TrainingMetrics(
        total_pairs=metrics["split_info"]["train_samples"]
        + metrics["split_info"]["val_samples"]
        + metrics["split_info"]["test_samples"],
        clone_pairs=sum(type_counts.values()),
        non_clone_pairs=metrics["split_info"]["train_samples"]
        + metrics["split_info"]["val_samples"]
        + metrics["split_info"]["test_samples"]
        - sum(type_counts.values()),
        type1_count=type_counts.get(1, 0),
        type2_count=type_counts.get(2, 0),
        type3_count=type_counts.get(3, 0),
        type4_count=type_counts.get(4, 0),
        train_samples=metrics["split_info"]["train_samples"],
        val_samples=metrics["split_info"]["val_samples"],
        test_samples=metrics["split_info"]["test_samples"],
        accuracy=metrics["accuracy"],
        precision=metrics["precision"],
        recall=metrics["recall"],
        f1_score=metrics["f1_score"],
        training_time_seconds=training_time,
        timestamp=datetime.now().isoformat(),
    )

    with open(metrics_file, "w") as f:
        json.dump(training_metrics.to_dict(), f, indent=2)
    logger.info(f"Metrics saved to: {metrics_file}")

    # Save detailed report
    report_file = output_file.parent / "training_report.json"
    report = {
        "config": {
            "dataset_path": config.dataset_path,
            "source_dir": config.source_dir,
            "language": config.language,
            "sample_size": config.sample_size,
            "n_estimators": config.n_estimators,
            "max_depth": config.max_depth,
            "split_ratios": {
                "train": config.train_ratio,
                "val": config.val_ratio,
                "test": config.test_ratio,
            },
        },
        "metrics": metrics,
        "type_distribution": type_counts,
        "timestamp": datetime.now().isoformat(),
    }

    with open(report_file, "w") as f:
        json.dump(report, f, indent=2, default=str)
    logger.info(f"Training report saved to: {report_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Train clone detection classifier using ToMA features"
    )
    parser.add_argument(
        "--dataset",
        "-d",
        type=str,
        default="datasets/toma-dataset",
        help="Path to dataset directory",
    )
    parser.add_argument(
        "--source-dir",
        "-s",
        type=str,
        default="datasets/toma-dataset/id2sourcecode",
        help="Path to source code files",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="data/models/clone_classifier.joblib",
        help="Output path for trained model",
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
        help="Number of pairs to sample for training",
    )
    parser.add_argument(
        "--n-estimators",
        type=int,
        default=100,
        help="Number of trees in Random Forest",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=10,
        help="Maximum tree depth",
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.70,
        help="Training set ratio (default: 0.70)",
    )
    parser.add_argument(
        "--val-ratio",
        type=float,
        default=0.15,
        help="Validation set ratio (default: 0.15)",
    )
    parser.add_argument(
        "--test-ratio",
        type=float,
        default=0.15,
        help="Test set ratio (default: 0.15)",
    )

    args = parser.parse_args()

    # Validate ratios
    total_ratio = args.train_ratio + args.val_ratio + args.test_ratio
    if abs(total_ratio - 1.0) > 0.01:
        logger.error(f"Split ratios must sum to 1.0 (got {total_ratio})")
        sys.exit(1)

    config = TrainingConfig(
        dataset_path=args.dataset,
        source_dir=args.source_dir,
        output_path=args.output,
        language=args.language,
        sample_size=args.sample_size,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
    )

    logger.info("=" * 70)
    logger.info("Clone Detection Model Training")
    logger.info("=" * 70)
    logger.info(f"Dataset:     {config.dataset_path}")
    logger.info(f"Source:      {config.source_dir}")
    logger.info(f"Output:      {config.output_path}")
    logger.info(f"Language:    {config.language}")
    logger.info(f"Sample:      {config.sample_size} pairs")
    logger.info(
        f"Split:       {config.train_ratio:.0%} train, {config.val_ratio:.0%} val, {config.test_ratio:.0%} test"
    )
    logger.info(
        f"Model:       {config.n_estimators} trees, max_depth={config.max_depth}"
    )
    logger.info("=" * 70)

    try:
        # Step 1: Load dataset
        logger.info("\n[Step 1/4] Loading ToMa dataset...")
        pairs, labels, type_counts = load_toma_dataset(
            config.dataset_path,
            config.sample_size,
            type_mapping={1: 1, 2: 2, 3: 3, 4: 3, 5: 4},  # 3+4 -> Type-3, 5 -> Type-4
        )
        logger.info(
            f"Loaded {len(pairs)} pairs ({sum(labels)} clones, {len(labels) - sum(labels)} non-clones)"
        )

        # Step 2: Load source code
        logger.info("\n[Step 2/4] Loading source code...")
        code_pairs = load_code_from_files(pairs, config.source_dir)

        if len(code_pairs) == 0:
            logger.error("No valid code pairs loaded. Check source directory.")
            sys.exit(1)

        # Step 3: Extract ToMA features
        logger.info("\n[Step 3/4] Extracting ToMA features...")
        X, y = extract_toma_features(code_pairs, config.language)

        logger.info(f"Feature matrix shape: {X.shape}")
        logger.info(f"Labels distribution: {np.bincount(y)}")

        # Step 4: Train classifier
        logger.info("\n[Step 4/4] Training classifier...")
        clf, metrics, splits, training_time = train_classifier(X, y, config)

        # Log final results
        logger.info("\n" + "=" * 70)
        logger.info("Final Test Set Results:")
        logger.info("=" * 70)
        logger.info(f"Accuracy:   {metrics['accuracy']:.4f}")
        logger.info(f"Precision:  {metrics['precision']:.4f}")
        logger.info(f"Recall:     {metrics['recall']:.4f}")
        logger.info(f"F1-Score:   {metrics['f1_score']:.4f}")
        logger.info("\nClassification Report:")
        logger.info(metrics["classification_report"])
        logger.info("\nConfusion Matrix:")
        logger.info(np.array(metrics["confusion_matrix"]))
        logger.info("\nFeature Importances:")
        for feat, imp in sorted(
            metrics["feature_importances"].items(), key=lambda x: x[1], reverse=True
        ):
            logger.info(f"  {feat}: {imp:.4f}")
        logger.info("=" * 70)

        # Save model
        logger.info("\n[Saving] Saving model and metrics...")
        save_model(clf, config.output_path, metrics, config, type_counts, training_time)

        logger.info("\n✅ Training complete!")
        logger.info(f"Model saved to: {config.output_path}")
        logger.info(
            f"Metrics saved to: {Path(config.output_path).with_suffix('.json')}"
        )

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise


if __name__ == "__main__":
    main()
