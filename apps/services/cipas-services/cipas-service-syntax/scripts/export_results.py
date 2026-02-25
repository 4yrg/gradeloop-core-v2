#!/usr/bin/env python3
"""
Evaluation Results Export Script

Exports evaluation results from multiple runs into consolidated reports.
Supports exporting to JSON, CSV, HTML, and Markdown formats.

Usage:
    python scripts/export_results.py \\
        --input reports/evaluations/ \\
        --output reports/results/ \\
        --format all

Example:
    python scripts/export_results.py \\
        -i reports/evaluations/ \\
        -o reports/results/ \\
        -f all \\
        --experiment-name "ToMa-Training-Run-1"
"""

import argparse
import json
import logging
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

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
            Path(__file__).parent.parent / "reports" / "export_results.log"
        ),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class ConsolidatedMetrics:
    """Consolidated metrics from multiple evaluations."""

    experiment_name: str
    timestamp: str
    total_evaluations: int

    # Training info
    training_samples: int
    validation_samples: int
    test_samples: int

    # Overall metrics (mean ± std)
    overall_precision: float
    overall_recall: float
    overall_f1_score: float
    overall_accuracy: float

    # By clone type
    type1_f1: Optional[float]
    type2_f1: Optional[float]
    type3_f1: Optional[float]
    type4_f1: Optional[float]

    # Datasets evaluated
    datasets: List[str]

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)


def load_evaluation_results(input_dir: str) -> List[Dict[str, Any]]:
    """
    Load all evaluation results from input directory.

    Args:
        input_dir: Directory containing evaluation JSON files

    Returns:
        List of evaluation result dictionaries
    """
    input_path = Path(input_dir)
    results = []

    logger.info(f"Loading evaluation results from {input_path}")

    # Find all JSON files
    json_files = list(input_path.glob("*.json"))

    if not json_files:
        logger.warning(f"No JSON files found in {input_path}")
        return results

    for json_file in json_files:
        # Skip training metrics files
        if "training_metrics" in json_file.name or "training_report" in json_file.name:
            continue

        try:
            with open(json_file, "r") as f:
                data = json.load(f)
                data["_source_file"] = str(json_file)
                results.append(data)
                logger.info(f"  Loaded: {json_file.name}")
        except Exception as e:
            logger.warning(f"  Error loading {json_file.name}: {e}")

    logger.info(f"Loaded {len(results)} evaluation results")
    return results


def consolidate_metrics(
    evaluations: List[Dict], experiment_name: str
) -> ConsolidatedMetrics:
    """
    Consolidate metrics from multiple evaluations.

    Args:
        evaluations: List of evaluation result dictionaries
        experiment_name: Name for the experiment

    Returns:
        ConsolidatedMetrics object
    """
    if not evaluations:
        raise ValueError("No evaluations to consolidate")

    # Extract metrics
    precisions = []
    recalls = []
    f1_scores = []
    accuracies = []

    type1_f1s = []
    type2_f1s = []
    type3_f1s = []
    type4_f1s = []

    train_samples = []
    val_samples = []
    test_samples = []

    datasets = set()

    for eval_data in evaluations:
        # Overall metrics
        overall = eval_data.get("overall_metrics", {})
        if overall:
            precisions.append(overall.get("precision", 0))
            recalls.append(overall.get("recall", 0))
            f1_scores.append(overall.get("f1_score", 0))
            accuracies.append(overall.get("accuracy", 0))

        # By clone type
        by_type = eval_data.get("by_clone_type", {})

        # Type-1
        if "Type-1 (Exact Clones)" in by_type and isinstance(
            by_type["Type-1 (Exact Clones)"], dict
        ):
            type1_f1s.append(by_type["Type-1 (Exact Clones)"].get("f1_score", 0))

        # Type-2
        if "Type-2 (Renamed Clones)" in by_type and isinstance(
            by_type["Type-2 (Renamed Clones)"], dict
        ):
            type2_f1s.append(by_type["Type-2 (Renamed Clones)"].get("f1_score", 0))

        # Type-3
        if "Type-3 (Modified Clones)" in by_type and isinstance(
            by_type["Type-3 (Modified Clones)"], dict
        ):
            type3_f1s.append(by_type["Type-3 (Modified Clones)"].get("f1_score", 0))

        # Type-4
        if "Type-4 (Semantic Clones)" in by_type and isinstance(
            by_type["Type-4 (Semantic Clones)"], dict
        ):
            type4_f1s.append(by_type["Type-4 (Semantic Clones)"].get("f1_score", 0))

        # Dataset info
        summary = eval_data.get("evaluation_summary", {})
        datasets.add(summary.get("dataset", "Unknown"))

        # Training info (if available)
        if "split_info" in eval_data:
            split = eval_data["split_info"]
            train_samples.append(split.get("train_samples", 0))
            val_samples.append(split.get("val_samples", 0))
            test_samples.append(split.get("test_samples", 0))

    # Calculate statistics
    def safe_mean_std(values):
        if not values:
            return 0.0, 0.0
        return float(np.mean(values)), float(np.std(values))

    prec_mean, prec_std = safe_mean_std(precisions)
    rec_mean, rec_std = safe_mean_std(recalls)
    f1_mean, f1_std = safe_mean_std(f1_scores)
    acc_mean, acc_std = safe_mean_std(accuracies)

    # Get latest training info
    latest_train = train_samples[-1] if train_samples else 0
    latest_val = val_samples[-1] if val_samples else 0
    latest_test = test_samples[-1] if test_samples else 0

    metrics = ConsolidatedMetrics(
        experiment_name=experiment_name,
        timestamp=datetime.now().isoformat(),
        total_evaluations=len(evaluations),
        training_samples=latest_train,
        validation_samples=latest_val,
        test_samples=latest_test,
        overall_precision=prec_mean,
        overall_recall=rec_mean,
        overall_f1_score=f1_mean,
        overall_accuracy=acc_mean,
        type1_f1=float(np.mean(type1_f1s)) if type1_f1s else None,
        type2_f1=float(np.mean(type2_f1s)) if type2_f1s else None,
        type3_f1=float(np.mean(type3_f1s)) if type3_f1s else None,
        type4_f1=float(np.mean(type4_f1s)) if type4_f1s else None,
        datasets=list(datasets),
    )

    return metrics


def export_to_json(metrics: ConsolidatedMetrics, output_path: str):
    """Export metrics to JSON format."""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(metrics.to_dict(), f, indent=2)

    logger.info(f"JSON export saved to: {output_file}")


def export_to_csv(metrics: ConsolidatedMetrics, output_path: str):
    """Export metrics to CSV format."""
    import csv

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", newline="") as f:
        writer = csv.writer(f)

        # Header
        writer.writerow(["Metric", "Value"])

        # Experiment info
        writer.writerow(["Experiment Name", metrics.experiment_name])
        writer.writerow(["Timestamp", metrics.timestamp])
        writer.writerow(["Total Evaluations", metrics.total_evaluations])
        writer.writerow(["", ""])

        # Training info
        writer.writerow(["Training Samples", metrics.training_samples])
        writer.writerow(["Validation Samples", metrics.validation_samples])
        writer.writerow(["Test Samples", metrics.test_samples])
        writer.writerow(["", ""])

        # Overall metrics
        writer.writerow(["Overall Precision", f"{metrics.overall_precision:.4f}"])
        writer.writerow(["Overall Recall", f"{metrics.overall_recall:.4f}"])
        writer.writerow(["Overall F1-Score", f"{metrics.overall_f1_score:.4f}"])
        writer.writerow(["Overall Accuracy", f"{metrics.overall_accuracy:.4f}"])
        writer.writerow(["", ""])

        # By clone type
        if metrics.type1_f1 is not None:
            writer.writerow(["Type-1 F1-Score", f"{metrics.type1_f1:.4f}"])
        if metrics.type2_f1 is not None:
            writer.writerow(["Type-2 F1-Score", f"{metrics.type2_f1:.4f}"])
        if metrics.type3_f1 is not None:
            writer.writerow(["Type-3 F1-Score", f"{metrics.type3_f1:.4f}"])
        if metrics.type4_f1 is not None:
            writer.writerow(["Type-4 F1-Score", f"{metrics.type4_f1:.4f}"])
        writer.writerow(["", ""])

        # Datasets
        writer.writerow(["Datasets", ", ".join(metrics.datasets)])

    logger.info(f"CSV export saved to: {output_file}")


def export_to_html(metrics: ConsolidatedMetrics, output_path: str):
    """Export metrics to HTML format."""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clone Detection Evaluation Results - {metrics.experiment_name}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #3498db;
            color: white;
        }}
        tr:hover {{
            background: #f5f5f5;
        }}
        .metric-card {{
            display: inline-block;
            background: #ecf0f1;
            border-radius: 8px;
            padding: 20px;
            margin: 10px;
            text-align: center;
            min-width: 150px;
        }}
        .metric-value {{
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }}
        .metric-label {{
            color: #7f8c8d;
            font-size: 0.9em;
        }}
        .highlight {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
        }}
        .timestamp {{
            color: #95a5a6;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Clone Detection Evaluation Results</h1>
        <p class="timestamp">Generated: {metrics.timestamp}</p>
        <p><strong>Experiment:</strong> {metrics.experiment_name}</p>

        <h2>📊 Overall Performance</h2>
        <div>
            <div class="metric-card">
                <div class="metric-value">{metrics.overall_precision:.4f}</div>
                <div class="metric-label">Precision</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{metrics.overall_recall:.4f}</div>
                <div class="metric-label">Recall</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{metrics.overall_f1_score:.4f}</div>
                <div class="metric-label">F1-Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{metrics.overall_accuracy:.4f}</div>
                <div class="metric-label">Accuracy</div>
            </div>
        </div>

        <h2>📈 Training Configuration</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Training Samples</td><td>{metrics.training_samples:,}</td></tr>
            <tr><td>Validation Samples</td><td>{metrics.validation_samples:,}</td></tr>
            <tr><td>Test Samples</td><td>{metrics.test_samples:,}</td></tr>
            <tr><td>Total Evaluations</td><td>{metrics.total_evaluations}</td></tr>
        </table>

        <h2>🔬 Performance by Clone Type</h2>
        <table>
            <tr><th>Clone Type</th><th>F1-Score</th></tr>
            <tr><td>Type-1 (Exact)</td><td>{f"{metrics.type1_f1:.4f}" if metrics.type1_f1 is not None else "N/A"}</td></tr>
            <tr><td>Type-2 (Renamed)</td><td>{f"{metrics.type2_f1:.4f}" if metrics.type2_f1 is not None else "N/A"}</td></tr>
            <tr><td>Type-3 (Modified)</td><td>{f"{metrics.type3_f1:.4f}" if metrics.type3_f1 is not None else "N/A"}</td></tr>
            <tr><td>Type-4 (Semantic)</td><td>{f"{metrics.type4_f1:.4f}" if metrics.type4_f1 is not None else "N/A"}</td></tr>
        </table>

        <h2>💾 Datasets Evaluated</h2>
        <div class="highlight">
            {", ".join(metrics.datasets)}
        </div>
    </div>
</body>
</html>
"""

    with open(output_file, "w") as f:
        f.write(html_content)

    logger.info(f"HTML export saved to: {output_file}")


def export_to_markdown(metrics: ConsolidatedMetrics, output_path: str):
    """Export metrics to Markdown format."""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    md_content = f"""# Clone Detection Evaluation Results

**Experiment:** {metrics.experiment_name}
**Generated:** {metrics.timestamp}

## 📊 Overall Performance

| Metric | Value |
|--------|-------|
| Precision | {metrics.overall_precision:.4f} |
| Recall | {metrics.overall_recall:.4f} |
| F1-Score | {metrics.overall_f1_score:.4f} |
| Accuracy | {metrics.overall_accuracy:.4f} |

## 📈 Training Configuration

| Configuration | Value |
|--------------|-------|
| Training Samples | {metrics.training_samples:,} |
| Validation Samples | {metrics.validation_samples:,} |
| Test Samples | {metrics.test_samples:,} |
| Total Evaluations | {metrics.total_evaluations} |

## 🔬 Performance by Clone Type

| Clone Type | F1-Score |
|------------|----------|
| Type-1 (Exact) | {f"{metrics.type1_f1:.4f}" if metrics.type1_f1 is not None else "N/A"} |
| Type-2 (Renamed) | {f"{metrics.type2_f1:.4f}" if metrics.type2_f1 is not None else "N/A"} |
| Type-3 (Modified) | {f"{metrics.type3_f1:.4f}" if metrics.type3_f1 is not None else "N/A"} |
| Type-4 (Semantic) | {f"{metrics.type4_f1:.4f}" if metrics.type4_f1 is not None else "N/A"} |

## 💾 Datasets Evaluated

{", ".join(metrics.datasets)}

---

*Report generated automatically by the Clone Detection Evaluation Export Script*
"""

    with open(output_file, "w") as f:
        f.write(md_content)

    logger.info(f"Markdown export saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Export evaluation results to various formats"
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        default="reports/evaluations/",
        help="Input directory containing evaluation JSON files",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="reports/results/",
        help="Output directory for exported results",
    )
    parser.add_argument(
        "--format",
        "-f",
        type=str,
        default="all",
        choices=["json", "csv", "html", "md", "all"],
        help="Export format (default: all)",
    )
    parser.add_argument(
        "--experiment-name",
        type=str,
        default=None,
        help="Name for the experiment (default: auto-generated)",
    )

    args = parser.parse_args()

    # Generate experiment name if not provided
    experiment_name = (
        args.experiment_name or f"Evaluation-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )

    logger.info("=" * 70)
    logger.info("Evaluation Results Export")
    logger.info("=" * 70)
    logger.info(f"Input Directory:  {args.input}")
    logger.info(f"Output Directory: {args.output}")
    logger.info(f"Export Format:    {args.format}")
    logger.info(f"Experiment Name:  {experiment_name}")
    logger.info("=" * 70)

    # Load evaluation results
    evaluations = load_evaluation_results(args.input)

    if not evaluations:
        logger.error("No evaluation results found to export")
        sys.exit(1)

    # Consolidate metrics
    logger.info("\nConsolidating metrics...")
    metrics = consolidate_metrics(evaluations, experiment_name)

    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    # Export based on format
    logger.info("\nExporting results...")

    if args.format in ["json", "all"]:
        export_to_json(metrics, str(output_path / "consolidated_results.json"))

    if args.format in ["csv", "all"]:
        export_to_csv(metrics, str(output_path / "consolidated_results.csv"))

    if args.format in ["html", "all"]:
        export_to_html(metrics, str(output_path / "consolidated_results.html"))

    if args.format in ["md", "all"]:
        export_to_markdown(metrics, str(output_path / "consolidated_results.md"))

    # Print summary
    print("\n" + "=" * 70)
    print("Consolidated Evaluation Results")
    print("=" * 70)
    print(f"\nExperiment: {metrics.experiment_name}")
    print(f"Evaluations: {metrics.total_evaluations}")
    print(f"\nOverall F1-Score: {metrics.overall_f1_score:.4f}")
    print(f"Overall Accuracy: {metrics.overall_accuracy:.4f}")
    print(f"\nDatasets: {', '.join(metrics.datasets)}")
    print("\n" + "=" * 70)

    logger.info("\n✅ Export complete!")


if __name__ == "__main__":
    main()
