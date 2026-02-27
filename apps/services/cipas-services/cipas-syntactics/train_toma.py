"""
Training Script for TOMA Dataset.

Trains a hybrid syntactic + structural XGBoost classifier on TOMA format datasets.

TOMA Dataset Format:
- clone.csv: FUNCTION_ID_ONE, FUNCTION_ID_TWO, CLONE_TYPE, SIM1, SIM2
- nonclone.csv: FUNCTION_ID_ONE, FUNCTION_ID_TWO
- id2sourcecode/: Directory with individual .java files named by function ID

Usage:
    # Basic training
    poetry run python train_toma.py \
        --dataset /path/to/toma-dataset \
        --model-name toma_trained_xgb.pkl

    # Training with custom hyperparameters
    poetry run python train_toma.py \
        --dataset /path/to/toma-dataset \
        --model-name toma_trained_xgb.pkl \
        --n-estimators 200 \
        --max-depth 8 \
        --learning-rate 0.05

    # Training with specific clone types
    poetry run python train_toma.py \
        --dataset /path/to/toma-dataset \
        --model-name toma_trained_xgb.pkl \
        --clone-types 1 2 3 \
        --sample-size 10000
"""

import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

from clone_detection.features.syntactic_features import SyntacticFeatureExtractor
from clone_detection.models.classifiers import SyntacticClassifier
from clone_detection.utils.common_setup import setup_logging

logger = setup_logging(__name__)


def load_toma_dataset(
    dataset_dir: str,
    sample_size: int | None = None,
    clone_types: list[int] | None = None,
) -> tuple[list[str], list[str], list[int]]:
    """
    Load TOMA dataset from directory structure.

    Args:
        dataset_dir: Path to TOMA dataset directory
        sample_size: Optional sample size for each class
        clone_types: Optional list of clone types to include (1-5)

    Returns:
        Tuple of (code1_list, code2_list, labels)
    """
    dataset_path = Path(dataset_dir)
    id2code_dir = dataset_path / "id2sourcecode"

    if not id2code_dir.exists():
        raise ValueError(f"id2sourcecode directory not found at {id2code_dir}")

    def load_code_from_id(func_id: str) -> str | None:
        """Load source code from function ID."""
        code_file = id2code_dir / f"{func_id}.java"
        if code_file.exists():
            try:
                with open(code_file, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
            except Exception:
                return None
        return None

    code1_list = []
    code2_list = []
    labels = []

    # Load clone pairs
    clone_file = dataset_path / "clone.csv"
    if clone_file.exists():
        logger.info(f"Loading clones from {clone_file}...")
        df_clones = pd.read_csv(
            clone_file,
            header=None,
            names=["FUNCTION_ID_ONE", "FUNCTION_ID_TWO", "CLONE_TYPE", "SIM1", "SIM2"],
        )

        if clone_types is not None:
            df_clones = df_clones[df_clones["CLONE_TYPE"].isin(clone_types)]
            logger.info(f"Filtered to clone types: {clone_types}")

        total_clones = len(df_clones)
        if sample_size and total_clones > sample_size:
            logger.info(f"Sampling {sample_size} clone pairs from {total_clones}")
            df_clones = df_clones.sample(n=sample_size, random_state=42)
            total_clones = sample_size

        logger.info(f"Processing {total_clones} clone pairs...")
        processed = 0
        for _, row in tqdm(
            df_clones.iterrows(), total=total_clones, desc="Loading clone pairs"
        ):
            id1 = str(int(row["FUNCTION_ID_ONE"]))
            id2 = str(int(row["FUNCTION_ID_TWO"]))

            code1 = load_code_from_id(id1)
            code2 = load_code_from_id(id2)

            if code1 and code2:
                code1_list.append(code1)
                code2_list.append(code2)
                labels.append(1)
                processed += 1

        logger.info(f"Loaded {processed} clone pairs with valid code")

    # Load non-clone pairs
    nonclone_file = dataset_path / "nonclone.csv"
    if nonclone_file.exists():
        logger.info(f"Loading non-clones from {nonclone_file}...")
        df_nonclones = pd.read_csv(nonclone_file)

        total_nonclones = len(df_nonclones)
        if sample_size and total_nonclones > sample_size:
            logger.info(
                f"Sampling {sample_size} non-clone pairs from {total_nonclones}"
            )
            df_nonclones = df_nonclones.sample(n=sample_size, random_state=42)
            total_nonclones = sample_size

        logger.info(f"Processing {total_nonclones} non-clone pairs...")
        processed = 0
        for _, row in tqdm(
            df_nonclones.iterrows(),
            total=total_nonclones,
            desc="Loading non-clone pairs",
        ):
            id1 = str(int(row["FUNCTION_ID_ONE"]))
            id2 = str(int(row["FUNCTION_ID_TWO"]))

            code1 = load_code_from_id(id1)
            code2 = load_code_from_id(id2)

            if code1 and code2:
                code1_list.append(code1)
                code2_list.append(code2)
                labels.append(0)
                processed += 1

        logger.info(f"Loaded {processed} non-clone pairs with valid code")

    return code1_list, code2_list, labels


def extract_features_for_dataset(
    code1_list: list[str],
    code2_list: list[str],
    language: str = "java",
    include_node_types: bool = True,
) -> tuple[np.ndarray, list[str]]:
    """
    Extract hybrid syntactic + structural features for all code pairs.

    Args:
        code1_list: List of first code snippets
        code2_list: List of second code snippets
        language: Programming language
        include_node_types: Whether to include node type distribution features

    Returns:
        Tuple of (feature matrix, feature names list)
    """
    extractor = SyntacticFeatureExtractor(
        language=language, include_node_types=include_node_types
    )
    features = []
    failed = 0

    for code1, code2 in tqdm(
        zip(code1_list, code2_list),
        total=len(code1_list),
        desc="Extracting hybrid features",
    ):
        try:
            feat = extractor.extract_features_from_code(code1, code2, language)
            features.append(feat)
        except Exception as e:
            logger.debug(f"Failed to extract features: {e}")
            failed += 1
            features.append(np.zeros(len(extractor.feature_names)))

    if failed > 0:
        logger.warning(f"Failed to extract features for {failed} pairs")

    return np.array(features), extractor.get_feature_names()


def train_toma_model(
    dataset_path: str,
    language: str = "java",
    model_name: str = "toma_trained_xgb.pkl",
    test_size: float = 0.2,
    cross_validation: bool = True,
    n_estimators: int = 100,
    max_depth: int = 6,
    learning_rate: float = 0.1,
    subsample: float = 0.8,
    colsample_bytree: float = 0.8,
    sample_size: int | None = None,
    clone_types: list[int] | None = None,
    include_node_types: bool = True,
    use_gpu: bool = False,
) -> dict:
    """
    Train the hybrid syntactic + structural clone detection model on TOMA dataset.

    Args:
        dataset_path: Path to TOMA dataset directory
        language: Programming language
        model_name: Name for saved model
        test_size: Fraction of data for testing
        cross_validation: Whether to use cross-validation
        n_estimators: Number of boosting rounds (trees)
        max_depth: Maximum tree depth
        learning_rate: Learning rate (eta)
        subsample: Subsample ratio of training instances
        colsample_bytree: Subsample ratio of columns per tree
        sample_size: Optional sample size per class
        clone_types: Optional list of clone types to include (1-5)
        include_node_types: Whether to include node type distribution features
        use_gpu: Whether to use GPU acceleration

    Returns:
        Training metrics dictionary
    """
    logger.info("=" * 80)
    logger.info("TOMA Dataset Model Training")
    logger.info("=" * 80)
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Language: {language}")
    logger.info(f"Model output: models/{model_name}")
    logger.info(f"GPU acceleration: {'Enabled' if use_gpu else 'Disabled'}")
    logger.info("=" * 80)

    # Load dataset
    code1_list, code2_list, labels = load_toma_dataset(
        dataset_path, sample_size=sample_size, clone_types=clone_types
    )

    logger.info(f"Loaded {len(code1_list)} code pairs")
    logger.info(
        f"Class distribution: {sum(labels)} clones ({sum(labels) / len(labels) * 100:.1f}%), "
        f"{len(labels) - sum(labels)} non-clones ({(len(labels) - sum(labels)) / len(labels) * 100:.1f}%)"
    )

    # Extract features
    logger.info("Extracting hybrid syntactic + structural features...")
    X, feature_names = extract_features_for_dataset(
        code1_list, code2_list, language, include_node_types
    )
    y = np.array(labels)

    logger.info(f"Feature matrix shape: {X.shape}")
    logger.info(f"Number of features: {len(feature_names)}")

    # Create and train classifier
    classifier = SyntacticClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        subsample=subsample,
        colsample_bytree=colsample_bytree,
        feature_names=feature_names,
        use_gpu=use_gpu,
    )

    logger.info("\nTraining XGBoost classifier...")
    logger.info(f"  - n_estimators: {n_estimators}")
    logger.info(f"  - max_depth: {max_depth}")
    logger.info(f"  - learning_rate: {learning_rate}")
    logger.info(f"  - subsample: {subsample}")
    logger.info(f"  - colsample_bytree: {colsample_bytree}")
    logger.info(f"  - test_size: {test_size}")
    logger.info(f"  - cross_validation: {cross_validation}")
    logger.info("")

    metrics = classifier.train(
        X, y, test_size=test_size, cross_validation=cross_validation
    )

    # Save model
    saved_path = classifier.save(model_name)
    logger.info(f"\nModel saved to {saved_path}")

    # Log feature importances
    logger.info("\n" + "=" * 80)
    logger.info("Top 20 Feature Importances:")
    logger.info("=" * 80)
    importance_sorted = classifier.get_feature_importance_sorted()
    for feat_name, importance in importance_sorted[:20]:
        logger.info(f"  {feat_name}: {importance:.4f}")

    logger.info("\n" + "=" * 80)
    logger.info("Training Complete!")
    logger.info("=" * 80)
    for metric, value in metrics.items():
        logger.info(f"{metric}: {value:.4f}")

    return metrics


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Train clone detection model on TOMA dataset"
    )
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to TOMA dataset directory",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="java",
        choices=["java", "c", "python"],
        help="Programming language (default: java)",
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="toma_trained_xgb.pkl",
        help="Output model filename (default: toma_trained_xgb.pkl)",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Test set size ratio (default: 0.2)",
    )
    parser.add_argument(
        "--no-cv",
        action="store_true",
        help="Disable cross-validation",
    )
    parser.add_argument(
        "--n-estimators",
        type=int,
        default=100,
        help="Number of boosting rounds (trees) (default: 100)",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=6,
        help="Maximum tree depth (default: 6)",
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=0.1,
        help="Learning rate (eta) (default: 0.1)",
    )
    parser.add_argument(
        "--subsample",
        type=float,
        default=0.8,
        help="Subsample ratio of training instances (default: 0.8)",
    )
    parser.add_argument(
        "--colsample-bytree",
        type=float,
        default=0.8,
        help="Subsample ratio of columns per tree (default: 0.8)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=None,
        help="Sample size per class (optional)",
    )
    parser.add_argument(
        "--clone-types",
        type=int,
        nargs="+",
        default=None,
        help="Clone types to include (1-5, optional)",
    )
    parser.add_argument(
        "--no-node-types",
        action="store_true",
        help="Disable node type distribution features",
    )
    parser.add_argument(
        "--use-gpu",
        action="store_true",
        help="Use GPU acceleration for training",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    train_toma_model(
        dataset_path=args.dataset,
        language=args.language,
        model_name=args.model_name,
        test_size=args.test_size,
        cross_validation=not args.no_cv,
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        subsample=args.subsample,
        colsample_bytree=args.colsample_bytree,
        sample_size=args.sample_size,
        clone_types=args.clone_types,
        include_node_types=not args.no_node_types,
        use_gpu=args.use_gpu,
    )
