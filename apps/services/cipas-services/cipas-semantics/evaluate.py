#!/usr/bin/env python3
"""
Evaluate Type-IV Semantic Clone Detector.

Usage:
    python evaluate.py                          # Use config.yaml defaults
    python evaluate.py --config config.yaml     # Specify custom config
    python evaluate.py --sample-size 2000       # Override specific values
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
    """Main evaluation entry point - config-driven."""
    parser = argparse.ArgumentParser(
        description="Evaluate Type-IV Semantic Clone Detector (Config-Driven)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python evaluate.py                       # Use default config.yaml
  python evaluate.py --config custom.yaml  # Use custom config file  
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

    # Get evaluation config
    eval_config = config.get("evaluation", {})
    model_config = eval_config.get("model", {})
    dataset_config = eval_config.get("dataset", {})

    # Build parameters from config only
    params = {
        "model_path": model_config.get("path", "models/type4_xgb_java.pkl"),
        "dataset_path": dataset_config.get("path")
        or config.get("datasets", {}).get("gptclonebench", {}).get("path"),
        "language": eval_config.get("language"),
        "all_languages": eval_config.get("all_languages", False),
        "sample_size": eval_config.get("sample_size"),
        "threshold": eval_config.get("threshold"),
        "threshold_sweep": eval_config.get("threshold_sweep", True),
        "visualize": eval_config.get("visualize", True),
        "output_dir": eval_config.get("output_dir", "./results/evaluate"),
        "log_level": eval_config.get("log_level", "INFO"),
    }

    # Set logging level
    logging.getLogger().setLevel(getattr(logging, params["log_level"]))

    # Determine languages
    if params["all_languages"]:
        params["languages"] = ["java", "python", "c", "csharp"]
        logger.info(f"Evaluating on ALL 4 languages...")
    elif params["language"] is None:
        params["languages"] = ["java", "python", "c", "csharp"]
        logger.info("No language specified. Evaluating on ALL 4 languages by default.")
    else:
        params["languages"] = [params["language"]]

    # Check model exists
    if not Path(params["model_path"]).exists():
        logger.error(f"Model not found: {params['model_path']}")
        logger.info("Train a model first: python train.py")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("TYPE-IV CODE CLONE DETECTOR - EVALUATION")
    logger.info("=" * 70)
    logger.info(f"Model: {params['model_path']}")
    logger.info(f"Dataset: {params['dataset_path']}")
    logger.info(f"Language(s): {params['languages']}")
    logger.info(f"Sample size: {params['sample_size'] or 'full dataset'}")
    logger.info("=" * 70)

    # Import and run evaluation
    from evaluate_core import evaluate_model

    try:
        all_results = {}
        for lang in params["languages"]:
            logger.info(f"\n{'=' * 70}")
            logger.info(f"EVALUATING LANGUAGE: {lang.upper()}")
            logger.info(f"{'=' * 70}\n")

            metrics = evaluate_model(
                model_path=params["model_path"],
                dataset_path=params["dataset_path"],
                language=lang,
                sample_size=params["sample_size"],
                threshold=params["threshold"],
                threshold_sweep=params["threshold_sweep"],
                visualize=params["visualize"],
                output_dir=params["output_dir"],
            )
            all_results[lang] = metrics

        # Print summary
        logger.info("\n" + "=" * 70)
        logger.info("EVALUATION COMPLETE - SUMMARY")
        logger.info("=" * 70)

        if all_results:
            logger.info(
                f"\n{'Language':<12} {'Accuracy':<10} {'Precision':<10} {'Recall':<10} {'F1':<10}"
            )
            logger.info("-" * 52)
            for lang, metrics in all_results.items():
                m = metrics.get("metrics", metrics) if isinstance(metrics, dict) else {}
                logger.info(
                    f"{lang:<12} {m.get('accuracy', 0):<10.4f} {m.get('precision', 0):<10.4f} "
                    f"{m.get('recall', 0):<10.4f} {m.get('f1', 0):<10.4f}"
                )

        logger.info(f"\nOutputs saved to: {Path(params['output_dir']).absolute()}")
        logger.info("=" * 70)

    except Exception as e:
        logger.error(f"Evaluation failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
