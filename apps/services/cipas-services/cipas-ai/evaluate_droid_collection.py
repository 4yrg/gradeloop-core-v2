"""
evaluate_droid_collection.py
────────────────────────────
Evaluates the DroidDetect-Large model on the DROID benchmark test split
(datasets/droid-collection/Droid_Test.jsonl).

Dataset schema (DroidCollection, one JSON object per line):
    Code            : str  – the code snippet to classify
    Label           : str  – ground-truth class (string, see LABEL_STR_TO_INT)
    Generator       : str  – generating model name (ignored during eval)
    Generation_Mode : str  – e.g. "inverse_instruction" (ignored)
    Source          : str  – data source (ignored)
    Language        : str  – programming language (ignored)
    ...             (additional metadata fields)

Label string → int mapping:
    "HUMAN_GENERATED"              → 0  (Human-written)
    "MACHINE_GENERATED"            → 1  (AI-generated)
    "MACHINE_REFINED"              → 2  (AI-refined)
    "MACHINE_GENERATED_ADVERSARIAL"→ 3  (AI-generated-adversarial)

Usage
─────
    # From the cipas-ai directory (poetry environment must be active)
    poetry run python evaluate_droid_collection.py

    # With all options
    poetry run python evaluate_droid_collection.py \\
        --dataset   ../../../../datasets/droid-collection/Droid_Test.jsonl \\
        --max-samples 5000 \\
        --batch-size  32   \\
        --output      results/eval_droid_test.json

    # Quick sanity check (100 samples)
    poetry run python evaluate_droid_collection.py --max-samples 100
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Iterator

import torch
import torch.nn.functional as F

# ── shared model infrastructure ──────────────────────────────────────────────
from model_loader import LABEL_MAPPING, ModelLoader, get_model_loader, load_model

# ── constants ─────────────────────────────────────────────────────────────────
# The DroidCollection dataset stores labels as strings (e.g. "HUMAN_GENERATED").
# Map those strings → the integer class indices expected by the model.
LABEL_STR_TO_INT: dict[str, int] = {
    "HUMAN_GENERATED":               0,
    "MACHINE_GENERATED":              1,
    "MACHINE_REFINED":                2,
    "MACHINE_GENERATED_ADVERSARIAL":  3,
}

# Human-readable names aligned with ModelLoader.LABELS (same ordinal order).
DATASET_LABEL_NAMES = {
    0: "Human-written",
    1: "AI-generated",
    2: "AI-refined",
    3: "AI-generated-adversarial",
}

DEFAULT_DATASET_PATH = Path(__file__).resolve().parents[4] / \
    "datasets" / "droid-collection" / "Droid_Test.jsonl"

# Field names as they appear in the DroidCollection JSONL export.
DEFAULT_CODE_FIELD  = "Code"   # capital C
DEFAULT_LABEL_FIELD = "Label"  # capital L, string value

DEFAULT_BATCH_SIZE = 16


# ── dataset helpers ───────────────────────────────────────────────────────────

def iter_dataset(path: Path, max_samples: int | None = None) -> Iterator[dict]:
    """Yield parsed records from a JSONL file, optionally capping the count."""
    seen = 0
    with path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            raw_line = raw_line.strip()
            if not raw_line:
                continue
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                print(f"[WARN] Skipping malformed line: {exc}", file=sys.stderr)
                continue

            yield record
            seen += 1
            if max_samples is not None and seen >= max_samples:
                break


def count_dataset_lines(path: Path, max_samples: int | None = None) -> int:
    """Count lines (≈ records) without fully loading the file."""
    count = 0
    with path.open("rb") as fh:
        for _ in fh:
            count += 1
            if max_samples is not None and count >= max_samples:
                break
    return count


# ── inference helpers ─────────────────────────────────────────────────────────

def run_batch(
    codes: list[str],
    loader: ModelLoader,
) -> list[int]:
    """
    Tokenise and run a batch of code snippets through the model.
    Returns the argmax predicted class index for each snippet.
    """
    tokens = loader.tokenizer(
        codes,
        return_tensors="pt",
        truncation=True,
        max_length=loader.max_tokens,
        padding=True,
    )
    input_ids = tokens["input_ids"].to(loader.device)
    attention_mask = tokens["attention_mask"].to(loader.device)

    with torch.no_grad():
        outputs = loader.model(input_ids=input_ids, attention_mask=attention_mask)
        logits = outputs["logits"]

    probs = F.softmax(logits, dim=-1)
    predicted_indices = torch.argmax(probs, dim=-1).tolist()
    return predicted_indices


# ── metrics ───────────────────────────────────────────────────────────────────

def compute_metrics(
    y_true: list[int],
    y_pred: list[int],
    label_names: dict[int, str],
) -> dict:
    """
    Compute accuracy, macro-averaged precision/recall/F1, per-class metrics,
    and a confusion matrix.
    """
    num_classes = len(label_names)
    class_ids = sorted(label_names.keys())

    # Confusion matrix: cm[true][pred]
    cm: dict[int, dict[int, int]] = {
        t: {p: 0 for p in class_ids} for t in class_ids
    }
    for t, p in zip(y_true, y_pred):
        cm[t][p] += 1

    total = len(y_true)
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / total if total else 0.0

    per_class: dict[int, dict] = {}
    for c in class_ids:
        tp = cm[c][c]
        fp = sum(cm[r][c] for r in class_ids if r != c)
        fn = sum(cm[c][p] for p in class_ids if p != c)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = (2 * precision * recall / (precision + recall)
                     if (precision + recall) > 0 else 0.0)
        support   = sum(cm[c].values())

        per_class[c] = {
            "label":     label_names[c],
            "precision": round(precision, 4),
            "recall":    round(recall, 4),
            "f1":        round(f1, 4),
            "support":   support,
        }

    # Macro averages
    macro_precision = sum(v["precision"] for v in per_class.values()) / num_classes
    macro_recall    = sum(v["recall"]    for v in per_class.values()) / num_classes
    macro_f1        = sum(v["f1"]        for v in per_class.values()) / num_classes

    # Weighted averages (weighted by support)
    weighted_precision = sum(
        v["precision"] * v["support"] for v in per_class.values()
    ) / total if total else 0.0
    weighted_recall = sum(
        v["recall"] * v["support"] for v in per_class.values()
    ) / total if total else 0.0
    weighted_f1 = sum(
        v["f1"] * v["support"] for v in per_class.values()
    ) / total if total else 0.0

    # Confusion matrix as list-of-lists (rows = true, cols = predicted)
    cm_rows = [
        [cm[t][p] for p in class_ids] for t in class_ids
    ]

    return {
        "total_samples": total,
        "correct":       correct,
        "accuracy":      round(accuracy, 4),
        "macro": {
            "precision": round(macro_precision, 4),
            "recall":    round(macro_recall, 4),
            "f1":        round(macro_f1, 4),
        },
        "weighted": {
            "precision": round(weighted_precision, 4),
            "recall":    round(weighted_recall, 4),
            "f1":        round(weighted_f1, 4),
        },
        "per_class":        per_class,
        "confusion_matrix": cm_rows,
        "label_order":      [label_names[c] for c in class_ids],
    }


# ── pretty printing ───────────────────────────────────────────────────────────

def print_results(metrics: dict, elapsed: float) -> None:
    """Print a human-readable evaluation summary to stdout."""
    sep = "─" * 70

    print(f"\n{sep}")
    print("  DroidDetect-Large  ·  Evaluation on Droid_Test")
    print(sep)
    print(f"  Samples evaluated : {metrics['total_samples']:,}")
    print(f"  Correct           : {metrics['correct']:,}")
    print(f"  Accuracy          : {metrics['accuracy']:.4f}  "
          f"({metrics['accuracy']*100:.2f}%)")
    print(f"  Elapsed           : {elapsed:.1f}s")
    print()

    # Per-class table
    hdr = f"  {'Class':<35}  {'Prec':>7}  {'Recall':>7}  {'F1':>7}  {'Support':>9}"
    print(hdr)
    print("  " + "─" * (len(hdr) - 2))
    for cls_data in metrics["per_class"].values():
        row = (
            f"  {cls_data['label']:<35}"
            f"  {cls_data['precision']:>7.4f}"
            f"  {cls_data['recall']:>7.4f}"
            f"  {cls_data['f1']:>7.4f}"
            f"  {cls_data['support']:>9,}"
        )
        print(row)
    print("  " + "─" * (len(hdr) - 2))

    mac = metrics["macro"]
    wgt = metrics["weighted"]
    print(f"  {'Macro avg':<35}  {mac['precision']:>7.4f}"
          f"  {mac['recall']:>7.4f}  {mac['f1']:>7.4f}")
    print(f"  {'Weighted avg':<35}  {wgt['precision']:>7.4f}"
          f"  {wgt['recall']:>7.4f}  {wgt['f1']:>7.4f}")
    print()

    # Confusion matrix
    labels = metrics["label_order"]
    short  = [lbl.replace("AI-generated-adversarial", "AI-adv").replace("Human-written", "Human") for lbl in labels]
    col_w  = max(len(s) for s in short) + 2
    print("  Confusion matrix (rows = true class, cols = predicted class):")
    print("  " + " " * 20 + "".join(f"{s:>{col_w}}" for s in short))
    for i, (lbl, row) in enumerate(zip(labels, metrics["confusion_matrix"])):
        row_str = "".join(f"{v:>{col_w},}" for v in row)
        print(f"  {lbl:<20}{row_str}")
    print(f"\n{sep}\n")


# ── main ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate DroidDetect-Large on the DROID benchmark test split.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET_PATH,
        help="Path to the Droid_Test.jsonl file",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=None,
        dest="max_samples",
        help="Maximum number of samples to evaluate (default: all)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        dest="batch_size",
        help="Number of code snippets per inference batch",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to save JSON results (e.g. results/eval.json)",
    )
    parser.add_argument(
        "--code-field",
        default=DEFAULT_CODE_FIELD,
        dest="code_field",
        help="Field name in the JSONL records that holds the code snippet",
    )
    parser.add_argument(
        "--label-field",
        default=DEFAULT_LABEL_FIELD,
        dest="label_field",
        help="Field name in the JSONL records that holds the label "
             "(string like 'HUMAN_GENERATED' or int 0-3)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # ── validate dataset path ─────────────────────────────────────────────────
    if not args.dataset.exists():
        print(
            f"[ERROR] Dataset not found: {args.dataset}\n"
            "        Make sure datasets/droid-collection/Droid_Test.jsonl exists.",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── load model ────────────────────────────────────────────────────────────
    print("[INFO] Loading DroidDetect-Large model …")
    loader = load_model()
    print(f"[INFO] Model ready on device: {loader.device}")

    # ── run evaluation ────────────────────────────────────────────────────────
    print(f"[INFO] Evaluating on: {args.dataset}")
    if args.max_samples:
        print(f"[INFO] Capped at {args.max_samples:,} samples")

    y_true: list[int] = []
    y_pred: list[int] = []
    skipped = 0

    code_buf:  list[str] = []
    label_buf: list[int] = []

    start_time = time.perf_counter()
    batch_num  = 0

    def flush_batch() -> None:
        nonlocal batch_num
        if not code_buf:
            return
        preds = run_batch(code_buf, loader)
        y_true.extend(label_buf)
        y_pred.extend(preds)
        batch_num += 1
        processed = len(y_true)
        if batch_num % 10 == 0 or len(code_buf) < args.batch_size:
            elapsed = time.perf_counter() - start_time
            rate    = processed / elapsed if elapsed > 0 else 0
            print(
                f"  [{processed:>8,} samples | batch {batch_num:>5} | "
                f"{rate:>6.1f} samples/s]"
            )
        code_buf.clear()
        label_buf.clear()

    _warned_unknown_labels: set[str] = set()

    for record in iter_dataset(args.dataset, args.max_samples):
        code = record.get(args.code_field)
        raw_label = record.get(args.label_field)

        # Validate code field
        if code is None or not isinstance(code, str) or not code.strip():
            skipped += 1
            continue

        # Resolve label: accept string ("HUMAN_GENERATED") or int (0-3)
        if raw_label is None:
            skipped += 1
            continue
        if isinstance(raw_label, str):
            label_int = LABEL_STR_TO_INT.get(raw_label.strip().upper())
            if label_int is None:
                if raw_label not in _warned_unknown_labels:
                    print(f"[WARN] Unknown label string: {raw_label!r}", file=sys.stderr)
                    _warned_unknown_labels.add(raw_label)
                skipped += 1
                continue
        else:
            try:
                label_int = int(raw_label)
            except (TypeError, ValueError):
                skipped += 1
                continue
            if label_int not in DATASET_LABEL_NAMES:
                skipped += 1
                continue

        code_buf.append(code.strip())
        label_buf.append(label_int)

        if len(code_buf) >= args.batch_size:
            flush_batch()

    # flush remaining
    flush_batch()

    elapsed = time.perf_counter() - start_time

    if skipped:
        print(f"[WARN] Skipped {skipped:,} records (missing/invalid fields)")

    if not y_true:
        print("[ERROR] No valid samples found for evaluation.", file=sys.stderr)
        sys.exit(1)

    # ── compute & display metrics ─────────────────────────────────────────────
    metrics = compute_metrics(y_true, y_pred, DATASET_LABEL_NAMES)
    metrics["elapsed_seconds"] = round(elapsed, 2)
    metrics["dataset"]         = str(args.dataset)
    metrics["skipped"]         = skipped

    print_results(metrics, elapsed)

    # ── save results ──────────────────────────────────────────────────────────
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", encoding="utf-8") as fh:
            json.dump(metrics, fh, indent=2)
        print(f"[INFO] Results saved to: {args.output}")


if __name__ == "__main__":
    main()
