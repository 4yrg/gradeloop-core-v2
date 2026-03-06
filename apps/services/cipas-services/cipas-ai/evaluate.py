#!/usr/bin/env python3
"""
evaluate.py — Evaluate the CIPAS-AI detection pipeline.

All settings are read from config.yaml (cli.evaluate section).
Just run:  python evaluate.py

To change behaviour, edit config.yaml:

  cli:
    evaluate:
      stage: pipeline          # pipeline | catboost | droiddetect
      dataset: null            # null = datasets.evaluation_dataset
      model_dir: null          # null = output.models_dir
      max_samples: null        # null = no limit
      batch_size: 8
      output_file: null        # null = auto path inside output.results_dir
      verbose: false
"""

import asyncio
import json
import sys
from pathlib import Path
import logging

sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import EvaluationOrchestrator


def _bar(progress: float, message: str) -> None:
    print(f"  [{progress:5.1f}%] {message}", flush=True)


def _print_metrics(metrics: dict, total_samples: int) -> None:
    sep = "=" * 56
    print(f"\n{sep}")
    print(f"  samples   : {total_samples}")
    print(f"  accuracy  : {metrics.get('accuracy', 0):.4f}")
    print(f"  precision : {metrics.get('precision', 0):.4f}")
    print(f"  recall    : {metrics.get('recall', 0):.4f}")
    print(f"  F1        : {metrics.get('f1_score', 0):.4f}")
    print(sep)


def _print_classification_report(report: dict) -> None:
    print("\n  Per-class breakdown:")
    print(f"  {'class':<10} {'precision':>10} {'recall':>10} {'f1':>10} {'support':>10}")
    print("  " + "-" * 46)
    for label, vals in report.items():
        if isinstance(vals, dict) and "precision" in vals:
            print(
                f"  {str(label):<10} "
                f"{vals['precision']:>10.4f} "
                f"{vals['recall']:>10.4f} "
                f"{vals['f1-score']:>10.4f} "
                f"{int(vals['support']):>10}"
            )


async def main():
    settings = Settings()
    cfg = settings.cli.evaluate

    logging.basicConfig(
        level=logging.DEBUG if cfg.verbose else logging.WARNING,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    )

    orchestrator = EvaluationOrchestrator(settings)
    dataset = cfg.dataset or settings.datasets.evaluation_dataset

    print(f"\n{'─'*56}")
    print(f"  EVALUATE: {cfg.stage.upper()}  |  dataset: {dataset}")
    print(f"{'─'*56}")

    try:
        results = await orchestrator.run_evaluation(
            dataset=dataset,
            model_dir=cfg.model_dir,
            max_samples=cfg.max_samples,
            batch_size=cfg.batch_size,
            save_results=True,
            stage=cfg.stage,
            progress_callback=_bar,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"\n  ✗ Evaluation failed: {exc}")
        if cfg.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

    _print_metrics(results["metrics"], results["total_samples"])

    if cfg.verbose and results["metrics"].get("classification_report"):
        _print_classification_report(results["metrics"]["classification_report"])

    if results.get("output_file"):
        print(f"\n  results saved → {results['output_file']}")

    if cfg.output_file:
        out_path = Path(cfg.output_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"  full JSON   → {out_path}")

    print(f"\n✓ Evaluation complete")


if __name__ == "__main__":
    asyncio.run(main())
