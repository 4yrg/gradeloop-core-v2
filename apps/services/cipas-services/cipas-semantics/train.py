#!/usr/bin/env python3
"""
Train Type-IV Semantic Clone Detector.

Usage:
    python train.py                          # Use config.yaml defaults
    python train.py --config config.yaml     # Specify custom config
    python train.py --sample-size 20000      # Override specific values
"""

import argparse
import logging
import sys
from pathlib import Path

import yaml

from clone_detection.utils.common_setup import setup_logging

logger = setup_logging(__name__)

DEFAULT_CONFIG_PATH = Path(__file__).parent / "config.yaml"


def load_config(config_path: Path) -> dict:
    """Load configuration from YAML file."""
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def main():
    """Main training entry point - config-driven."""
    parser = argparse.ArgumentParser(
        description="Train Type-IV Semantic Clone Detector (Config-Driven)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python train.py                          # Use default config.yaml
  python train.py --config custom.yaml     # Use custom config file
        """,
    )

    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Path to YAML config file (default: config.yaml)",
    )

    args = parser.parse_args()

    # Load config
    if not args.config.exists():
        logger.error(f"Config file not found: {args.config}")
        sys.exit(1)

    config = load_config(args.config)
    logger.info(f"Loaded configuration from: {args.config}")

    # Get training config
    training_config = config.get("training", {})
    model_config = training_config.get("model", {})
    dataset_config = training_config.get("dataset", {})
    gptclonebench_config = training_config.get("gptclonebench", {})
    xgboost_config = training_config.get("xgboost", {})

    # Build parameters from config only
    params = {
        "dataset_path": dataset_config.get("path")
        or config.get("datasets", {}).get("codenet", {}).get("path"),
        "language": dataset_config.get("language", "java"),
        "languages": (
            ["java", "python", "c", "csharp"]
            if dataset_config.get("all_languages")
            else dataset_config.get("languages")
        ),
        "model_name": model_config.get("name", "type4_xgb_codenet.pkl"),
        "model_dir": model_config.get("dir", "./models"),
        "sample_size": training_config.get("sample_size"),
        "clone_ratio": training_config.get("clone_ratio", 0.5),
        "hard_negative_ratio": training_config.get("hard_negative_ratio", 0.20),
        "include_gptclonebench": training_config.get("include_gptclonebench", False),
        "gptclonebench_path": gptclonebench_config.get("path")
        or config.get("datasets", {}).get("gptclonebench", {}).get("path"),
        "gptclonebench_ratio": gptclonebench_config.get("ratio", 0.10),
        "max_problems": training_config.get("max_problems"),
        "test_size": training_config.get("test_size", 0.2),
        "output_dir": model_config.get("output_dir", "./results/train"),
        "visualize": training_config.get("visualize", True),
        "cross_validation": training_config.get("cross_validation", False),
        "xgboost_params": xgboost_config if xgboost_config else None,
    }

    # Set logging level
    log_level = training_config.get("log_level", "INFO")
    logging.getLogger().setLevel(getattr(logging, log_level))

    # Create model directory
    model_dir = Path(params["model_dir"])
    model_dir.mkdir(parents=True, exist_ok=True)

    # Verify dataset exists
    dataset_path = Path(params["dataset_path"])
    if not dataset_path.exists():
        logger.error(f"Dataset not found: {dataset_path}")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("TYPE-IV CODE CLONE DETECTOR - TRAINING")
    logger.info("=" * 70)
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Language(s): {params['languages'] or [params['language']]}")
    logger.info(f"Sample size: {params['sample_size'] or 'Full dataset'}")
    logger.info(f"Model output: {model_dir / params['model_name']}")
    logger.info("=" * 70)

    # Import and run training
    from train_codenet_core import train_codenet

    try:
        metrics = train_codenet(**params)

        logger.info("\n" + "=" * 70)
        logger.info("TRAINING COMPLETE")
        logger.info("=" * 70)
        logger.info(f"Model saved to: {(model_dir / params['model_name']).absolute()}")

        if metrics:
            logger.info("\nPerformance Metrics:")
            for key, value in metrics.items():
                if isinstance(value, float):
                    logger.info(f"  {key.replace('_', ' ').title()}: {value:.4f}")

        logger.info("\nNext step: Evaluate the model")
        logger.info("  python evaluate.py")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
