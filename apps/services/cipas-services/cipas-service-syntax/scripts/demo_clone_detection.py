#!/usr/bin/env python3
"""
Clone Detection Demo

Demonstrates how to use the trained Random Forest model
to detect code clones using ToMA features.

Usage:
    python scripts/demo_clone_detection.py
"""

import sys
from pathlib import Path

# Add src to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

import numpy as np


def demo_basic_usage():
    """Demonstrate basic clone detection usage."""
    print("=" * 60)
    print("Clone Detection Demo - Basic Usage")
    print("=" * 60)

    from ml import RandomForestClassifier
    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    # Sample code pairs
    code_pairs = [
        # Clone pair (Type-2: renamed variables)
        (
            """
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total
""",
            """
def calculate_product(numbers):
    result = 1
    for num in numbers:
        result *= num
    return result
""",
        ),
        # Clone pair (Type-1: exact copy)
        (
            """
def find_max(arr):
    max_val = arr[0]
    for val in arr:
        if val > max_val:
            max_val = val
    return max_val
""",
            """
def find_max(arr):
    max_val = arr[0]
    for val in arr:
        if val > max_val:
            max_val = val
    return max_val
""",
        ),
        # Non-clone pair (different logic)
        (
            """
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
""",
            """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr
""",
        ),
    ]

    # Initialize components
    print("\n[1/4] Initializing components...")
    engine = ParserEngine()
    mapper = ToMAMapper("python")
    extractor = FeatureExtractor()

    # Try to load trained model (optional)
    model_path = "data/models/clone_classifier.joblib"
    try:
        print(f"      Loading model from {model_path}...")
        clf = RandomForestClassifier()
        clf.load(model_path)
        print("      ✓ Model loaded successfully")
        use_model = True
    except FileNotFoundError:
        print(f"      ⚠ Model not found at {model_path}")
        print("      Using rule-based classification instead")
        use_model = False

    # Process each pair
    print("\n[2/4] Processing code pairs...")
    results = []

    for i, (code_a, code_b) in enumerate(code_pairs, 1):
        print(f"\n  Pair {i}:")

        # Parse code
        tree_a = engine.parse(code_a.encode(), "python")
        tree_b = engine.parse(code_b.encode(), "python")

        # Map to tokens
        tokens_a = mapper.map_fragment(tree_a.root_node, code_a.encode())
        tokens_b = mapper.map_fragment(tree_b.root_node, code_b.encode())

        print(f"    Tokens A: {len(tokens_a)}")
        print(f"    Tokens B: {len(tokens_b)}")

        # Extract features
        features = extractor.extract_features(tokens_a, tokens_b)
        print(f"    Features: {features}")

        # Classify
        if use_model:
            X = np.array([features])
            prediction = clf.predict(X)[0]
            probability = clf.predict_clone_probability(X)[0]

            is_clone = prediction == 1
            confidence = probability if is_clone else 1 - probability
        else:
            # Rule-based fallback (high similarity = likely clone)
            lev_ratio = features[1]  # Levenshtein ratio
            jaccard = features[4]  # Jaccard similarity

            # Simple threshold-based classification
            is_clone = lev_ratio > 0.7 and jaccard > 0.5
            confidence = (
                max(lev_ratio, jaccard) if is_clone else 1 - max(lev_ratio, jaccard)
            )

        results.append(
            {
                "pair_id": i,
                "is_clone": is_clone,
                "confidence": confidence,
                "features": features,
            }
        )

        print(f"    Clone: {is_clone}")
        print(f"    Confidence: {confidence:.2%}")

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    for result in results:
        status = "✓ CLONE" if result["is_clone"] else "✗ Not a clone"
        print(
            f"  Pair {result['pair_id']}: {status} (confidence: {result['confidence']:.2%})"
        )

    print("\n" + "=" * 60)


def demo_feature_visualization():
    """Demonstrate ToMA feature extraction."""
    print("\n\n")
    print("=" * 60)
    print("ToMA Feature Extraction Demo")
    print("=" * 60)

    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    # Example code
    code_a = """
def process_data(items):
    results = []
    for item in items:
        if item.valid:
            results.append(item.value)
    return results
"""

    code_b = """
def process_data(elements):
    output = []
    for elem in elements:
        if elem.valid:
            output.append(elem.value)
    return output
"""

    print("\nCode A:")
    print(code_a)
    print("\nCode B:")
    print(code_b)

    # Extract and display features
    engine = ParserEngine()
    mapper = ToMAMapper("python")
    extractor = FeatureExtractor()

    tree_a = engine.parse(code_a.encode(), "python")
    tree_b = engine.parse(code_b.encode(), "python")

    tokens_a = mapper.map_fragment(tree_a.root_node, code_a.encode())
    tokens_b = mapper.map_fragment(tree_b.root_node, code_b.encode())

    print("\nToMA Token Sequences:")
    print(f"  Code A tokens: {tokens_a}")
    print(f"  Code B tokens: {tokens_b}")

    features = extractor.extract_features(tokens_a, tokens_b)

    print("\n6D Feature Vector:")
    feature_names = [
        "Levenshtein Distance",
        "Levenshtein Ratio",
        "Jaro Similarity",
        "Jaro-Winkler Similarity",
        "Jaccard Similarity",
        "Dice Coefficient",
    ]

    for name, value in zip(feature_names, features):
        bar = (
            "█" * int(value * 20)
            if name != "Levenshtein Distance"
            else "█" * int(100 / (value + 1))
        )
        print(f"  {name:25s}: {value:6.4f} {bar}")

    # Normalized features
    normalized = extractor.normalize_features(features)
    print("\nNormalized Features (all 0-1):")
    for name, value in zip(feature_names, normalized):
        print(f"  {name:25s}: {value:6.4f}")


def demo_batch_processing():
    """Demonstrate batch clone detection."""
    print("\n\n")
    print("=" * 60)
    print("Batch Clone Detection Demo")
    print("=" * 60)

    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    # Simulate multiple code submissions
    submissions = [
        ("student_1", "def add(a,b): return a+b"),
        ("student_2", "def add(x,y): return x+y"),
        ("student_3", "def multiply(a,b): return a*b"),
        ("student_4", "def sum(a,b): return a+b"),
        ("student_5", "def sort(arr): return sorted(arr)"),
    ]

    print(f"\nProcessing {len(submissions)} submissions...")

    engine = ParserEngine()
    mapper = ToMAMapper("python")
    extractor = FeatureExtractor()

    # Extract features for all submissions
    fragments = []
    for name, code in submissions:
        try:
            tree = engine.parse(code.encode(), "python")
            tokens = mapper.map_fragment(tree.root_node, code.encode())
            fragments.append((name, tokens))
        except Exception as e:
            print(f"  Warning: Could not process {name}: {e}")

    # Compare all pairs
    print("\nPairwise Comparisons:")
    print("-" * 60)

    clone_pairs = []

    for i in range(len(fragments)):
        for j in range(i + 1, len(fragments)):
            name_i, tokens_i = fragments[i]
            name_j, tokens_j = fragments[j]

            features = extractor.extract_features(tokens_i, tokens_j)

            # Simple similarity threshold
            similarity = features[1]  # Levenshtein ratio

            if similarity > 0.8:
                clone_pairs.append((name_i, name_j, similarity))
                print(f"  🚨 {name_i} ↔ {name_j}: {similarity:.2%} similar")

    print("\n" + "=" * 60)
    print(f"Detected {len(clone_pairs)} potential clone pairs")

    if clone_pairs:
        print("\nRecommendation: Review these pairs for potential plagiarism")


def main():
    """Run all demos."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "Clone Detection System Demo" + " " * 19 + "║")
    print("╚" + "=" * 58 + "╝")
    print()

    try:
        demo_basic_usage()
        demo_feature_visualization()
        demo_batch_processing()

        print("\n\n")
        print("=" * 60)
        print("Demo Complete!")
        print("=" * 60)
        print("\nTo train a production model, run:")
        print("  python scripts/train_model.py -d datasets/toma-dataset -n 10000")
        print("\nFor more information, see docs/TRAINING_GUIDE.md")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error during demo: {e}")
        print("\nMake sure dependencies are installed:")
        print("  pip install tree-sitter tree-sitter-python python-Levenshtein")


if __name__ == "__main__":
    main()
