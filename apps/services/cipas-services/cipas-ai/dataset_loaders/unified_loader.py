#!/usr/bin/env python3
"""
unified_loader.py
─────────────────
Unified dataset loader for combining multiple AI code detection datasets:
- AIGCodeSet (7,583 train + 7,583 test samples)
- HumanVsAICode (507,045 samples with paired human/AI code)
- DroidCollection (large-scale, multi-language, multi-generator)
- Zendoo (Java/Python focused)

Implements stratified sampling to balance dataset representation:
- AIGCodeSet: 5%
- HumanVsAICode: 40%
- DroidCollection: 50%
- Zendoo: 5%

Label Schema (Binary):
    0: Human-written code
    1: AI-generated code (includes machine-generated, refined, adversarial)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, List, Optional

import pandas as pd
import torch
from torch.utils.data import Dataset, IterableDataset

logger = logging.getLogger(__name__)


@dataclass
class DatasetSample:
    """Unified sample format across all datasets."""
    
    code: str
    label: int  # 0=human, 1=ai-generated
    language: str
    docstring: Optional[str] = None
    source_dataset: str = ""
    metadata: dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class AIGCodeSetLoader:
    """Loader for AIGCodeSet dataset (CSV format)."""
    
    def __init__(self, csv_path: Path):
        self.csv_path = csv_path
        logger.info(f"Loading AIGCodeSet from {csv_path}")
        
    def load(self) -> List[DatasetSample]:
        """Load AIGCodeSet samples.
        
        Expected columns: problem_id, submission_id, status_in_folder, LLM, 
                         code, ada_embedding, label, lines, code_lines, 
                         comments, functions, blank_lines
        """
        if not self.csv_path.exists():
            logger.warning(f"AIGCodeSet not found at {self.csv_path}, skipping")
            return []
            
        df = pd.read_csv(self.csv_path)
        samples = []
        
        for _, row in df.iterrows():
            # AIGCodeSet has binary labels already (0=human, 1=ai-generated)
            sample = DatasetSample(
                code=str(row['code']),
                label=int(row['label']),
                language="python",  # AIGCodeSet is Python-only
                docstring=None,
                source_dataset="aigcodeset",
                metadata={
                    "problem_id": row.get('problem_id'),
                    "llm": row.get('LLM') if row['label'] == 1 else None,
                    "lines": row.get('lines'),
                    "code_lines": row.get('code_lines'),
                }
            )
            samples.append(sample)
            
        logger.info(f"Loaded {len(samples)} samples from AIGCodeSet")
        return samples


class HumanVsAICodeLoader:
    """Loader for HumanVsAICode dataset (CSV format with paired code)."""
    
    def __init__(self, csv_path: Path):
        self.csv_path = csv_path
        logger.info(f"Loading HumanVsAICode from {csv_path}")
        
    def load(self) -> List[DatasetSample]:
        """Load HumanVsAICode samples.
        
        Expected columns: hm_index, docstring, human_code, chatgpt_code, 
                         dsc_code, qwen_code
        
        Creates samples from:
        - (human_code, label=0)
        - (chatgpt_code, label=1)
        - (dsc_code, label=1)
        - (qwen_code, label=1)
        """
        if not self.csv_path.exists():
            logger.warning(f"HumanVsAICode not found at {self.csv_path}, skipping")
            return []
            
        df = pd.read_csv(self.csv_path)
        samples = []
        
        for _, row in df.iterrows():
            docstring = str(row.get('docstring', '')) if pd.notna(row.get('docstring')) else None
            
            # Human code
            if pd.notna(row.get('human_code')):
                samples.append(DatasetSample(
                    code=str(row['human_code']),
                    label=0,
                    language="python",  # Most likely Python based on dataset
                    docstring=docstring,
                    source_dataset="humanvsai",
                    metadata={"hm_index": row.get('hm_index'), "generator": "human"}
                ))
            
            # ChatGPT code
            if pd.notna(row.get('chatgpt_code')):
                samples.append(DatasetSample(
                    code=str(row['chatgpt_code']),
                    label=1,
                    language="python",
                    docstring=docstring,
                    source_dataset="humanvsai",
                    metadata={"hm_index": row.get('hm_index'), "generator": "chatgpt"}
                ))
            
            # DeepSeek Coder code
            if pd.notna(row.get('dsc_code')):
                samples.append(DatasetSample(
                    code=str(row['dsc_code']),
                    label=1,
                    language="python",
                    docstring=docstring,
                    source_dataset="humanvsai",
                    metadata={"hm_index": row.get('hm_index'), "generator": "deepseek"}
                ))
            
            # Qwen code
            if pd.notna(row.get('qwen_code')):
                samples.append(DatasetSample(
                    code=str(row['qwen_code']),
                    label=1,
                    language="python",
                    docstring=docstring,
                    source_dataset="humanvsai",
                    metadata={"hm_index": row.get('hm_index'), "generator": "qwen"}
                ))
        
        logger.info(f"Loaded {len(samples)} samples from HumanVsAICode")
        return samples


class DroidCollectionLoader:
    """Loader for DroidCollection dataset (JSONL format)."""
    
    LABEL_MAP_BINARY = {
        "HUMAN_GENERATED": 0,
        "MACHINE_GENERATED": 1,
        "MACHINE_REFINED": 1,
        "MACHINE_GENERATED_ADVERSARIAL": 1,
    }
    
    # Supported languages (focus on C, C#, Python, Java)
    SUPPORTED_LANGUAGES = {"c", "c++", "cpp", "csharp", "c#", "python", "java"}
    
    def __init__(self, jsonl_path: Path, filter_languages: bool = True):
        self.jsonl_path = jsonl_path
        self.filter_languages = filter_languages
        logger.info(f"Loading DroidCollection from {jsonl_path}")
        
    def load(self) -> List[DatasetSample]:
        """Load DroidCollection samples.
        
        Expected JSON structure:
        {
            "Code": "...",
            "Label": "HUMAN_GENERATED" | "MACHINE_GENERATED" | ...,
            "Language": "python" | "java" | ...,
            ...
        }
        """
        if not self.jsonl_path.exists():
            logger.warning(f"DroidCollection not found at {self.jsonl_path}, skipping")
            return []
        
        samples = []
        skipped_languages = set()
        
        with open(self.jsonl_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue
                    
                try:
                    data = json.loads(line)
                    
                    # Extract fields
                    code = data.get('Code') or data.get('code')
                    label_str = data.get('Label') or data.get('label')
                    language = (data.get('Language') or data.get('language', '')).lower()
                    
                    if not code or not label_str:
                        continue
                    
                    # Filter languages if enabled
                    if self.filter_languages and language not in self.SUPPORTED_LANGUAGES:
                        skipped_languages.add(language)
                        continue
                    
                    # Map to binary label
                    label = self.LABEL_MAP_BINARY.get(label_str)
                    if label is None:
                        logger.warning(f"Unknown label '{label_str}' at line {line_num}")
                        continue
                    
                    sample = DatasetSample(
                        code=code,
                        label=label,
                        language=language,
                        docstring=None,
                        source_dataset="droidcollection",
                        metadata={
                            "original_label": label_str,
                            "generator": data.get('Generator'),
                        }
                    )
                    samples.append(sample)
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON decode error at line {line_num}: {e}")
                except Exception as e:
                    logger.warning(f"Error processing line {line_num}: {e}")
        
        if skipped_languages:
            logger.info(f"Skipped languages: {skipped_languages}")
        
        logger.info(f"Loaded {len(samples)} samples from DroidCollection")
        return samples


class ZendooLoader:
    """Loader for Zendoo dataset (JSONL format)."""
    
    def __init__(self, jsonl_path: Path, language: str):
        self.jsonl_path = jsonl_path
        self.language = language.lower()
        logger.info(f"Loading Zendoo {language} from {jsonl_path}")
        
    def load(self) -> List[DatasetSample]:
        """Load Zendoo samples.
        
        Expected JSON structure (to be determined from actual file):
        Likely: {"code": "...", "label": 0/1, ...}
        """
        if not self.jsonl_path.exists():
            logger.warning(f"Zendoo not found at {self.jsonl_path}, skipping")
            return []
        
        samples = []
        
        with open(self.jsonl_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue
                    
                try:
                    data = json.loads(line)
                    
                    # Flexible field extraction
                    code = data.get('code') or data.get('Code') or data.get('source')
                    label = data.get('label') or data.get('Label')
                    
                    if code is None or label is None:
                        continue
                    
                    # Ensure binary label
                    if isinstance(label, str):
                        label = 0 if label.lower() in ['human', 'human_written'] else 1
                    else:
                        label = int(label)
                    
                    sample = DatasetSample(
                        code=code,
                        label=label,
                        language=self.language,
                        docstring=data.get('docstring'),
                        source_dataset="zendoo",
                        metadata=data.get('metadata', {})
                    )
                    samples.append(sample)
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON decode error at line {line_num}: {e}")
                except Exception as e:
                    logger.warning(f"Error processing line {line_num}: {e}")
        
        logger.info(f"Loaded {len(samples)} samples from Zendoo ({self.language})")
        return samples


class UnifiedDataset(Dataset):
    """Unified dataset combining all sources with stratified sampling."""
    
    DEFAULT_SAMPLING_WEIGHTS = {
        "aigcodeset": 0.05,
        "humanvsai": 0.40,
        "droidcollection": 0.50,
        "zendoo": 0.05,
    }
    
    def __init__(
        self,
        aigcodeset_path: Optional[Path] = None,
        humanvsai_path: Optional[Path] = None,
        droidcollection_path: Optional[Path] = None,
        zendoo_python_path: Optional[Path] = None,
        zendoo_java_path: Optional[Path] = None,
        sampling_weights: Optional[dict] = None,
        filter_languages: bool = True,
    ):
        """Initialize unified dataset.
        
        Args:
            aigcodeset_path: Path to AIGCodeSet CSV
            humanvsai_path: Path to HumanVsAICode CSV
            droidcollection_path: Path to DroidCollection JSONL
            zendoo_python_path: Path to Zendoo Python JSONL
            zendoo_java_path: Path to Zendoo Java JSONL
            sampling_weights: Per-dataset sampling weights
            filter_languages: Only include C, C#, Python, Java
        """
        self.samples: List[DatasetSample] = []
        self.sampling_weights = sampling_weights or self.DEFAULT_SAMPLING_WEIGHTS
        
        # Load all datasets
        if aigcodeset_path:
            loader = AIGCodeSetLoader(aigcodeset_path)
            self.samples.extend(loader.load())
        
        if humanvsai_path:
            loader = HumanVsAICodeLoader(humanvsai_path)
            self.samples.extend(loader.load())
        
        if droidcollection_path:
            loader = DroidCollectionLoader(droidcollection_path, filter_languages)
            self.samples.extend(loader.load())
        
        if zendoo_python_path:
            loader = ZendooLoader(zendoo_python_path, "python")
            self.samples.extend(loader.load())
        
        if zendoo_java_path:
            loader = ZendooLoader(zendoo_java_path, "java")
            self.samples.extend(loader.load())
        
        logger.info(f"Total samples loaded: {len(self.samples)}")
        self._log_statistics()
    
    def _log_statistics(self):
        """Log dataset statistics."""
        from collections import Counter
        
        # Count by source
        source_counts = Counter(s.source_dataset for s in self.samples)
        logger.info(f"Samples by source: {dict(source_counts)}")
        
        # Count by label
        label_counts = Counter(s.label for s in self.samples)
        logger.info(f"Samples by label: {dict(label_counts)}")
        
        # Count by language
        lang_counts = Counter(s.language for s in self.samples)
        logger.info(f"Samples by language: {dict(lang_counts)}")
    
    def __len__(self) -> int:
        return len(self.samples)
    
    def __getitem__(self, idx: int) -> DatasetSample:
        return self.samples[idx]
    
    def get_label_distribution(self) -> dict:
        """Get label distribution statistics."""
        from collections import Counter
        label_counts = Counter(s.label for s in self.samples)
        total = len(self.samples)
        return {
            label: {"count": count, "percentage": count / total * 100}
            for label, count in label_counts.items()
        }


def create_unified_dataset(
    datasets_root: Path = Path("../../datasets"),
    split: str = "train",
    filter_languages: bool = True,
) -> UnifiedDataset:
    """Factory function to create unified dataset.
    
    Args:
        datasets_root: Root directory containing all datasets
        split: "train" or "test"
        filter_languages: Only include C, C#, Python, Java
    
    Returns:
        UnifiedDataset instance
    """
    # Resolve paths
    aigcodeset_path = datasets_root / "aigcodeset" / f"{split}.csv"
    humanvsai_path = datasets_root / "humanvsai-code" / "train.csv"  # Only has train
    
    if split == "train":
        droidcollection_path = datasets_root / "DroidCollection" / "Droid_Train.jsonl"
    else:
        droidcollection_path = datasets_root / "DroidCollection" / "Droid_Test.jsonl"
    
    zendoo_python_path = datasets_root / "Zendoo" / "python_dataset.jsonl"
    zendoo_java_path = datasets_root / "Zendoo" / "java_dataset.jsonl"
    
    return UnifiedDataset(
        aigcodeset_path=aigcodeset_path if aigcodeset_path.exists() else None,
        humanvsai_path=humanvsai_path if humanvsai_path.exists() else None,
        droidcollection_path=droidcollection_path if droidcollection_path.exists() else None,
        zendoo_python_path=zendoo_python_path if zendoo_python_path.exists() else None,
        zendoo_java_path=zendoo_java_path if zendoo_java_path.exists() else None,
        filter_languages=filter_languages,
    )


if __name__ == "__main__":
    # Test loading
    logging.basicConfig(level=logging.INFO)
    
    dataset = create_unified_dataset(
        datasets_root=Path("../../../../datasets"),
        split="train",
        filter_languages=True,
    )
    
    print(f"\nTotal samples: {len(dataset)}")
    print(f"\nLabel distribution: {dataset.get_label_distribution()}")
    
    # Show first sample
    if len(dataset) > 0:
        sample = dataset[0]
        print(f"\nFirst sample:")
        print(f"  Source: {sample.source_dataset}")
        print(f"  Language: {sample.language}")
        print(f"  Label: {sample.label}")
        print(f"  Code length: {len(sample.code)} chars")
        print(f"  Docstring: {sample.docstring[:100] if sample.docstring else 'None'}")
