"""
Demo script for 3-Stage Confidence-Based Early Exit Pipeline.

This script demonstrates the new AI code detection system with:
- Stage 1: Stylometry (Fast Layer)
- Stage 2: Structural (Medium Layer) 
- Stage 3: Deep Semantic (Heavy Layer)

Run this to see the early exit mechanism in action.
"""

import time
import logging
from typing import Dict, Any

from stylometry_extractor import StylometryExtractor
from stylometry_model import StylometryModel


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def demo_stylometry_features():
    """Demonstrate stylometry feature extraction."""
    print("=" * 60)
    print("STAGE 1 DEMO: Stylometry Feature Extraction")
    print("=" * 60)
    
    extractor = StylometryExtractor()
    
    # Human-written code sample
    human_code = '''
def calculate_fibonacci(n):
    """Calculate the nth Fibonacci number using recursion."""
    if n <= 1:
        return n
    else:
        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

def main():
    try:
        num = int(input("Enter a number: "))
        if num < 0:
            print("Please enter a non-negative number.")
            return
        
        result = calculate_fibonacci(num)
        print(f"Fibonacci number at position {num} is: {result}")
    except ValueError:
        print("Please enter a valid integer.")

if __name__ == "__main__":
    main()
'''
    
    # AI-generated code sample (with typical AI patterns)
    ai_code = '''
def function_name():
    # TODO: implement this function
    pass

class ClassName:
    # Add your code here
    pass

def calculate_result(input_data):
    result = None
    # Your code goes here
    return result

def process_data(data):
    # Placeholder implementation
    output = []
    for item in data:
        # Process each item
        processed = item
        output.append(processed)
    return output
'''
    
    print("\\nHUMAN-WRITTEN CODE FEATURES:")
    print("-" * 40)
    human_features = extractor.extract_features(human_code)
    for key, value in human_features.items():
        if isinstance(value, float):
            print(f"{key:25}: {value:.3f}")
        else:
            print(f"{key:25}: {value}")
    
    print("\\nAI-GENERATED CODE FEATURES:")
    print("-" * 40)
    ai_features = extractor.extract_features(ai_code)
    for key, value in ai_features.items():
        if isinstance(value, float):
            print(f"{key:25}: {value:.3f}")
        else:
            print(f"{key:25}: {value}")
    
    # Show key differences
    print("\\nKEY DIFFERENCES (Human vs AI):")
    print("-" * 40)
    print(f"Placeholder patterns    : {human_features['placeholder_count']} vs {ai_features['placeholder_count']}")
    print(f"Generic variable names  : {human_features['generic_var_count']} vs {ai_features['generic_var_count']}")
    print(f"Function count          : {human_features['function_count']} vs {ai_features['function_count']}")
    print(f"Comment line ratio      : {human_features['comment_line_ratio']:.3f} vs {ai_features['comment_line_ratio']:.3f}")
    print(f"Average identifier len  : {human_features['avg_identifier_length']:.1f} vs {ai_features['avg_identifier_length']:.1f}")
    
    return human_code, ai_code


def demo_stylometry_model():
    """Demonstrate stylometry model inference."""
    print("\\n" + "=" * 60)
    print("STAGE 1 DEMO: Stylometry Model Inference")
    print("=" * 60)
    
    # Create demo model with synthetic training data
    print("\\nCreating demo stylometry model...")
    start_time = time.time()
    model = StylometryModel.create_demo_model()
    load_time = (time.time() - start_time) * 1000
    print(f"Model created in {load_time:.1f}ms")
    
    # Test samples
    test_samples = [
        ("Human-like", '''
def merge_sort(arr):
    """Efficient merge sort implementation."""
    if len(arr) <= 1:
        return arr
    
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    return merge(left, right)
'''),
        ("AI-like", '''
def function_name():
    # TODO: implement this function
    result = None
    # Your code goes here
    return result
'''),
        ("Ambiguous", '''
def process(data):
    output = []
    for item in data:
        output.append(item * 2)
    return output
''')
    ]
    
    print("\\nTesting stylometry predictions:")
    print("-" * 50)
    
    for label, code in test_samples:
        start_time = time.time()
        prediction = model.predict(code)
        inference_time = (time.time() - start_time) * 1000
        
        print(f"\\n{label} Code:")
        print(f"  Predicted Label: {prediction.label}")
        print(f"  Confidence: {prediction.confidence:.3f}")
        print(f"  Human Prob: {prediction.probability_human:.3f}")
        print(f"  AI Prob: {prediction.probability_ai:.3f}")
        print(f"  Inference Time: {inference_time:.1f}ms")
        
        # Simulate early exit decision
        if prediction.confidence >= 0.80:
            print(f"  → EARLY EXIT: High confidence ({prediction.confidence:.3f} >= 0.80)")
        elif prediction.confidence <= 0.40:
            print(f"  → EARLY EXIT: Low confidence ({prediction.confidence:.3f} <= 0.40), inverting result")
        else:
            print(f"  → CONTINUE: Uncertain ({prediction.confidence:.3f}), proceed to Stage 2")


def demo_3stage_pipeline():
    """Demonstrate the complete 3-stage pipeline logic."""
    print("\\n" + "=" * 60)
    print("3-STAGE PIPELINE DEMO: Early Exit Logic")
    print("=" * 60)
    
    # Simulate different confidence scenarios
    scenarios = [
        ("High Confidence Stage 1", 0.85, "Stage 1 Exit"),
        ("Low Confidence Stage 1", 0.35, "Stage 1 Exit (Inverted)"),
        ("Uncertain Stage 1, High Confidence Stage 2", 0.60, "Stage 2 Exit"),
        ("Uncertain Stage 1&2, Stage 3 Final", 0.55, "Stage 3 Final"),
    ]
    
    print("\\nSimulating pipeline routing decisions:")
    print("-" * 50)
    
    for scenario, confidence, expected_exit in scenarios:
        print(f"\\n{scenario}:")
        print(f"  Stage 1 Confidence: {confidence:.2f}")
        
        # Stage 1 routing logic
        if confidence >= 0.80:
            print(f"  → ROUTE: Early exit at Stage 1 (high confidence)")
            print(f"  → RESULT: {expected_exit}")
            continue
        elif confidence <= 0.40:
            print(f"  → ROUTE: Early exit at Stage 1 (low confidence, invert result)")
            print(f"  → RESULT: {expected_exit}")
            continue
        else:
            print(f"  → ROUTE: Continue to Stage 2 (uncertain)")
        
        # Simulate Stage 2
        stage2_confidence = 0.75 if "Stage 2 Exit" in expected_exit else 0.55
        print(f"  Stage 2 Confidence: {stage2_confidence:.2f}")
        
        if stage2_confidence >= 0.80 or stage2_confidence <= 0.40:
            print(f"  → ROUTE: Early exit at Stage 2")
            print(f"  → RESULT: {expected_exit}")
            continue
        else:
            print(f"  → ROUTE: Continue to Stage 3 (uncertain)")
            print(f"  → RESULT: {expected_exit}")


def demo_performance_benefits():
    """Demonstrate performance benefits of early exit."""
    print("\\n" + "=" * 60)
    print("PERFORMANCE BENEFITS DEMO")
    print("=" * 60)
    
    # Simulate processing times for each stage
    stage_times = {
        "Stage 1 (Stylometry)": 3,      # ~3ms
        "Stage 2 (Structural)": 12,     # ~12ms  
        "Stage 3 (Deep Semantic)": 200  # ~200ms
    }
    
    # Simulate distribution of exits per stage
    distribution = [
        ("Stage 1 Exit", 60, stage_times["Stage 1 (Stylometry)"]),
        ("Stage 2 Exit", 25, stage_times["Stage 1 (Stylometry)"] + stage_times["Stage 2 (Structural)"]),
        ("Stage 3 Final", 15, sum(stage_times.values())),
    ]
    
    print("\\nProcessing time distribution:")
    print("-" * 40)
    
    total_weighted_time = 0
    for exit_point, percentage, cumulative_time in distribution:
        print(f"{exit_point:15}: {percentage:2d}% of cases, {cumulative_time:3d}ms each")
        total_weighted_time += (percentage / 100) * cumulative_time
    
    print(f"\\nAverage processing time with early exit: {total_weighted_time:.1f}ms")
    print(f"Processing time without early exit:      {sum(stage_times.values())}ms")
    print(f"Performance improvement:                 {((sum(stage_times.values()) - total_weighted_time) / sum(stage_times.values()) * 100):.1f}%")
    
    print("\\nThroughput comparison (requests/second):")
    print("-" * 40)
    print(f"With early exit:    {1000 / total_weighted_time:.1f} req/sec")
    print(f"Without early exit: {1000 / sum(stage_times.values()):.1f} req/sec")
    print(f"Throughput gain:    {(1000 / total_weighted_time) / (1000 / sum(stage_times.values())):.1f}x")


def main():
    """Run the complete demo."""
    print("🚀 3-STAGE CONFIDENCE-BASED EARLY EXIT PIPELINE DEMO")
    print("=" * 70)
    
    try:
        # Demo each stage
        demo_stylometry_features()
        demo_stylometry_model()
        demo_3stage_pipeline()
        demo_performance_benefits()
        
        print("\\n" + "=" * 70)
        print("✅ DEMO COMPLETED SUCCESSFULLY")
        print("=" * 70)
        
        print("\\nNext steps:")
        print("1. Train stylometry model with real data")
        print("2. Test with cipas-ai service endpoints")
        print("3. Monitor performance in production")
        print("4. Fine-tune confidence thresholds based on validation data")
        
    except Exception as e:
        print(f"\\n❌ DEMO FAILED: {e}")
        logger.exception("Demo failed with exception")


if __name__ == "__main__":
    main()