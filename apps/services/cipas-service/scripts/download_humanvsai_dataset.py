#!/usr/bin/env python3
"""
Script to download the HumanVsAICode dataset from HuggingFace Hub.
Dataset: https://huggingface.co/datasets/OSS-forge/HumanVsAICode

This script downloads the dataset to the root /datasets directory for use
in training and evaluation of AI code detection models.
"""

import os
import sys
from pathlib import Path
import logging

try:
    from datasets import load_dataset
    import pandas as pd
except ImportError as e:
    print(f"Missing required dependencies: {e}")
    print("Please install: pip install datasets pandas")
    sys.exit(1)


def setup_logging():
    """Configure logging for the download process."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)


def get_dataset_path():
    """Get the target dataset directory path."""
    # Get the root project directory (3 levels up from cipas-service/scripts/)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent.parent
    dataset_dir = project_root / "datasets" / "humanvsai-code"
    
    return dataset_dir


def download_dataset(output_dir: Path, logger):
    """
    Download the HumanVsAICode dataset from HuggingFace Hub.
    
    Args:
        output_dir (Path): Directory to save the dataset
        logger: Logger instance
    """
    logger.info("Starting download of HumanVsAICode dataset...")
    logger.info(f"Output directory: {output_dir}")
    
    try:
        # Create output directory if it doesn't exist
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Download the dataset
        logger.info("Connecting to HuggingFace Hub...")
        dataset = load_dataset("OSS-forge/HumanVsAICode")
        
        logger.info("Dataset loaded successfully!")
        logger.info(f"Dataset info: {dataset}")
        
        # Save each split as CSV files
        for split_name, split_data in dataset.items():
            logger.info(f"Processing {split_name} split...")
            
            # Convert to pandas DataFrame for easier handling
            df = split_data.to_pandas()
            logger.info(f"{split_name} split contains {len(df)} samples")
            
            # Save as CSV
            csv_path = output_dir / f"{split_name}.csv"
            df.to_csv(csv_path, index=False)
            logger.info(f"Saved {split_name} split to: {csv_path}")
            
            # Display sample statistics
            if 'label' in df.columns:
                label_counts = df['label'].value_counts()
                logger.info(f"{split_name} split label distribution:")
                for label, count in label_counts.items():
                    logger.info(f"  {label}: {count} samples")
        
        # Save dataset info
        info_path = output_dir / "dataset_info.txt"
        with open(info_path, 'w') as f:
            f.write("HumanVsAICode Dataset Information\n")
            f.write("="*40 + "\n\n")
            f.write(f"Source: https://huggingface.co/datasets/OSS-forge/HumanVsAICode\n")
            f.write(f"Downloaded on: {pd.Timestamp.now()}\n\n")
            f.write(f"Dataset structure:\n{dataset}\n\n")
            
            for split_name, split_data in dataset.items():
                f.write(f"{split_name} split:\n")
                f.write(f"  Samples: {len(split_data)}\n")
                if hasattr(split_data, 'features'):
                    f.write(f"  Features: {list(split_data.features.keys())}\n")
                f.write("\n")
        
        logger.info(f"Dataset info saved to: {info_path}")
        logger.info("Dataset download completed successfully!")
        
        return True
        
    except Exception as e:
        logger.error(f"Error downloading dataset: {e}")
        return False


def verify_dataset(output_dir: Path, logger):
    """
    Verify the downloaded dataset files.
    
    Args:
        output_dir (Path): Directory containing the dataset
        logger: Logger instance
    """
    logger.info("Verifying downloaded dataset...")
    
    csv_files = list(output_dir.glob("*.csv"))
    if not csv_files:
        logger.error("No CSV files found in output directory")
        return False
    
    total_samples = 0
    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file)
            samples = len(df)
            total_samples += samples
            logger.info(f"✓ {csv_file.name}: {samples} samples, columns: {list(df.columns)}")
        except Exception as e:
            logger.error(f"✗ Error reading {csv_file.name}: {e}")
            return False
    
    logger.info(f"✓ Total samples across all splits: {total_samples}")
    return True


def main():
    """Main function to orchestrate the dataset download."""
    logger = setup_logging()
    
    try:
        # Get output directory
        output_dir = get_dataset_path()
        logger.info(f"Target directory: {output_dir}")
        
        # Check if dataset already exists
        if output_dir.exists() and any(output_dir.glob("*.csv")):
            response = input(f"Dataset directory {output_dir} already exists with CSV files. "
                           "Do you want to overwrite? (y/N): ")
            if response.lower() != 'y':
                logger.info("Download cancelled by user.")
                return
        
        # Download dataset
        success = download_dataset(output_dir, logger)
        
        if success:
            # Verify the download
            verify_success = verify_dataset(output_dir, logger)
            
            if verify_success:
                logger.info("="*50)
                logger.info("Dataset download and verification completed successfully!")
                logger.info(f"Dataset location: {output_dir}")
                logger.info("You can now use this dataset for training AI code detection models.")
                logger.info("="*50)
            else:
                logger.error("Dataset verification failed!")
                sys.exit(1)
        else:
            logger.error("Dataset download failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Download interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()