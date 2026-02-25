#!/usr/bin/env python3
"""
Clone Detection Comparison Script

Compare two code samples to determine if they are code clones.

Usage:
    # Compare two files
    python scripts/compare_samples.py file1.java file2.java

    # Compare code snippets directly
    python scripts/compare_samples.py --code1 "def hello(): pass" --code2 "def hi(): pass"

    # Compare with custom model
    python scripts/compare_samples.py file1.java file2.java -m data/models/custom_model.joblib

Example:
    python scripts/compare_samples.py \\
        ../../../../datasets/toma-dataset/id2sourcecode/10000061.java \\
        ../../../../datasets/toma-dataset/id2sourcecode/23594635.java
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional, Tuple

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

# Try to import numpy, provide helpful error if virtual env not activated
try:
    import numpy as np
except ImportError:
    print("Error: Required packages not found.", file=sys.stderr)
    print("Please activate the virtual environment first:", file=sys.stderr)
    print("  source .venv-cipas-syntax/bin/activate", file=sys.stderr)
    sys.exit(1)


def load_code_from_file(file_path: str) -> str:
    """Load source code from a file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def extract_features(
    code1: str, code2: str, language: str = "java"
) -> Tuple[np.ndarray, dict]:
    """
    Extract ToMA features from two code samples.

    Args:
        code1: First code sample
        code2: Second code sample
        language: Programming language

    Returns:
        Tuple of (feature_vector, feature_details)
    """
    from parser import ParserEngine
    from toma import FeatureExtractor, ToMAMapper

    if not code1.strip() or not code2.strip():
        return np.array([0.0] * 6), {}

    engine = ParserEngine()
    mapper = ToMAMapper(language)
    extractor = FeatureExtractor()

    # Parse code
    tree1 = engine.parse(code1.encode(), language)
    tree2 = engine.parse(code2.encode(), language)

    # Map to tokens
    tokens1 = mapper.map_fragment(tree1.root_node, code1.encode())
    tokens2 = mapper.map_fragment(tree2.root_node, code2.encode())

    if len(tokens1) == 0 or len(tokens2) == 0:
        return np.array([0.0] * 6), {
            "tokens1": [],
            "tokens2": [],
            "tokens1_count": 0,
            "tokens2_count": 0,
        }

    # Extract features - returns a tuple, convert to array
    feature_tuple = extractor.extract_features(tokens1, tokens2)
    feature_vector = np.array(feature_tuple)

    # Get normalized features
    normalized = extractor.normalize_features(feature_tuple)

    feature_details = {
        "tokens1": tokens1[:20],  # First 20 tokens for display
        "tokens2": tokens2[:20],
        "tokens1_count": len(tokens1),
        "tokens2_count": len(tokens2),
        "normalized_features": normalized,
    }

    return feature_vector, feature_details


def predict_clone(
    feature_vector: np.ndarray,
    model_path: str,
    threshold: float = 0.5,
) -> dict:
    """
    Predict if two code samples are clones.

    Args:
        feature_vector: 6D feature vector
        model_path: Path to trained model
        threshold: Classification threshold

    Returns:
        Prediction results dictionary
    """
    from ml import RandomForestClassifier

    # Load model
    clf = RandomForestClassifier()
    clf.load(model_path)

    # Reshape for prediction
    X = feature_vector.reshape(1, -1)

    # Predict
    prediction = clf.predict(X)[0]
    probability = clf.predict_clone_probability(X)[0]

    # Get feature importances
    importances = clf.get_feature_importances()

    return {
        "is_clone": bool(prediction == 1),
        "clone_probability": float(probability),
        "threshold": threshold,
        "feature_importances": importances,
    }


def calculate_similarity_metrics(feature_vector: np.ndarray) -> dict:
    """
    Calculate similarity metrics from feature vector.

    Args:
        feature_vector: 6D feature vector [lev_dist, lev_ratio, jaro, jw, jaccard, dice]

    Returns:
        Dictionary with similarity metrics
    """
    lev_dist, lev_ratio, jaro, jw, jaccard, dice = feature_vector

    # Normalize Levenshtein distance to similarity (0-1)
    # Assuming max distance is around 100 for typical code fragments
    lev_sim = max(0, 1 - (lev_dist / 100))

    return {
        "levenshtein_distance": float(lev_dist),
        "levenshtein_similarity": float(lev_ratio),
        "jaro_similarity": float(jaro),
        "jaro_winkler_similarity": float(jw),
        "jaccard_similarity": float(jaccard),
        "dice_coefficient": float(dice),
        "average_similarity": float((lev_ratio + jaro + jw + jaccard + dice) / 5),
    }


def format_comparison_report(
    code1: str,
    code2: str,
    features: dict,
    similarity: dict,
    prediction: dict,
) -> str:
    """Format a comparison report."""
    report = []
    report.append("=" * 70)
    report.append("CODE CLONE COMPARISON REPORT")
    report.append("=" * 70)
    report.append("")

    # Code samples info
    report.append("📝 Code Samples:")
    report.append(
        f"   Sample 1: {len(code1)} characters, {features.get('tokens1_count', 0)} tokens"
    )
    report.append(
        f"   Sample 2: {len(code2)} characters, {features.get('tokens2_count', 0)} tokens"
    )
    report.append("")

    # Similarity metrics
    report.append("📊 Similarity Metrics:")
    report.append(
        f"   Levenshtein Similarity:  {similarity['levenshtein_similarity']:.4f}"
    )
    report.append(f"   Jaro Similarity:         {similarity['jaro_similarity']:.4f}")
    report.append(
        f"   Jaro-Winkler Similarity: {similarity['jaro_winkler_similarity']:.4f}"
    )
    report.append(f"   Jaccard Similarity:      {similarity['jaccard_similarity']:.4f}")
    report.append(f"   Dice Coefficient:        {similarity['dice_coefficient']:.4f}")
    report.append(f"   Average Similarity:      {similarity['average_similarity']:.4f}")
    report.append("")

    # Prediction
    report.append("🎯 Clone Detection Result:")
    is_clone_str = "✅ CLONE DETECTED" if prediction["is_clone"] else "❌ NOT A CLONE"
    report.append(f"   Result: {is_clone_str}")
    report.append(f"   Clone Probability: {prediction['clone_probability']:.2%}")
    report.append(f"   Threshold: {prediction['threshold']:.2f}")
    report.append("")

    # Feature importances
    report.append("📈 Feature Importances:")
    sorted_importances = sorted(
        prediction["feature_importances"].items(),
        key=lambda x: x[1],
        reverse=True,
    )
    for feature, importance in sorted_importances:
        bar = "█" * int(importance * 20)
        report.append(f"   {feature:25s} {importance:.4f} {bar}")
    report.append("")

    # Token preview
    if features.get("tokens1"):
        report.append("🔍 Token Preview (first 20):")
        report.append(f"   Sample 1: {' '.join(features['tokens1'][:10])}...")
        report.append(f"   Sample 2: {' '.join(features['tokens2'][:10])}...")
        report.append("")

    report.append("=" * 70)

    return "\n".join(report)


def compare_files(
    file1: str,
    file2: str,
    model_path: str,
    language: str = "java",
    threshold: float = 0.5,
    output_json: Optional[str] = None,
) -> dict:
    """
    Compare two code files for clone detection.

    Args:
        file1: Path to first file
        file2: Path to second file
        model_path: Path to trained model
        language: Programming language
        threshold: Classification threshold
        output_json: Optional path to save JSON results

    Returns:
        Comparison results dictionary
    """
    print(f"Loading files...")
    print(f"  File 1: {file1}")
    print(f"  File 2: {file2}")

    # Load code
    code1 = load_code_from_file(file1)
    code2 = load_code_from_file(file2)

    return compare_code(
        code1=code1,
        code2=code2,
        model_path=model_path,
        language=language,
        threshold=threshold,
        output_json=output_json,
        file1_name=Path(file1).name,
        file2_name=Path(file2).name,
    )


def compare_code(
    code1: str,
    code2: str,
    model_path: str,
    language: str = "java",
    threshold: float = 0.5,
    output_json: Optional[str] = None,
    file1_name: str = "Sample 1",
    file2_name: str = "Sample 2",
) -> dict:
    """
    Compare two code samples for clone detection.

    Args:
        code1: First code sample
        code2: Second code sample
        model_path: Path to trained model
        language: Programming language
        threshold: Classification threshold
        output_json: Optional path to save JSON results
        file1_name: Name for first sample
        file2_name: Name for second sample

    Returns:
        Comparison results dictionary
    """
    print("Extracting features...")

    # Extract features
    feature_vector_result, feature_details = extract_features(code1, code2, language)

    print("Running clone detection...")

    # Predict
    prediction = predict_clone(feature_vector_result, model_path, threshold)

    # Calculate similarity metrics
    similarity = calculate_similarity_metrics(feature_vector_result)

    # Compile results
    results = {
        "sample1": {
            "name": file1_name,
            "characters": len(code1),
            "tokens": feature_details.get("tokens1_count", 0),
        },
        "sample2": {
            "name": file2_name,
            "characters": len(code2),
            "tokens": feature_details.get("tokens2_count", 0),
        },
        "similarity_metrics": similarity,
        "prediction": {
            "is_clone": prediction["is_clone"],
            "clone_probability": prediction["clone_probability"],
            "threshold": threshold,
        },
        "feature_importances": prediction["feature_importances"],
        "language": language,
    }

    # Generate report
    report = format_comparison_report(
        code1, code2, feature_details, similarity, prediction
    )

    # Print report
    print("\n" + report)

    # Save JSON if requested
    if output_json:
        output_path = Path(output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {output_json}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Compare two code samples for clone detection"
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "files",
        nargs="*",
        help="Two files to compare",
    )
    input_group.add_argument(
        "--code1",
        type=str,
        help="First code snippet (use with --code2)",
    )

    parser.add_argument(
        "--code2",
        type=str,
        help="Second code snippet (use with --code1)",
    )

    # Model options
    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default="data/models/clone_classifier.joblib",
        help="Path to trained model (default: data/models/clone_classifier.joblib)",
    )

    parser.add_argument(
        "--language",
        "-l",
        type=str,
        default="java",
        choices=["python", "java", "c"],
        help="Programming language (default: java)",
    )

    parser.add_argument(
        "--threshold",
        "-t",
        type=float,
        default=0.5,
        help="Classification threshold (default: 0.5)",
    )

    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Save results to JSON file",
    )

    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Only output JSON results",
    )

    args = parser.parse_args()

    # Validate model path
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"Error: Model not found at {model_path}", file=sys.stderr)
        print(
            "Please train a model first using: python scripts/train_model.py",
            file=sys.stderr,
        )
        sys.exit(1)

    # Compare files or code snippets
    if args.files and len(args.files) == 2:
        # Compare two files
        compare_files(
            file1=args.files[0],
            file2=args.files[1],
            model_path=str(model_path),
            language=args.language,
            threshold=args.threshold,
            output_json=args.output,
        )
    elif args.code1 and args.code2:
        # Compare code snippets
        compare_code(
            code1=args.code1,
            code2=args.code2,
            model_path=str(model_path),
            language=args.language,
            threshold=args.threshold,
            output_json=args.output,
        )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
