#!/usr/bin/env python3
"""
Evaluation entry point - CLI interface for model evaluation
Usage: python evaluate.py [--config config.yaml] [--dataset dataset_name] [--stage pipeline|catboost|droiddetect]
"""

import asyncio
import argparse
import sys
from pathlib import Path
import logging
import json

# Add the cipas_ai package to path
sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import EvaluationOrchestrator

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Evaluate CIPAS-AI models")
    
    parser.add_argument(
        "--config", 
        type=str, 
        default="config.yaml",
        help="Path to configuration file (default: config.yaml)"
    )
    
    parser.add_argument(
        "--dataset", 
        type=str, 
        default="aicd-bench",
        help="Dataset to evaluate on (default: aicd-bench)"
    )
    
    parser.add_argument(
        "--stage", 
        type=str, 
        choices=["pipeline", "catboost", "droiddetect"],
        default="pipeline",
        help="Evaluation stage (default: pipeline)"
    )
    
    parser.add_argument(
        "--model-dir", 
        type=str, 
        help="Directory containing trained models (default: from config)"
    )
    
    parser.add_argument(
        "--max-samples", 
        type=int, 
        help="Maximum number of samples to evaluate"
    )
    
    parser.add_argument(
        "--batch-size", 
        type=int, 
        default=8,
        help="Batch size for evaluation (default: 8)"
    )
    
    parser.add_argument(
        "--output", 
        type=str, 
        help="Output file path for results (default: auto-generated)"
    )
    
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Enable verbose logging"
    )
    
    return parser.parse_args()

async def main():
    """Main evaluation function"""
    args = parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger = logging.getLogger(__name__)
    
    try:
        # Load configuration
        logger.info(f"Loading configuration from {args.config}")
        settings = Settings.from_yaml(args.config)
        
        # Initialize evaluation orchestrator
        logger.info("Initializing evaluation orchestrator")
        orchestrator = EvaluationOrchestrator(settings)
        
        # Progress callback
        def progress_callback(progress: float, message: str):
            print(f"[{progress:6.1f}%] {message}")
        
        logger.info(f"Starting evaluation: dataset={args.dataset}, stage={args.stage}")
        
        # Run evaluation
        results = await orchestrator.run_evaluation(
            dataset=args.dataset,
            model_dir=args.model_dir,
            max_samples=args.max_samples,
            batch_size=args.batch_size,
            save_results=True,
            stage=args.stage,
            progress_callback=progress_callback
        )
        
        # Print results summary
        print("\n" + "="*50)
        print("EVALUATION COMPLETED SUCCESSFULLY")
        print("="*50)
        print(f"Dataset: {results['dataset']}")
        print(f"Stage: {results['stage']}")
        print(f"Total Samples: {results['total_samples']}")
        
        metrics = results['metrics']
        print(f"Accuracy: {metrics['accuracy']:.4f}")
        print(f"Precision: {metrics['precision']:.4f}")
        print(f"Recall: {metrics['recall']:.4f}")
        print(f"F1-Score: {metrics['f1_score']:.4f}")
        
        if results.get('output_file'):
            print(f"Results saved to: {results['output_file']}")
        
        # Save or display detailed results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"Detailed results saved to: {args.output}")
        
        print("="*50)
        
        # Print classification report if verbose
        if args.verbose and 'classification_report' in metrics:
            print("\nDETAILED CLASSIFICATION REPORT:")
            print("-" * 30)
            report = metrics['classification_report']
            
            # Print per-class metrics
            for class_label, class_metrics in report.items():
                if isinstance(class_metrics, dict) and 'precision' in class_metrics:
                    print(f"Class {class_label}:")
                    print(f"  Precision: {class_metrics['precision']:.4f}")
                    print(f"  Recall: {class_metrics['recall']:.4f}")
                    print(f"  F1-Score: {class_metrics['f1-score']:.4f}")
                    print(f"  Support: {class_metrics['support']}")
                    print()
        
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        print(f"❌ Evaluation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())