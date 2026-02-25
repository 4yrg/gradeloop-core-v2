"""
Training Data Generator: Prepare BigCloneBench data for ML training.

This module provides utilities for loading and processing BigCloneBench
dataset to generate training data for the Random Forest classifier.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    import pandas as pd
except ImportError:
    pd = None  # type: ignore


class BCBTrainingGenerator:
    """
    Generate training pairs from BigCloneBench dataset.

    The BigCloneBench dataset contains manually validated clone pairs
    across different clone types (Type-1, Type-2, Type-3, Type-4).

    Example:
        >>> generator = BCBTrainingGenerator("datasets/bigclonebench")
        >>> X, y = generator.generate_training_data(feature_extractor, sample_size=10000)
    """

    def __init__(self, bcb_path: str):
        """
        Initialize with BigCloneBench path.

        Args:
            bcb_path: Path to BigCloneBench dataset directory
        """
        self.bcb_path = Path(bcb_path)
        self.clone_pairs_path = self.bcb_path / "clonePairs.csv"

        if pd is None:
            raise ImportError(
                "pandas is not installed. Install with: pip install pandas"
            )

    def load_clone_pairs(self) -> "pd.DataFrame":
        """
        Load BigCloneBench clone pair labels.

        Returns:
            DataFrame with clone pair information
        """
        if not self.clone_pairs_path.exists():
            raise FileNotFoundError(
                f"Clone pairs file not found: {self.clone_pairs_path}"
            )

        df = pd.read_csv(self.clone_pairs_path)
        return df

    def load_clone_pairs_by_type(
        self, clone_type: Optional[int] = None
    ) -> "pd.DataFrame":
        """
        Load clone pairs filtered by type.

        Args:
            clone_type: Filter by clone type (1, 2, 3, 4) or None for all

        Returns:
            DataFrame with filtered clone pairs
        """
        df = self.load_clone_pairs()

        if clone_type is not None:
            df = df[df["cloneType"] == clone_type]

        return df

    def get_clone_type_distribution(self) -> Dict[int, int]:
        """
        Get distribution of clone types in the dataset.

        Returns:
            Dictionary mapping clone type to count
        """
        df = self.load_clone_pairs()
        return df["cloneType"].value_counts().to_dict()

    def sample_clone_pairs(
        self,
        sample_size: int = 10000,
        stratify_by_type: bool = True,
        random_state: int = 42,
    ) -> "pd.DataFrame":
        """
        Sample clone pairs from the dataset.

        Args:
            sample_size: Number of pairs to sample
            stratify_by_type: Whether to stratify by clone type
            random_state: Random seed for reproducibility

        Returns:
            DataFrame with sampled clone pairs
        """
        df = self.load_clone_pairs()

        if stratify_by_type:
            # Stratified sampling
            df = df.groupby("cloneType", group_keys=False).apply(
                lambda x: x.sample(
                    n=max(1, sample_size // len(x.groupby("cloneType"))),
                    random_state=random_state,
                )
            )
            df = df.sample(n=min(sample_size, len(df)), random_state=random_state)
        else:
            df = df.sample(n=sample_size, random_state=random_state)

        return df

    def generate_negative_samples(
        self,
        positive_pairs: "pd.DataFrame",
        n_samples: int,
        all_fragment_ids: Optional[List[str]] = None,
        random_state: int = 42,
    ) -> "pd.DataFrame":
        """
        Generate negative (non-clone) samples for training.

        Args:
            positive_pairs: DataFrame with positive (clone) pairs
            n_samples: Number of negative samples to generate
            all_fragment_ids: List of all fragment IDs (optional)
            random_state: Random seed

        Returns:
            DataFrame with negative pairs
        """
        np.random.seed(random_state)

        # Get unique fragment IDs from positive pairs
        if all_fragment_ids is None:
            all_ids = set(positive_pairs["clone1Id"].unique()) | set(
                positive_pairs["clone2Id"].unique()
            )
            all_fragment_ids = list(all_ids)

        # Generate random pairs
        negative_pairs = []
        existing_pairs = set(
            zip(positive_pairs["clone1Id"], positive_pairs["clone2Id"])
        )

        attempts = 0
        max_attempts = n_samples * 10

        while len(negative_pairs) < n_samples and attempts < max_attempts:
            id1 = np.random.choice(all_fragment_ids)
            id2 = np.random.choice(all_fragment_ids)

            if id1 != id2 and (id1, id2) not in existing_pairs:
                negative_pairs.append((id1, id2))
                existing_pairs.add((id1, id2))

            attempts += 1

        # Create DataFrame
        negative_df = pd.DataFrame(
            {
                "clone1Id": [p[0] for p in negative_pairs],
                "clone2Id": [p[1] for p in negative_pairs],
                "cloneType": 0,  # Mark as non-clone
            }
        )

        return negative_df

    def create_balanced_dataset(
        self,
        positive_sample_size: int = 5000,
        negative_sample_size: int = 5000,
        random_state: int = 42,
    ) -> Tuple["pd.DataFrame", "pd.DataFrame"]:
        """
        Create a balanced dataset with equal positive and negative samples.

        Args:
            positive_sample_size: Number of positive (clone) samples
            negative_sample_size: Number of negative (non-clone) samples
            random_state: Random seed

        Returns:
            Tuple of (positive_pairs, negative_pairs) DataFrames
        """
        # Sample positive pairs
        positive_pairs = self.sample_clone_pairs(
            sample_size=positive_sample_size,
            stratify_by_type=True,
            random_state=random_state,
        )

        # Generate negative pairs
        negative_pairs = self.generate_negative_samples(
            positive_pairs, negative_sample_size, random_state=random_state
        )

        return positive_pairs, negative_pairs

    def export_training_data(
        self,
        output_dir: str,
        positive_sample_size: int = 5000,
        negative_sample_size: int = 5000,
    ):
        """
        Export training data to CSV files.

        Args:
            output_dir: Output directory
            positive_sample_size: Number of positive samples
            negative_sample_size: Number of negative samples
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        positive_pairs, negative_pairs = self.create_balanced_dataset(
            positive_sample_size, negative_sample_size
        )

        # Save to CSV
        positive_pairs.to_csv(output_path / "positive_pairs.csv", index=False)
        negative_pairs.to_csv(output_path / "negative_pairs.csv", index=False)

        print(f"Exported {len(positive_pairs)} positive pairs")
        print(f"Exported {len(negative_pairs)} negative pairs")
