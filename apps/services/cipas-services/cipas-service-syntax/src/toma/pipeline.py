"""
ToMA Pipeline: Orchestrates Type-3 clone detection via IR transformation.

This module provides the complete ToMA pipeline integrating token mapping
and 6D feature extraction for Type-3 (modified) clone detection.
"""

from dataclasses import dataclass
from typing import List, Tuple

try:
    from tree_sitter import Tree
except ImportError:
    Tree = object  # type: ignore

from parser.fragmenter import CodeFragment
from .features import FeatureExtractor
from .mapper import ToMAMapper


@dataclass
class ToMAResult:
    """
    Result of ToMA feature extraction.

    Attributes:
        fragment_a_id: ID of the first fragment
        fragment_b_id: ID of the second fragment
        tokens_a: Token sequence for fragment A
        tokens_b: Token sequence for fragment B
        feature_vector: 6D feature vector (Lev, LevRatio, Jaro, JW, Jaccard, Dice)
        normalized_features: Normalized feature vector (all values 0-1)
    """

    fragment_a_id: str
    fragment_b_id: str
    tokens_a: List[str]
    tokens_b: List[str]
    feature_vector: Tuple[float, float, float, float, float, float]
    normalized_features: List[float]

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "fragment_a_id": self.fragment_a_id,
            "fragment_b_id": self.fragment_b_id,
            "tokens_a": self.tokens_a,
            "tokens_b": self.tokens_b,
            "feature_vector": self.feature_vector,
            "normalized_features": self.normalized_features,
        }


class ToMAPipeline:
    """
    Complete ToMA pipeline for Type-3 clone feature extraction.

    The pipeline performs:
    1. Token mapping (CST nodes → 15-type ToMA schema)
    2. 6D feature extraction (Lev, LevRatio, Jaro, JW, Jaccard, Dice)
    3. Feature normalization

    Example:
        >>> pipeline = ToMAPipeline("java")
        >>> result = pipeline.extract_features(fragment_a, fragment_b, tree_a, tree_b)
        >>> print(result.feature_vector)
        # (45.0, 0.75, 0.82, 0.85, 0.68, 0.81)
    """

    def __init__(self, language: str):
        """
        Initialize the ToMA Pipeline.

        Args:
            language: Programming language (python, java, c)
        """
        self.language = language
        self.mapper = ToMAMapper(language)
        self.extractor = FeatureExtractor()

    def extract_features(
        self,
        fragment_a: CodeFragment,
        fragment_b: CodeFragment,
        tree_a: Tree,
        tree_b: Tree,
    ) -> ToMAResult:
        """
        Extract ToMA features from two code fragments.

        Args:
            fragment_a: First code fragment
            fragment_b: Second code fragment
            tree_a: Parsed Tree for fragment A
            tree_b: Parsed Tree for fragment B

        Returns:
            ToMAResult with token sequences and 6D feature vector
        """
        # Map to token sequences
        tokens_a = self.mapper.map_fragment(
            tree_a.root_node, fragment_a.source_code.encode()
        )
        tokens_b = self.mapper.map_fragment(
            tree_b.root_node, fragment_b.source_code.encode()
        )

        # Extract 6D features
        feature_vector = self.extractor.extract_features(tokens_a, tokens_b)

        # Normalize features
        normalized_features = self.extractor.normalize_features(feature_vector)

        return ToMAResult(
            fragment_a_id=fragment_a.fragment_id,
            fragment_b_id=fragment_b.fragment_id,
            tokens_a=tokens_a,
            tokens_b=tokens_b,
            feature_vector=feature_vector,
            normalized_features=normalized_features,
        )

    def extract_features_batch(
        self,
        fragments: List[CodeFragment],
        trees: List[Tree],
    ) -> List[ToMAResult]:
        """
        Extract features for all fragment pairs.

        Args:
            fragments: List of code fragments
            trees: List of corresponding parsed trees

        Returns:
            List of ToMAResult for all pairs
        """
        results = []
        n = len(fragments)

        for i in range(n):
            for j in range(i + 1, n):
                result = self.extract_features(
                    fragments[i], fragments[j], trees[i], trees[j]
                )
                results.append(result)

        return results

    def get_token_sequences(
        self, fragments: List[CodeFragment], trees: List[Tree]
    ) -> List[List[str]]:
        """
        Get token sequences for all fragments.

        Args:
            fragments: List of code fragments
            trees: List of corresponding parsed trees

        Returns:
            List of token sequences
        """
        return [
            self.mapper.map_fragment(tree.root_node, fragment.source_code.encode())
            for fragment, tree in zip(fragments, trees)
        ]

    def get_feature_matrix(
        self, fragments: List[CodeFragment], trees: List[Tree]
    ) -> List[List[float]]:
        """
        Generate feature matrix for all fragment pairs.

        Args:
            fragments: List of code fragments
            trees: List of corresponding parsed trees

        Returns:
            Feature matrix (N_pairs x 6)
        """
        results = self.extract_features_batch(fragments, trees)
        return [list(r.feature_vector) for r in results]
