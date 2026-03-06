#!/usr/bin/env python3
"""
Training entry point - CLI interface for model training
Usage: python train.py [--config config.yaml] [--model catboost|droiddetect] [--dataset dataset_name]
"""

import asyncio
import argparse
import sys
from pathlib import Path
import logging

# Add the cipas_ai package to path
sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.config.settings import Settings
from cipas_ai.pipeline.orchestrator import TrainingOrchestrator

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Train CIPAS-AI models")
    
    parser.add_argument(
        "--config", 
        type=str, 
        default="config.yaml",
        help="Path to configuration file (default: config.yaml)"
    )
    
    parser.add_argument(
        "--model", 
        type=str, 
        choices=["catboost", "droiddetect"],
        default="catboost",
        help="Model type to train (default: catboost)"
    )
    
    parser.add_argument(
        "--dataset", 
        type=str, 
        default="synthetic",
        help="Dataset to use for training (default: synthetic)"
    )
    
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Enable verbose logging"
    )
    
    return parser.parse_args()

async def main():
    """Main training function"""
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
        
        # Initialize training orchestrator
        logger.info("Initializing training orchestrator")
        orchestrator = TrainingOrchestrator(settings)
        
        # Progress callback
        def progress_callback(progress: float, message: str):
            print(f"[{progress:6.1f}%] {message}")
        
        logger.info(f"Starting training: model={args.model}, dataset={args.dataset}")
        
        # Run training
        results = await orchestrator.run_training(
            dataset=args.dataset,
            model_type=args.model,
            progress_callback=progress_callback
        )
        
        # Print results
        print("\n" + "="*50)
        print("TRAINING COMPLETED SUCCESSFULLY")
        print("="*50)
        print(f"Model Type: {results['model_type']}")
        print(f"Dataset: {results['dataset']}")
        print(f"Model Path: {results['model_path']}")
        print(f"Training Samples: {results['training_samples']}")
        print(f"Test Samples: {results['test_samples']}")
        
        if results.get('metrics'):
            print(f"Test Accuracy: {results['metrics'].get('accuracy', 'N/A'):.4f}")
        
        print("="*50)
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        print(f"❌ Training failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())