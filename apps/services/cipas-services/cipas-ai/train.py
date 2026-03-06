#!/usr/bin/env python3
"""
train.py — Train the CIPAS-AI detection pipeline.

Default (no flags): trains the full 2-stage pipeline.

  python train.py                                  # pipeline on all configured datasets
  python train.py --model catboost                 # Stage 1 only
  python train.py --model droiddetect              # Stage 2 only
  python train.py --dataset DroidCollection        # specific dataset
  python train.py --max-samples 5000 --verbose     # quick sanity run
"""

import asyncio
import argparse
import sys
from pathlib import Path
import logging

sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import TrainingOrchestrator


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train CIPAS-AI models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  python train.py                              train full pipeline (catboost → droiddetect)
  python train.py --model catboost             train Stage 1 only
  python train.py --model droiddetect          train Stage 2 only
  python train.py --dataset DroidCollection    use a specific dataset
  python train.py --max-samples 2000           limit samples (quick test)
""",
    )
    parser.add_argument("--config", default="config.yaml",
                        help="Config file path (default: config.yaml)")
    parser.add_argument("--model", choices=["pipeline", "catboost", "droiddetect"],
                        default="pipeline",
                        help="What to train (default: pipeline = both stages)")
    parser.add_argument("--dataset", default=None,
                        help="Dataset name from config.yaml. Defaults to all "
                             "datasets listed under datasets.default_training")
    parser.add_argument("--max-samples", type=int, default=None,
                        help="Cap training samples per dataset (useful for quick tests)")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable verbose logging")
    return parser.parse_args()


def _bar(progress: float, message: str) -> None:
    print(f"  [{progress:5.1f}%] {message}", flush=True)


def _print_result(results: dict) -> None:
    sep = "=" * 56
    print(f"\n{sep}")
    print(f"  model     : {results['model_type']}")
    print(f"  dataset   : {results['dataset']}")
    print(f"  train     : {results['training_samples']} samples")
    print(f"  test      : {results['test_samples']} samples")
    if results.get("metrics"):
        m = results["metrics"]
        print(f"  accuracy  : {m.get('accuracy', 'n/a'):.4f}" if isinstance(m.get('accuracy'), float) else f"  accuracy  : {m.get('accuracy', 'n/a')}")
    print(f"  saved to  : {results['model_path']}")
    print(sep)


async def train_stage(orchestrator, model_type: str, dataset: str,
                      max_samples: int | None) -> dict:
    config_overrides = {"max_train_samples": max_samples} if max_samples else None
    return await orchestrator.run_training(
        dataset=dataset,
        model_type=model_type,
        config_overrides=config_overrides,
        progress_callback=_bar,
    )


async def main():
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    )

    settings = Settings.from_yaml(args.config)
    orchestrator = TrainingOrchestrator(settings)

    # Resolve which dataset(s) to use
    if args.dataset:
        datasets = [args.dataset]
    else:
        datasets = list(settings.datasets.available.keys())

    # Resolve which model stages to train
    stages = ["catboost", "droiddetect"] if args.model == "pipeline" else [args.model]

    all_results = []

    for stage in stages:
        print(f"\n{'─'*56}")
        print(f"  STAGE: {stage.upper()}")
        print(f"{'─'*56}")
        for dataset in datasets:
            print(f"  dataset → {dataset}")
            try:
                result = await train_stage(orchestrator, stage, dataset, args.max_samples)
                all_results.append(result)
                _print_result(result)
            except Exception as exc:  # noqa: BLE001
                print(f"  ✗ {stage}/{dataset} failed: {exc}")
                if args.verbose:
                    import traceback
                    traceback.print_exc()
                sys.exit(1)

    print(f"\n✓ Training complete — {len(all_results)} model(s) saved to {settings.output.models_dir}/")


if __name__ == "__main__":
    asyncio.run(main())