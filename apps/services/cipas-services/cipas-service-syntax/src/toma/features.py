"""
6D Feature Extractor: Compute similarity vector for ML classification.

This module provides feature extraction for Type-3 clone detection using
multiple similarity metrics: Levenshtein, Jaro-Winkler, Jaccard, and Dice.
"""

from typing import List, Tuple

try:
    import Levenshtein
except ImportError:
    # Fallback if python-Levenshtein is not installed
    Levenshtein = None  # type: ignore


class FeatureExtractor:
    """
    Extract 6-dimensional feature vector from two token sequences.

    The 6D feature vector consists of:
    1. Lev: Levenshtein distance (raw)
    2. LevRatio: Levenshtein ratio (normalized 0-1)
    3. Jaro: Jaro similarity (0-1)
    4. JW: Jaro-Winkler similarity (0-1)
    5. Jaccard: Jaccard similarity coefficient (0-1)
    6. Dice: Dice coefficient (0-1)

    Example:
        >>> extractor = FeatureExtractor()
        >>> features = extractor.extract_features(tokens_a, tokens_b)
        # (45, 0.75, 0.82, 0.85, 0.68, 0.81)
    """

    def __init__(self):
        """Initialize the FeatureExtractor."""
        if Levenshtein is None:
            raise ImportError(
                "python-Levenshtein is not installed. "
                "Install with: pip install python-Levenshtein"
            )

    def extract_features(
        self, tokens_a: List[str], tokens_b: List[str]
    ) -> Tuple[float, float, float, float, float, float]:
        """
        Extract 6D feature vector from two token sequences.

        Args:
            tokens_a: First token sequence
            tokens_b: Second token sequence

        Returns:
            Tuple of (Lev, LevRatio, Jaro, JW, Jaccard, Dice)
        """
        # Convert to strings for Levenshtein functions
        str_a = " ".join(tokens_a)
        str_b = " ".join(tokens_b)

        # 1. Levenshtein distance (raw edit distance)
        lev = float(Levenshtein.distance(str_a, str_b))

        # 2. Levenshtein ratio (normalized similarity)
        lev_ratio = Levenshtein.ratio(str_a, str_b)

        # 3. Jaro similarity
        jaro = Levenshtein.jaro(str_a, str_b)

        # 4. Jaro-Winkler similarity (favors strings with common prefix)
        jw = Levenshtein.jaro_winkler(str_a, str_b)

        # 5. Jaccard similarity (set-based)
        set_a = set(tokens_a)
        set_b = set(tokens_b)
        intersection = len(set_a & set_b)
        union = len(set_a | set_b)
        jaccard = intersection / union if union > 0 else 0.0

        # 6. Dice coefficient (set-based, favors common elements)
        dice = (
            (2 * intersection) / (len(set_a) + len(set_b))
            if (len(set_a) + len(set_b)) > 0
            else 0.0
        )

        return (lev, lev_ratio, jaro, jw, jaccard, dice)

    def extract_features_dict(self, tokens_a: List[str], tokens_b: List[str]) -> dict:
        """
        Extract features as a dictionary.

        Args:
            tokens_a: First token sequence
            tokens_b: Second token sequence

        Returns:
            Dictionary with named features
        """
        features = self.extract_features(tokens_a, tokens_b)
        return {
            "levenshtein_distance": features[0],
            "levenshtein_ratio": features[1],
            "jaro_similarity": features[2],
            "jaro_winkler_similarity": features[3],
            "jaccard_similarity": features[4],
            "dice_coefficient": features[5],
        }

    def extract_features_batch(
        self, fragment_pairs: List[Tuple[List[str], List[str]]]
    ) -> List[Tuple[float, float, float, float, float, float]]:
        """
        Extract features for multiple fragment pairs.

        Args:
            fragment_pairs: List of (tokens_a, tokens_b) tuples

        Returns:
            List of 6D feature vectors
        """
        return [self.extract_features(a, b) for a, b in fragment_pairs]

    def extract_features_matrix(self, all_tokens: List[List[str]]) -> List[List[float]]:
        """
        Extract pairwise features for all token sequences.

        Args:
            all_tokens: List of token sequences

        Returns:
            Matrix of feature vectors for all pairs
        """
        n = len(all_tokens)
        features = []

        for i in range(n):
            for j in range(i + 1, n):
                feat = self.extract_features(all_tokens[i], all_tokens[j])
                features.append([i, j] + list(feat))

        return features

    @staticmethod
    def normalize_features(features: Tuple[float, ...]) -> List[float]:
        """
        Normalize features to 0-1 range.

        Args:
            features: Raw feature tuple

        Returns:
            Normalized feature list
        """
        # Levenshtein distance needs special handling (unbounded)
        # For normalization, we use 1 / (1 + lev) transformation
        normalized = []

        for i, feat in enumerate(features):
            if i == 0:  # Levenshtein distance
                normalized.append(1.0 / (1.0 + feat))
            else:  # Already in 0-1 range
                normalized.append(float(feat))

        return normalized
