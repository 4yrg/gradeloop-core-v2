"""
Extract a balanced (fair) evaluation dataset from BigCloneBench.

Creates a dataset with equal distribution of:
- Type-1 clone pairs (exact matches)
- Type-2 clone pairs (renamed identifiers)
- Type-3 clone pairs (modified statements)
- Type-4 clone pairs (semantic clones)
- Non-clone pairs

Perfect for fair multi-class evaluation with unbiased metrics.

Default: 20,000 per class × 5 classes = 100,000 pairs total

Memory-efficient: Uses reservoir sampling to avoid loading entire dataset into memory.
"""

import json
import random
from pathlib import Path

from tqdm import tqdm


def reservoir_sample(stream, k, rng, total_hint=None):
    """
    Reservoir sampling algorithm to select k random samples from a stream.

    Args:
        stream: Iterator of items to sample from
        k: Number of samples to select
        rng: Random number generator instance
        total_hint: Optional hint for total size (for progress bar)

    Returns:
        List of k sampled items
    """
    reservoir = []
    for i, item in enumerate(stream):
        if i < k:
            reservoir.append(item)
        else:
            j = rng.randint(0, i)
            if j < k:
                reservoir[j] = item
    return reservoir


def extract_balanced_dataset(
    input_path: str,
    output_path: str,
    samples_per_class: int = 20000,
    seed: int = 42,
):
    """
    Extract a balanced (fair) dataset from BigCloneBench for evaluation.

    Uses reservoir sampling to process the dataset in a streaming fashion,
    avoiding loading the entire dataset into memory.

    Args:
        input_path: Path to BigCloneBench JSONL file
        output_path: Path to save balanced dataset (JSON)
        samples_per_class: Number of samples per class (Type-1/2/3/4 + Non-clones)
        seed: Random seed for reproducibility
    """
    rng = random.Random(seed)

    # Buckets for reservoir sampling (store only the samples, not all data)
    buckets = {
        1: [],  # Type-1 (exact matches)
        2: [],  # Type-2 (renamed identifiers)
        3: [],  # Type-3 (modified statements)
        4: [],  # Type-4 (semantic clones)
        0: [],  # Non-clones
    }

    # Counters for each class
    counters = {1: 0, 2: 0, 3: 0, 4: 0, 0: 0}

    print(f"Reading BigCloneBench dataset from {input_path}...")
    print(f"Using reservoir sampling (memory-efficient streaming)...")

    # First pass: count total lines for progress bar
    total_lines = sum(1 for _ in open(input_path, "r", encoding="utf-8"))
    print(f"Total entries in BigCloneBench: {total_lines:,}")

    # Single pass: stream through file and apply reservoir sampling
    with open(input_path, "r", encoding="utf-8") as f:
        for line in tqdm(f, total=total_lines, desc="Processing entries"):
            try:
                data = json.loads(line)
                label = data.get("label", 1)

                # Ensure code fields exist
                code1 = data.get("code1", "")
                code2 = data.get("code2", "")

                if not (code1 and code2):
                    continue

                if label == 0:
                    # Non-clone
                    class_key = 0
                else:
                    # Clone: categorize by clone_type
                    clone_type = data.get("clone_type", 0)
                    if clone_type not in [1, 2, 3, 4]:
                        continue
                    class_key = clone_type

                # Reservoir sampling for this class
                counters[class_key] += 1
                bucket = buckets[class_key]
                current_size = len(bucket)

                if current_size < samples_per_class:
                    # Fill reservoir until it reaches target size
                    bucket.append(data)
                else:
                    # Replace with decreasing probability
                    j = rng.randint(0, counters[class_key] - 1)
                    if j < samples_per_class:
                        bucket[j] = data

            except json.JSONDecodeError:
                continue

    print("\n" + "=" * 60)
    print("Original Dataset Distribution:")
    print("=" * 60)
    for class_key in [1, 2, 3, 4, 0]:
        label = "Non-clone" if class_key == 0 else f"Type-{class_key}"
        count = counters[class_key]
        print(f"  {label:12s}: {count:>12,} pairs")

    print("\n" + "=" * 60)
    print(f"Sampling {samples_per_class:,} pairs per class...")
    print("=" * 60)

    # Collect sampled data
    sampled_data = []
    for class_key in [1, 2, 3, 4, 0]:
        available = len(buckets[class_key])
        label_name = "Non-clone" if class_key == 0 else f"Type-{class_key}"

        if available < samples_per_class:
            print(
                f"  ⚠️  Warning: {label_name} has only {available:,} pairs (need {samples_per_class:,})"
            )
            sampled = buckets[class_key]  # Take all available
        else:
            sampled = buckets[class_key]
            print(f"  ✓ {label_name}: {len(sampled):>10,} pairs sampled (reservoir)")

        print(f"  ✓ {label_name}: {len(sampled):>10,} pairs sampled")
        sampled_data.extend(sampled)

    # Shuffle the combined dataset
    print(f"\nShuffling {len(sampled_data):,} total pairs...")
    rng.shuffle(sampled_data)

    # Save to JSON (write in chunks to avoid memory spike)
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Saving to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sampled_data, f, indent=2)

    # Create summary statistics
    final_counts = {1: 0, 2: 0, 3: 0, 4: 0, 0: 0}
    for item in sampled_data:
        label = item.get("label", 1)
        if label == 0:
            final_counts[0] += 1
        else:
            clone_type = item.get("clone_type", 0)
            if clone_type in [1, 2, 3, 4]:
                final_counts[clone_type] += 1

    print("\n" + "=" * 60)
    print("Final Balanced Dataset Distribution:")
    print("=" * 60)
    for class_key in [1, 2, 3, 4, 0]:
        label = "Non-clone" if class_key == 0 else f"Type-{class_key}"
        count = final_counts[class_key]
        percentage = (count / len(sampled_data)) * 100
        print(f"  {label:12s}: {count:>10,} pairs ({percentage:5.1f}%)")
    print("=" * 60)
    print(f"  {'Total':12s}: {len(sampled_data):>10,} pairs (100.0%)")
    print("=" * 60)

    # Save summary
    summary_path = output_file.parent / f"{output_file.stem}_summary.txt"
    with open(summary_path, "w") as f:
        f.write("BigCloneBench Balanced Evaluation Dataset Summary\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Source: {input_path}\n")
        f.write(f"Output: {output_path}\n")
        f.write(f"Random seed: {seed}\n")
        f.write(f"Target samples per class: {samples_per_class:,}\n\n")
        f.write("Final Distribution:\n")
        f.write("-" * 60 + "\n")
        for class_key in [1, 2, 3, 4, 0]:
            label = "Non-clone" if class_key == 0 else f"Type-{class_key}"
            count = final_counts[class_key]
            percentage = (count / len(sampled_data)) * 100
            f.write(f"  {label:12s}: {count:>10,} pairs ({percentage:5.1f}%)\n")
        f.write("-" * 60 + "\n")
        f.write(f"  {'Total':12s}: {len(sampled_data):>10,} pairs (100.0%)\n")
        f.write("=" * 60 + "\n\n")
        f.write("This balanced dataset ensures fair evaluation with:\n")
        f.write("- Equal representation of all clone types (1-4) and non-clones\n")
        f.write("- Unbiased precision, recall, and F1 metrics per class\n")
        f.write("- Reliable multi-class classification evaluation\n")
        f.write(
            "\nMemory-efficient: Used reservoir sampling for streaming processing.\n"
        )

    print(f"\nSummary saved to {summary_path}")
    print("Done!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract balanced (fair) dataset from BigCloneBench for evaluation"
    )
    parser.add_argument(
        "--input",
        type=str,
        default="bigclonebench.jsonl",
        help="Path to BigCloneBench JSONL file",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="bigclonebench_balanced.json",
        help="Path to save balanced dataset",
    )
    parser.add_argument(
        "--samples-per-class",
        type=int,
        default=20000,
        help="Number of samples per class (Type-1/2/3/4 + Non-clones)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility",
    )

    args = parser.parse_args()

    extract_balanced_dataset(
        input_path=args.input,
        output_path=args.output,
        samples_per_class=args.samples_per_class,
        seed=args.seed,
    )
