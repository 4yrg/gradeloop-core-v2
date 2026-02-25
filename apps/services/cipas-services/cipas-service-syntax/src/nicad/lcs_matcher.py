"""
LCS Matcher: Line-based Longest Common Subsequence for UPI calculation.

This module provides LCS-based similarity calculation for Type-2 clone detection
using the Unpreprocessed Identity (UPI) metric.
"""

from typing import List, Tuple


class LCSMatcher:
    """
    Calculate Unpreprocessed Identity (UPI) using line-based LCS algorithm.
    Optimized for speed using space-efficient dynamic programming.

    Example:
        >>> matcher = LCSMatcher(similarity_threshold=0.85)
        >>> similarity, lcs_length = matcher.compute_upi(code_a, code_b)
        >>> is_clone = matcher.is_clone(similarity)
    """

    def __init__(self, similarity_threshold: float = 0.85):
        """
        Initialize the LCSMatcher.

        Args:
            similarity_threshold: Minimum similarity score to consider as clone (0.0-1.0)
        """
        self.similarity_threshold = similarity_threshold

    def compute_upi(self, code_a: str, code_b: str) -> Tuple[float, int]:
        """
        Compute Unpreprocessed Identity (UPI) between two code fragments.

        Args:
            code_a: First normalized code string
            code_b: Second normalized code string

        Returns:
            Tuple of (similarity_score, lcs_length)
        """
        lines_a = code_a.strip().split("\n")
        lines_b = code_b.strip().split("\n")

        lcs_length = self._lcs_length(lines_a, lines_b)
        max_lines = max(len(lines_a), len(lines_b))

        if max_lines == 0:
            return 0.0, 0

        similarity = lcs_length / max_lines
        return similarity, lcs_length

    def _lcs_length(self, seq_a: List[str], seq_b: List[str]) -> int:
        """
        Compute LCS length using space-efficient DP (two-row variant).

        Time Complexity: O(m * n) where m, n are sequence lengths
        Space Complexity: O(min(m, n))

        Args:
            seq_a: First sequence (lines)
            seq_b: Second sequence (lines)

        Returns:
            LCS length
        """
        m, n = len(seq_a), len(seq_b)

        # Ensure n is the smaller dimension for space optimization
        if m < n:
            seq_a, seq_b = seq_b, seq_a
            m, n = n, m

        # Two-row DP
        prev = [0] * (n + 1)

        for i in range(1, m + 1):
            curr = [0] * (n + 1)
            for j in range(1, n + 1):
                if seq_a[i - 1] == seq_b[j - 1]:
                    curr[j] = prev[j - 1] + 1
                else:
                    curr[j] = max(curr[j - 1], prev[j])
            prev = curr

        return prev[n]

    def _lcs_with_early_termination(
        self, seq_a: List[str], seq_b: List[str], threshold: float
    ) -> Tuple[int, bool]:
        """
        Compute LCS with early termination if threshold cannot be reached.

        Args:
            seq_a: First sequence
            seq_b: Second sequence
            threshold: Minimum similarity threshold

        Returns:
            Tuple of (lcs_length, can_reach_threshold)
        """
        m, n = len(seq_a), len(seq_b)

        if m < n:
            seq_a, seq_b = seq_b, seq_a
            m, n = n, m

        max_len = max(m, n)
        prev = [0] * (n + 1)

        for i in range(1, m + 1):
            curr = [0] * (n + 1)
            for j in range(1, n + 1):
                if seq_a[i - 1] == seq_b[j - 1]:
                    curr[j] = prev[j - 1] + 1
                else:
                    curr[j] = max(curr[j - 1], prev[j])

            # Early termination check
            current_lcs = max(curr)
            remaining_rows = m - i
            upper_bound = current_lcs + remaining_rows
            sim_upper = upper_bound / max_len

            if sim_upper < threshold:
                return current_lcs, False

            prev = curr

        return prev[n], True

    def is_clone(self, similarity: float) -> bool:
        """
        Check if similarity score meets threshold.

        Args:
            similarity: Similarity score (0.0-1.0)

        Returns:
            True if similarity >= threshold
        """
        return similarity >= self.similarity_threshold

    def compute_similarity_fast(
        self, code_a: str, code_b: str
    ) -> Tuple[float, int, bool]:
        """
        Compute similarity with early termination for efficiency.

        Args:
            code_a: First code string
            code_b: Second code string

        Returns:
            Tuple of (similarity, lcs_length, is_clone)
        """
        lines_a = code_a.strip().split("\n")
        lines_b = code_b.strip().split("\n")

        max_len = max(len(lines_a), len(lines_b))
        if max_len == 0:
            return 0.0, 0, False

        lcs_length, can_reach = self._lcs_with_early_termination(
            lines_a, lines_b, self.similarity_threshold
        )

        similarity = lcs_length / max_len
        is_clone = self.is_clone(similarity)

        return similarity, lcs_length, is_clone
