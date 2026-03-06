#!/usr/bin/env python3
"""
Example script showing how to use the downloaded AICD-Bench dataset.

This script demonstrates:
1. Loading the downloaded CSV files
2. Basic data exploration
3. Simple analysis of the dataset
"""

import pandas as pd
from pathlib import Path
import sys
import logging


def setup_logging():
    """Configure logging for the script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    return logging.getLogger(__name__)


def load_dataset(dataset_dir: Path, logger):
    """
    Load the AICD-Bench dataset from CSV files.
    
    Args:
        dataset_dir (Path): Directory containing the CSV files
        logger: Logger instance
    
    Returns:
        dict: Dictionary of DataFrames keyed by split name
    """
    logger.info(f"Loading dataset from: {dataset_dir}")
    
    if not dataset_dir.exists():
        logger.error(f"Dataset directory not found: {dataset_dir}")
        logger.info("Please run download_aicdbench_dataset.py first to download the dataset")
        return None
    
    datasets = {}
    csv_files = list(dataset_dir.glob("*.csv"))
    
    if not csv_files:
        logger.error("No CSV files found in dataset directory")
        return None
    
    for csv_file in csv_files:
        split_name = csv_file.stem  # Remove .csv extension
        logger.info(f"Loading {split_name} split...")
        
        try:
            df = pd.read_csv(csv_file)
            datasets[split_name] = df
            logger.info(f"✓ {split_name}: {len(df)} samples")
        except Exception as e:
            logger.error(f"✗ Error loading {csv_file}: {e}")
            return None
    
    return datasets


def explore_dataset(datasets: dict, logger):
    """
    Perform basic exploration of the dataset.
    
    Args:
        datasets (dict): Dictionary of DataFrames
        logger: Logger instance
    """
    logger.info("="*50)
    logger.info("DATASET EXPLORATION")
    logger.info("="*50)
    
    total_samples = 0
    
    for split_name, df in datasets.items():
        logger.info(f"\n{split_name.upper()} SPLIT:")
        logger.info(f"  Samples: {len(df):,}")
        logger.info(f"  Columns: {list(df.columns)}")
        
        total_samples += len(df)
        
        # Display label distribution
        if 'label' in df.columns:
            label_counts = df['label'].value_counts()
            logger.info(f"  Label distribution:")
            for label, count in label_counts.items():
                percentage = (count / len(df)) * 100
                logger.info(f"    {label}: {count:,} ({percentage:.1f}%)")
        elif 'is_human' in df.columns:
            label_counts = df['is_human'].value_counts()
            logger.info(f"  Human/AI distribution:")
            for label, count in label_counts.items():
                human_ai = "Human" if label else "AI-generated"
                percentage = (count / len(df)) * 100
                logger.info(f"    {human_ai}: {count:,} ({percentage:.1f}%)")
        elif 'source' in df.columns:
            source_counts = df['source'].value_counts()
            logger.info(f"  Source distribution:")
            for source, count in source_counts.items():
                percentage = (count / len(df)) * 100
                logger.info(f"    {source}: {count:,} ({percentage:.1f}%)")
        
        # Show data types
        logger.info(f"  Data types:")
        for col, dtype in df.dtypes.items():
            logger.info(f"    {col}: {dtype}")
        
        # Show missing values
        missing = df.isnull().sum()
        if missing.sum() > 0:
            logger.info(f"  Missing values:")
            for col, count in missing.items():
                if count > 0:
                    logger.info(f"    {col}: {count}")
        else:
            logger.info("  Missing values: None")
        
        # Show sample data (first 2 rows, truncated)
        logger.info(f"  Sample data (first 2 rows):")
        for idx, row in df.head(2).iterrows():
            logger.info(f"    Row {idx}:")
            for col, value in row.items():
                if col == 'code' or col == 'content' or 'code' in col.lower() or col == 'text':
                    # Truncate code for display
                    code_preview = str(value)[:100] + "..." if len(str(value)) > 100 else str(value)
                    logger.info(f"      {col}: {code_preview}")
                else:
                    logger.info(f"      {col}: {value}")
    
    logger.info(f"\nTOTAL SAMPLES ACROSS ALL SPLITS: {total_samples:,}")


def analyze_code_samples(datasets: dict, logger):
    """
    Perform analysis specific to code samples.
    
    Args:
        datasets (dict): Dictionary of DataFrames
        logger: Logger instance
    """
    logger.info("="*50)
    logger.info("CODE ANALYSIS")
    logger.info("="*50)
    
    for split_name, df in datasets.items():
        # Find code column (could be 'code', 'content', 'text', etc.)
        code_col = None
        for col in df.columns:
            if 'code' in col.lower() or col.lower() in ['content', 'text']:
                code_col = col
                break
        
        if not code_col:
            logger.info(f"\n{split_name.upper()}: No code column found")
            continue
            
        logger.info(f"\n{split_name.upper()} CODE ANALYSIS:")
        logger.info(f"  Code column: '{code_col}'")
        
        # Code length statistics
        code_lengths = df[code_col].astype(str).str.len()
        logger.info(f"  Code length statistics:")
        logger.info(f"    Min: {code_lengths.min():,} characters")
        logger.info(f"    Max: {code_lengths.max():,} characters")
        logger.info(f"    Mean: {code_lengths.mean():.1f} characters")
        logger.info(f"    Median: {code_lengths.median():.1f} characters")
        
        # Line count statistics
        line_counts = df[code_col].astype(str).str.count('\n') + 1
        logger.info(f"  Line count statistics:")
        logger.info(f"    Min: {line_counts.min()} lines")
        logger.info(f"    Max: {line_counts.max()} lines")
        logger.info(f"    Mean: {line_counts.mean():.1f} lines")
        logger.info(f"    Median: {line_counts.median():.1f} lines")
        
        # Language detection (basic heuristics)
        logger.info(f"  Language patterns (heuristic):")
        java_patterns = df[code_col].astype(str).str.contains('public class|import java|System\.|void main', case=False, na=False).sum()
        python_patterns = df[code_col].astype(str).str.contains('def |import |from .* import|print\(', case=False, na=False).sum()
        c_patterns = df[code_col].astype(str).str.contains('#include|int main|printf', case=False, na=False).sum()
        js_patterns = df[code_col].astype(str).str.contains('function |const |let |var |console\.', case=False, na=False).sum()
        cpp_patterns = df[code_col].astype(str).str.contains('std::|cout|cin|#include.*iostream', case=False, na=False).sum()
        
        logger.info(f"    Java-like: {java_patterns}")
        logger.info(f"    Python-like: {python_patterns}")
        logger.info(f"    C-like: {c_patterns}")
        logger.info(f"    JavaScript-like: {js_patterns}")
        logger.info(f"    C++-like: {cpp_patterns}")


def main():
    """Main function to demonstrate dataset usage."""
    logger = setup_logging()
    
    # Get dataset path
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent.parent
    dataset_dir = project_root / "datasets" / "aicd-bench"
    
    logger.info("AICD-Bench Dataset Usage Example")
    logger.info("="*50)
    
    # Load the dataset
    datasets = load_dataset(dataset_dir, logger)
    
    if not datasets:
        logger.error("Failed to load dataset. Exiting.")
        sys.exit(1)
    
    # Explore the dataset
    explore_dataset(datasets, logger)
    
    # Analyze code samples
    analyze_code_samples(datasets, logger)
    
    logger.info("="*50)
    logger.info("Dataset exploration completed!")
    logger.info("This dataset can now be used for:")
    logger.info("- Training AI code detection models")
    logger.info("- Evaluating model performance")
    logger.info("- Analyzing differences between human and AI-generated code")
    logger.info("- Benchmarking different detection approaches")
    logger.info("- AICD benchmark evaluation")


if __name__ == "__main__":
    main()