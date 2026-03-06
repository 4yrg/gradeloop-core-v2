#!/usr/bin/env python3
"""
train.py — Train the CIPAS-AI detection pipeline.

All settings are read from config.yaml (cli.train section).
Just run:  python train.py

To change behaviour, edit config.yaml:

  cli:
    train:
      model: pipeline          # pipeline | catboost | droiddetect
      dataset: null            # null = all default_training datasets
      max_samples: null        # null = no limit
      verbose: false
"""

import asyncio
import sys
from pathlib import Path
import logging

sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import TrainingOrchestrator


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
        acc = m.get("accuracy", "n/a")
        print(f"  accuracy  : {acc:.4f}" if isinstance(acc, float) else f"  accuracy  : {acc}")
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
    settings = Settings()
    cfg = settings.cli.train

    logging.basicConfig(
        level=logging.DEBUG if cfg.verbose else logging.WARNING,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    )

    orchestrator = TrainingOrchestrator(settings)
    datasets = [cfg.dataset] if cfg.dataset else list(settings.datasets.available.keys())
    stages = ["catboost", "droiddetect"] if cfg.model == "pipeline" else [cfg.model]

    all_results = []

    for stage in stages:
        print(f"\n{'─'*56}")
        print(f"  STAGE: {stage.upper()}")
        print(f"{'─'*56}")
        for dataset in datasets:
            print(f"  dataset → {dataset}")
            try:
                result = await train_stage(orchestrator, stage, dataset, cfg.max_samples)
                all_results.append(result)
                _print_result(result)
            except Exception as exc:  # noqa: BLE001
                print(f"  ✗ {stage}/{dataset} failed: {exc}")
                if cfg.verbose:
                    import traceback
                    traceback.print_exc()
                sys.exit(1)

    print(f"\n✓ Training complete — {len(all_results)} model(s) saved to {settings.output.models_dir}/")


if __name__ == "__main__":
    asyncio.run(main())
