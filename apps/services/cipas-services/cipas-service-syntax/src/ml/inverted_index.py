"""
Inverted Index: Token → Fragment ID mapping for search space pruning.

This module provides an inverted index for efficient fragment retrieval,
enabling O(1) lookup of fragments containing specific tokens.
"""

from collections import defaultdict
from typing import Dict, List, Set


class InvertedIndex:
    """
    Create and query inverted index for efficient fragment retrieval.

    Keys are unique tokens, values are sets of fragment IDs containing them.
    This enables efficient pruning of the search space before expensive
    similarity computations.

    Example:
        >>> index = InvertedIndex()
        >>> index.add_fragment("frag_1", ["IfType", "CallType", "QlfType"])
        >>> index.add_fragment("frag_2", ["ForType", "CallType", "VarDeclType"])
        >>> candidates = index.get_candidates(["CallType", "QlfType"])
        # {"frag_1"}
    """

    def __init__(self):
        """Initialize the InvertedIndex."""
        self.index: Dict[str, Set[str]] = defaultdict(set)
        self.fragment_tokens: Dict[str, List[str]] = {}

    def add_fragment(self, fragment_id: str, tokens: List[str]):
        """
        Add a fragment to the inverted index.

        Args:
            fragment_id: Unique fragment identifier
            tokens: Token sequence for the fragment
        """
        self.fragment_tokens[fragment_id] = tokens
        for token in set(tokens):  # Use set to avoid duplicate entries
            self.index[token].add(fragment_id)

    def add_fragments(self, fragments: List[tuple]):
        """
        Add multiple fragments to the index.

        Args:
            fragments: List of (fragment_id, tokens) tuples
        """
        for fragment_id, tokens in fragments:
            self.add_fragment(fragment_id, tokens)

    def get_candidates(self, query_tokens: List[str], min_overlap: int = 1) -> Set[str]:
        """
        Find candidate fragments that share tokens with query.

        Args:
            query_tokens: Token sequence to match against
            min_overlap: Minimum number of shared tokens required

        Returns:
            Set of candidate fragment IDs
        """
        token_counts: Dict[str, int] = defaultdict(int)

        for token in query_tokens:
            if token in self.index:
                for fragment_id in self.index[token]:
                    token_counts[fragment_id] += 1

        # Filter by minimum overlap
        candidates = {
            frag_id for frag_id, count in token_counts.items() if count >= min_overlap
        }

        return candidates

    def get_candidates_with_scores(self, query_tokens: List[str]) -> Dict[str, int]:
        """
        Get candidates with their token overlap scores.

        Args:
            query_tokens: Token sequence to match against

        Returns:
            Dictionary mapping fragment ID to overlap count
        """
        token_counts: Dict[str, int] = defaultdict(int)

        for token in query_tokens:
            if token in self.index:
                for fragment_id in self.index[token]:
                    token_counts[fragment_id] += 1

        return dict(token_counts)

    def get_index_stats(self) -> dict:
        """
        Get statistics about the inverted index.

        Returns:
            Dictionary with index statistics
        """
        if not self.index:
            return {
                "total_tokens": 0,
                "total_fragments": 0,
                "avg_posting_length": 0.0,
            }

        total_postings = sum(len(v) for v in self.index.values())

        return {
            "total_tokens": len(self.index),
            "total_fragments": len(self.fragment_tokens),
            "avg_posting_length": total_postings / len(self.index),
            "max_posting_length": max(len(v) for v in self.index.values())
            if self.index
            else 0,
            "min_posting_length": min(len(v) for v in self.index.values())
            if self.index
            else 0,
        }

    def get_token_frequency(self, token: str) -> int:
        """
        Get the number of fragments containing a token.

        Args:
            token: Token to look up

        Returns:
            Number of fragments containing the token
        """
        return len(self.index.get(token, set()))

    def get_fragments_by_token(self, token: str) -> Set[str]:
        """
        Get all fragments containing a specific token.

        Args:
            token: Token to look up

        Returns:
            Set of fragment IDs
        """
        return self.index.get(token, set()).copy()

    def clear(self):
        """Clear the index."""
        self.index.clear()
        self.fragment_tokens.clear()

    def save(self, filepath: str):
        """
        Save index to disk (simple pickle serialization).

        Args:
            filepath: Path to save the index
        """
        import pickle

        with open(filepath, "wb") as f:
            pickle.dump(
                {"index": dict(self.index), "fragment_tokens": self.fragment_tokens}, f
            )

    def load(self, filepath: str):
        """
        Load index from disk.

        Args:
            filepath: Path to load the index from
        """
        import pickle

        with open(filepath, "rb") as f:
            data = pickle.load(f)
            self.index = defaultdict(set, data["index"])
            self.fragment_tokens = data["fragment_tokens"]
