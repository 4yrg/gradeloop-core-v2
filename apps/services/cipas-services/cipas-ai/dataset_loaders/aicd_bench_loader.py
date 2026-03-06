#!/usr/bin/env python3
"""
aicd_bench_loader.py
────────────────────
Loader for AICD-bench Task 1 (Robust Binary Classification) dataset.

AICD-bench is a large-scale evaluation benchmark with:
- 2M+ examples across 9 programming languages
- Task 1: Binary classification (human vs. AI-generated)
- Supports per-language evaluation for OOD analysis

Expected CSV format:
    code,label,language,source (columns may vary)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional

import pandas as pd
import torch
from torch.utils.data import Dataset, IterableDataset

logger = logging.getLogger(__name__)


@dataclass
class AICDBenchSample:
    """Sample from AICD-bench dataset."""
    
    code: str
    label: int  # 0=human, 1=ai-generated
    language: str
    source: Optional[str] = None  # Source dataset/generator
    metadata: dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class AICDBenchDataset(Dataset):
    """Dataset for AICD-bench Task 1 (binary classification)."""
    
    SUPPORTED_LANGUAGES = {
        "c", "c++", "cpp", "csharp", "c#", "go", "java", 
        "javascript", "js", "php", "python", "rust"
    }
    
    def __init__(
        self,
        csv_path: Path,
        language_filter: Optional[List[str]] = None,
        max_samples: Optional[int] = None,
    ):
        """Initialize AICD-bench dataset.
        
        Args:
            csv_path: Path to AICD-bench CSV file (T1_test.csv, T1_train.csv, etc.)
            language_filter: List of languages to include (None = all)
            max_samples: Maximum number of samples to load (None = all)
        """
        self.csv_path = csv_path
        self.language_filter = set(lang.lower() for lang in language_filter) if language_filter else None
        self.max_samples = max_samples
        
        logger.info(f"Loading AICD-bench from {csv_path}")
        self.samples = self._load_samples()
        logger.info(f"Loaded {len(self.samples)} samples from AICD-bench")
        
        if len(self.samples) > 0:
            self._log_statistics()
    
    def _load_samples(self) -> List[AICDBenchSample]:
        """Load samples from CSV."""
        if not self.csv_path.exists():
            logger.error(f"AICD-bench file not found: {self.csv_path}")
            return []
        
        samples = []
        
        try:
            # Read CSV in chunks to handle large files
            chunk_size = 10000
            for chunk in pd.read_csv(self.csv_path, chunksize=chunk_size):
                for _, row in chunk.iterrows():
                    # Extract fields (column names may vary)
                    code = row.get('code') or row.get('Code') or row.get('source_code')
                    label = row.get('label') or row.get('Label')
                    language = row.get('language') or row.get('Language', '').lower()
                    source = row.get('source') or row.get('Source')
                    
                    if code is None or label is None:
                        continue
                    
                    # Normalize language name
                    if language in ['c++', 'cpp']:
                        language = 'c++'
                    elif language in ['csharp', 'c#']:
                        language = 'c#'
                    elif language in ['javascript', 'js']:
                        language = 'javascript'
                    
                    # Apply language filter
                    if self.language_filter and language not in self.language_filter:
                        continue
                    
                    # Parse label
                    if isinstance(label, str):
                        label = 0 if label.lower() in ['human', 'human-written', '0'] else 1
                    else:
                        label = int(label)
                    
                    sample = AICDBenchSample(
                        code=str(code),
                        label=label,
                        language=language,
                        source=str(source) if source else None,
                        metadata={}
                    )
                    samples.append(sample)
                    
                    # Check max samples
                    if self.max_samples and len(samples) >= self.max_samples:
                        break
                
                if self.max_samples and len(samples) >= self.max_samples:
                    break
                    
        except Exception as e:
            logger.error(f"Error loading AICD-bench: {e}")
            return []
        
        return samples
    
    def _log_statistics(self):
        """Log dataset statistics."""
        from collections import Counter
        
        # Count by language
        lang_counts = Counter(s.language for s in self.samples)
        logger.info(f"Samples by language: {dict(lang_counts)}")
        
        # Count by label
        label_counts = Counter(s.label for s in self.samples)
        logger.info(f"Samples by label: {dict(label_counts)}")
        
        # Per-language label distribution
        for lang in sorted(lang_counts.keys()):
            lang_samples = [s for s in self.samples if s.language == lang]
            lang_labels = Counter(s.label for s in lang_samples)
            human_pct = lang_labels.get(0, 0) / len(lang_samples) * 100
            ai_pct = lang_labels.get(1, 0) / len(lang_samples) * 100
            logger.info(
                f"  {lang}: {len(lang_samples)} samples "
                f"(Human: {human_pct:.1f}%, AI: {ai_pct:.1f}%)"
            )
    
    def __len__(self) -> int:
        return len(self.samples)
    
    def __getitem__(self, idx: int) -> AICDBenchSample:
        return self.samples[idx]
    
    def get_language_samples(self, language: str) -> List[AICDBenchSample]:
        """Get all samples for a specific language."""
        language = language.lower()
        return [s for s in self.samples if s.language == language]
    
    def get_label_distribution(self) -> dict:
        """Get overall label distribution."""
        from collections import Counter
        label_counts = Counter(s.label for s in self.samples)
        total = len(self.samples)
        return {
            label: {"count": count, "percentage": count / total * 100}
            for label, count in label_counts.items()
        }
    
    def get_per_language_distribution(self) -> dict:
        """Get per-language statistics."""
        from collections import Counter
        
        lang_stats = {}
        lang_counts = Counter(s.language for s in self.samples)
        
        for lang in lang_counts:
            lang_samples = [s for s in self.samples if s.language == lang]
            label_counts = Counter(s.label for s in lang_samples)
            
            lang_stats[lang] = {
                "total": len(lang_samples),
                "human": label_counts.get(0, 0),
                "ai_generated": label_counts.get(1, 0),
                "human_percentage": label_counts.get(0, 0) / len(lang_samples) * 100,
                "ai_percentage": label_counts.get(1, 0) / len(lang_samples) * 100,
            }
        
        return lang_stats


class AICDBenchStreamingDataset(IterableDataset):
    """Streaming dataset for very large AICD-bench files (2M+ samples).
    
    Use this when the full dataset doesn't fit in memory.
    """
    
    def __init__(
        self,
        csv_path: Path,
        language_filter: Optional[List[str]] = None,
        chunk_size: int = 10000,
    ):
        """Initialize streaming dataset.
        
        Args:
            csv_path: Path to AICD-bench CSV file
            language_filter: List of languages to include
            chunk_size: Number of rows to read per chunk
        """
        self.csv_path = csv_path
        self.language_filter = set(lang.lower() for lang in language_filter) if language_filter else None
        self.chunk_size = chunk_size
        
        logger.info(f"Initialized streaming dataset for {csv_path}")
    
    def _parse_row(self, row) -> Optional[AICDBenchSample]:
        """Parse a single row."""
        try:
            code = row.get('code') or row.get('Code') or row.get('source_code')
            label = row.get('label') or row.get('Label')
            language = row.get('language') or row.get('Language', '').lower()
            source = row.get('source') or row.get('Source')
            
            if code is None or label is None:
                return None
            
            # Normalize language
            if language in ['c++', 'cpp']:
                language = 'c++'
            elif language in ['csharp', 'c#']:
                language = 'c#'
            elif language in ['javascript', 'js']:
                language = 'javascript'
            
            # Apply language filter
            if self.language_filter and language not in self.language_filter:
                return None
            
            # Parse label
            if isinstance(label, str):
                label = 0 if label.lower() in ['human', 'human-written', '0'] else 1
            else:
                label = int(label)
            
            return AICDBenchSample(
                code=str(code),
                label=label,
                language=language,
                source=str(source) if source else None,
                metadata={}
            )
        except Exception as e:
            logger.debug(f"Error parsing row: {e}")
            return None
    
    def __iter__(self) -> Iterator[AICDBenchSample]:
        """Iterate through samples."""
        for chunk in pd.read_csv(self.csv_path, chunksize=self.chunk_size):
            for _, row in chunk.iterrows():
                sample = self._parse_row(row)
                if sample:
                    yield sample


def create_aicd_bench_dataset(
    dataset_path: Path,
    split: str = "test",
    language_filter: Optional[List[str]] = None,
    max_samples: Optional[int] = None,
    streaming: bool = False,
) -> Dataset:
    """Factory function to create AICD-bench dataset.
    
    Args:
        dataset_path: Path to aicd-bench directory or CSV file
        split: "train", "test", or "validation"
        language_filter: List of languages (e.g., ["python", "java", "c"])
        max_samples: Maximum samples to load (None = all)
        streaming: Use streaming mode for very large files
    
    Returns:
        AICDBenchDataset or AICDBenchStreamingDataset
    """
    # Resolve CSV path
    if dataset_path.is_dir():
        csv_path = dataset_path / f"T1_{split}.csv"
    else:
        csv_path = dataset_path
    
    if not csv_path.exists():
        raise FileNotFoundError(f"AICD-bench file not found: {csv_path}")
    
    if streaming:
        return AICDBenchStreamingDataset(
            csv_path=csv_path,
            language_filter=language_filter,
        )
    else:
        return AICDBenchDataset(
            csv_path=csv_path,
            language_filter=language_filter,
            max_samples=max_samples,
        )


if __name__ == "__main__":
    # Test loading
    logging.basicConfig(level=logging.INFO)
    
    # Load test split with language filter
    dataset = create_aicd_bench_dataset(
        dataset_path=Path("../../../../datasets/aicd-bench"),
        split="test",
        language_filter=["python", "java", "c", "c#"],  # Focus on 4 languages
        max_samples=1000,  # Test with 1000 samples
    )
    
    print(f"\nTotal samples: {len(dataset)}")
    print(f"\nLabel distribution: {dataset.get_label_distribution()}")
    print(f"\nPer-language distribution: {dataset.get_per_language_distribution()}")
    
    # Show first sample
    if len(dataset) > 0:
        sample = dataset[0]
        print(f"\nFirst sample:")
        print(f"  Language: {sample.language}")
        print(f"  Label: {sample.label}")
        print(f"  Code length: {len(sample.code)} chars")
        print(f"  Source: {sample.source}")
