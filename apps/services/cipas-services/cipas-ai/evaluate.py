#!/usr/bin/env python3
"""
evaluate.py — Evaluate the CIPAS-AI detection pipeline.

Default (no flags): runs the full 2-stage pipeline against aicd-bench.

  python evaluate.py                               # full pipeline, aicd-bench
  python evaluate.py --stage catboost              # Stage 1 only
  python evaluate.py --stage droiddetect           # Stage 2 only
  python evaluate.py --dataset DroidCollection     # different dataset
  python evaluate.py --max-samples 500 --verbose   # quick sanity run
  python evaluate.py --output results/my_run.json  # custom output path
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
import logging

sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import EvaluationOrchestrator


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate CIPAS-AI models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
examples:
  python evaluate.py                             evaluate full pipeline on aicd-bench
  python evaluate.py --stage catboost            evaluate Stage 1 only
  python evaluate.py --stage droiddetect         evaluate Stage 2 only
  python evaluate.py --dataset DroidCollection   evaluate on a different dataset
  python evaluate.py --max-samples 500           limit samples (quick test)
  python evaluate.py --model-dir models/run42    use a specific models directory
""",
    )
    parser.add_argument("--config", default="config.yaml",
                        help="Config file path (default: config.yaml)")
    parser.add_argument("--stage", choices=["pipeline", "catboost", "droiddetect"],
                        default="pipeline",
                        help="Which stage to evaluate (default: pipeline = both stages)")
    parser.add_argument("--dataset", default=None,
                        help="Dataset to evaluate on (default: datasets.evaluation_dataset from config)")
    parser.add_argument("--model-dir", default=None, dest="model_dir",
                        help="Directory containing trained models (default: output.models_dir from config)")
    parser.add_argument("--max-samples", type=int, default=None,
                        help="Cap the number of evaluation samples")
    parser.add_argument("--batch-size", type=int, default=8,
                        help="Batch size (default: 8)")
    parser.add_argument("--output", default=None,
                        help="Write full JSON results to this file")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable verbose logging")
    return parser.parse_args()


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
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    )

    settings = Settings.from_yaml(args.config)
    orchestrator = EvaluationOrchestrator(settings)

    dataset = args.dataset or settings.datasets.evaluation_dataset

    print(f"\n{'─'*56}")
    print(f"  EVALUATE: {args.stage.upper()}  |  dataset: {dataset}")
    print(f"{'─'*56}")

    try:
        results = await orchestrator.run_evaluation(
            dataset=dataset,
            model_dir=args.model_dir,
            max_samples=args.max_samples,
            batch_size=args.batch_size,
            save_results=True,
            stage=args.stage,
            progress_callback=_bar,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"\n  ✗ Evaluation failed: {exc}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

    _print_metrics(results["metrics"], results["total_samples"])

    if args.verbose and results["metrics"].get("classification_report"):
        _print_classification_report(results["metrics"]["classification_report"])

    if results.get("output_file"):
        print(f"\n  results saved → {results['output_file']}")

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"  full JSON   → {out_path}")

    print(f"\n✓ Evaluation complete")


if __name__ == "__main__":
    asyncio.run(main())
