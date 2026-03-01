#!/usr/bin/env python3
"""
prepare_droid_dataset.py
────────────────────────
Prepares and validates the DroidCollection dataset for training.

Features:
- Validates JSONL format
- Computes class distribution statistics
- Optionally splits into train/eval sets
- Creates a dataset info report

Usage:
    # Validate existing dataset
    poetry run python prepare_droid_dataset.py \\
        --data_path ../../datasets/droid-collection/Droid_Train.jsonl

    # Create train/eval split from combined dataset
    poetry run python prepare_droid_dataset.py \\
        --data_path ../../datasets/droid-collection/Droid_Combined.jsonl \\
        --output_dir ../../datasets/droid-collection \\
        --eval_ratio 0.1 \\
        --seed 42
"""

import argparse
import json
import logging
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Label mappings
LABEL_STR_TO_INT = {
    "HUMAN_GENERATED": 0,
    "MACHINE_GENERATED": 1,
    "MACHINE_REFINED": 2,
    "MACHINE_GENERATED_ADVERSARIAL": 3,
}

INT_TO_LABEL_NAME = {
    0: "Human-written",
    1: "AI-generated",
    2: "AI-refined",
    3: "AI-generated-adversarial",
}


def iter_jsonl(path: Path, max_lines: int | None = None) -> Iterator[dict]:
    """Iterate over JSONL file."""
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if max_lines and i >= max_lines:
                break
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"Line {i + 1}: Invalid JSON - {e}")


def validate_record(record: dict, line_num: int) -> tuple[bool, str | None]:
    """Validate a single dataset record."""
    # Check required fields
    if "Code" not in record:
        return False, f"Line {line_num}: Missing 'Code' field"

    if "Label" not in record:
        return False, f"Line {line_num}: Missing 'Label' field"

    code = record["Code"]
    if not isinstance(code, str) or not code.strip():
        return False, f"Line {line_num}: Empty or invalid code"

    label = record["Label"]
    if isinstance(label, str):
        if label.strip().upper() not in LABEL_STR_TO_INT:
            return False, f"Line {line_num}: Unknown label '{label}'"
    elif isinstance(label, int):
        if label not in INT_TO_LABEL_NAME:
            return False, f"Line {line_num}: Invalid label int {label}"
    else:
        return False, f"Line {line_num}: Label must be string or int"

    return True, None


def analyze_dataset(path: Path, max_samples: int | None = None) -> dict:
    """Analyze dataset and return statistics."""
    logger.info(f"Analyzing dataset: {path}")

    total = 0
    valid = 0
    invalid = 0
    label_counts: Counter = Counter()
    language_counts: Counter = Counter()
    code_lengths: list[int] = []

    for i, record in enumerate(iter_jsonl(path, max_samples)):
        total += 1

        is_valid, error = validate_record(record, i)
        if not is_valid:
            logger.debug(error)
            invalid += 1
            continue

        valid += 1

        # Count labels
        label = record["Label"]
        if isinstance(label, str):
            label_int = LABEL_STR_TO_INT.get(label.strip().upper(), -1)
        else:
            label_int = int(label)
        label_counts[label_int] += 1

        # Count languages
        language = record.get("Language", "unknown")
        language_counts[language] += 1

        # Code length stats
        code_len = len(record.get("Code", ""))
        code_lengths.append(code_len)

    # Compute statistics
    stats = {
        "total_records": total,
        "valid_records": valid,
        "invalid_records": invalid,
        "validity_rate": valid / total if total > 0 else 0,
        "label_distribution": {
            INT_TO_LABEL_NAME.get(k, f"unknown_{k}"): v
            for k, v in sorted(label_counts.items())
        },
        "language_distribution": dict(language_counts.most_common(10)),
        "code_length_stats": {
            "min": min(code_lengths) if code_lengths else 0,
            "max": max(code_lengths) if code_lengths else 0,
            "mean": sum(code_lengths) / len(code_lengths) if code_lengths else 0,
            "median": sorted(code_lengths)[len(code_lengths) // 2]
            if code_lengths
            else 0,
        },
    }

    return stats


def print_stats(stats: dict) -> None:
    """Print dataset statistics."""
    print("\n" + "=" * 70)
    print("  DroidCollection Dataset Statistics")
    print("=" * 70)

    print(f"\n  Total records:   {stats['total_records']:,}")
    print(
        f"  Valid records:   {stats['valid_records']:,} ({stats['validity_rate'] * 100:.1f}%)"
    )
    print(f"  Invalid records: {stats['invalid_records']:,}")

    print("\n  Label Distribution:")
    print("  " + "-" * 50)
    for label, count in stats["label_distribution"].items():
        pct = count / stats["valid_records"] * 100 if stats["valid_records"] > 0 else 0
        print(f"    {label:<35} {count:>8,} ({pct:>5.1f}%)")

    print("\n  Top Languages:")
    print("  " + "-" * 50)
    for lang, count in list(stats["language_distribution"].items())[:5]:
        pct = count / stats["valid_records"] * 100 if stats["valid_records"] > 0 else 0
        print(f"    {lang:<35} {count:>8,} ({pct:>5.1f}%)")

    code_stats = stats["code_length_stats"]
    print("\n  Code Length (characters):")
    print("  " + "-" * 50)
    print(f"    Min:    {code_stats['min']:>10,}")
    print(f"    Max:    {code_stats['max']:>10,}")
    print(f"    Mean:   {code_stats['mean']:>10.0f}")
    print(f"    Median: {code_stats['median']:>10,}")

    print("\n" + "=" * 70 + "\n")


def create_train_eval_split(
    input_path: Path,
    output_dir: Path,
    eval_ratio: float = 0.1,
    seed: int = 42,
) -> None:
    """
    Split a combined dataset into train and eval sets.

    Uses stratified sampling to maintain label distribution.
    """
    logger.info(f"Loading dataset: {input_path}")

    # Load all valid records
    records: list[dict] = []
    for i, record in enumerate(iter_jsonl(input_path)):
        is_valid, error = validate_record(record, i)
        if is_valid:
            records.append(record)
        else:
            logger.debug(error)

    logger.info(f"Loaded {len(records):,} valid records")

    # Group by label for stratified split
    by_label: dict[int, list[dict]] = {}
    for record in records:
        label = record["Label"]
        if isinstance(label, str):
            label_int = LABEL_STR_TO_INT.get(label.strip().upper(), 0)
        else:
            label_int = int(label)

        if label_int not in by_label:
            by_label[label_int] = []
        by_label[label_int].append(record)

    # Stratified split
    train_records = []
    eval_records = []

    random.seed(seed)

    for label_int, label_records in by_label.items():
        random.shuffle(label_records)

        n_eval = max(1, int(len(label_records) * eval_ratio))
        eval_records.extend(label_records[:n_eval])
        train_records.extend(label_records[n_eval:])

    # Shuffle final sets
    random.shuffle(train_records)
    random.shuffle(eval_records)

    # Write output files
    output_dir.mkdir(parents=True, exist_ok=True)

    train_path = output_dir / "Droid_Train.jsonl"
    eval_path = output_dir / "Droid_Test.jsonl"

    logger.info(f"Writing training set: {train_path} ({len(train_records):,} records)")
    with train_path.open("w", encoding="utf-8") as f:
        for record in train_records:
            f.write(json.dumps(record) + "\n")

    logger.info(f"Writing evaluation set: {eval_path} ({len(eval_records):,} records)")
    with eval_path.open("w", encoding="utf-8") as f:
        for record in eval_records:
            f.write(json.dumps(record) + "\n")

    logger.info("Split complete!")

    # Print statistics
    train_stats = {
        "total_records": len(train_records),
        "label_distribution": {},
    }
    eval_stats = {
        "total_records": len(eval_records),
        "label_distribution": {},
    }

    for label_int in sorted(by_label.keys()):
        label_name = INT_TO_LABEL_NAME.get(label_int, f"unknown_{label_int}")
        train_count = sum(
            1
            for r in train_records
            if (
                LABEL_STR_TO_INT.get(str(r["Label"]).upper(), -1) == label_int
                or (isinstance(r["Label"], int) and r["Label"] == label_int)
            )
        )
        eval_count = sum(
            1
            for r in eval_records
            if (
                LABEL_STR_TO_INT.get(str(r["Label"]).upper(), -1) == label_int
                or (isinstance(r["Label"], int) and r["Label"] == label_int)
            )
        )
        train_stats["label_distribution"][label_name] = train_count
        eval_stats["label_distribution"][label_name] = eval_count

    print("\n" + "=" * 70)
    print("  Train/Eval Split Summary")
    print("=" * 70)
    print(f"\n  Training set:   {len(train_records):,} records")
    for label, count in train_stats["label_distribution"].items():
        pct = count / len(train_records) * 100 if train_records else 0
        print(f"    {label:<35} {count:>8,} ({pct:>5.1f}%)")

    print(f"\n  Evaluation set: {len(eval_records):,} records")
    for label, count in eval_stats["label_distribution"].items():
        pct = count / len(eval_records) * 100 if eval_records else 0
        print(f"    {label:<35} {count:>8,} ({pct:>5.1f}%)")

    print("\n" + "=" * 70 + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare and validate DroidCollection dataset",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--data_path",
        type=Path,
        required=True,
        help="Path to input JSONL file",
    )
    parser.add_argument(
        "--output_dir",
        type=Path,
        default=None,
        help="Output directory for train/eval split (optional)",
    )
    parser.add_argument(
        "--eval_ratio",
        type=float,
        default=0.1,
        help="Ratio of data to use for evaluation",
    )
    parser.add_argument(
        "--max_samples",
        type=int,
        default=None,
        help="Maximum samples to analyze (for quick tests)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for splitting",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.data_path.exists():
        logger.error(f"Dataset not found: {args.data_path}")
        sys.exit(1)

    # Analyze dataset
    stats = analyze_dataset(args.data_path, args.max_samples)
    print_stats(stats)

    # Create split if output directory specified
    if args.output_dir:
        create_train_eval_split(
            args.data_path,
            args.output_dir,
            eval_ratio=args.eval_ratio,
            seed=args.seed,
        )
    else:
        logger.info("No output directory specified, skipping split")


if __name__ == "__main__":
    main()
