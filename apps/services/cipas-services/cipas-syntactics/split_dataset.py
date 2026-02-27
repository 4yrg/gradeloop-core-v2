"""
Split balanced dataset into train/test sets.
"""

import json
import random
from pathlib import Path

datasets_dir = Path(__file__).parent.parent.parent.parent / "datasets" / "bigclonebench"
balanced_file = datasets_dir / "bigclonebench_balanced.json"

if not balanced_file.exists():
    print(f"Error: {balanced_file} not found. Run extract_balanced_dataset.py first.")
    exit(1)

print(f"Loading {balanced_file}...")
with open(balanced_file, "r") as f:
    data = json.load(f)

print(f"Shuffling {len(data):,} samples...")
random.seed(42)
random.shuffle(data)

split_idx = int(len(data) * 0.8)
train_data = data[:split_idx]
test_data = data[split_idx:]

train_file = datasets_dir / "bigclonebench_train.json"
test_file = datasets_dir / "bigclonebench_test.json"

print(f"Saving train set: {len(train_data):,} samples -> {train_file}")
with open(train_file, "w") as f:
    json.dump(train_data, f, indent=2)

print(f"Saving test set:  {len(test_data):,} samples -> {test_file}")
with open(test_file, "w") as f:
    json.dump(test_data, f, indent=2)

print("Done!")
