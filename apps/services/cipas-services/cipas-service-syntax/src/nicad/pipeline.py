"""
NiCAD Normalization Pipeline: Orchestrates Type-1 and Type-2 clone detection.

This module provides the complete NiCAD pipeline integrating noise removal,
pretty-printing, blind renaming, and LCS-based similarity calculation.
"""

from dataclasses import dataclass
from typing import Optional

try:
    from tree_sitter import Tree
except ImportError:
    Tree = object  # type: ignore

from ..parser.fragmenter import CodeFragment
from .blind_renamer import BlindRenamer
from .lcs_matcher import LCSMatcher
from .noise_removal import NoiseRemover
from .pretty_printer import PrettyPrinter


@dataclass
class NiCADResult:
    """
    Result of NiCAD clone detection.

    Attributes:
        fragment_a_id: ID of the first fragment
        fragment_b_id: ID of the second fragment
        similarity_score: LCS-based similarity score (0.0-1.0)
        lcs_length: Length of longest common subsequence
        clone_type: Type of clone ('type1', 'type2', 'non-clone')
        is_clone: Whether the fragments are considered clones
        normalized_a: Normalized version of fragment A (optional)
        normalized_b: Normalized version of fragment B (optional)
        renamed_a: Blind-renamed version of fragment A (optional)
        renamed_b: Blind-renamed version of fragment B (optional)
    """

    fragment_a_id: str
    fragment_b_id: str
    similarity_score: float
    lcs_length: int
    clone_type: str  # 'type1', 'type2', 'non-clone'
    is_clone: bool
    normalized_a: Optional[str] = None
    normalized_b: Optional[str] = None
    renamed_a: Optional[str] = None
    renamed_b: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "fragment_a_id": self.fragment_a_id,
            "fragment_b_id": self.fragment_b_id,
            "similarity_score": self.similarity_score,
            "lcs_length": self.lcs_length,
            "clone_type": self.clone_type,
            "is_clone": self.is_clone,
        }


class NiCADPipeline:
    """
    Complete NiCAD normalization pipeline for Type-1 and Type-2 clone detection.

    The pipeline performs:
    1. Noise removal (strip comments, normalize whitespace)
    2. Pretty-printing (canonical format)
    3. Type-1 detection (exact match after normalization)
    4. Blind renaming (for Type-2 detection)
    5. LCS-based similarity calculation (UPI)

    Example:
        >>> pipeline = NiCADPipeline("java", similarity_threshold=0.85)
        >>> result = pipeline.detect_clone(fragment_a, fragment_b, tree_a, tree_b)
        >>> if result.is_clone:
        ...     print(f"Clone detected: {result.clone_type}")
    """

    def __init__(self, language: str, similarity_threshold: float = 0.85):
        """
        Initialize the NiCAD Pipeline.

        Args:
            language: Programming language (python, java, c)
            similarity_threshold: Minimum similarity for Type-2 clones (0.0-1.0)
        """
        self.language = language
        self.noise_remover = NoiseRemover(language)
        self.pretty_printer = PrettyPrinter(language)
        self.blind_renamer = BlindRenamer(language)
        self.lcs_matcher = LCSMatcher(similarity_threshold)

    def detect_clone(
        self,
        fragment_a: CodeFragment,
        fragment_b: CodeFragment,
        tree_a: Tree,
        tree_b: Tree,
        include_normalized: bool = False,
    ) -> NiCADResult:
        """
        Detect if two fragments are Type-1 or Type-2 clones.

        Args:
            fragment_a: First code fragment
            fragment_b: Second code fragment
            tree_a: Parsed Tree-sitter Tree for fragment A
            tree_b: Parsed Tree-sitter Tree for fragment B
            include_normalized: Whether to include normalized/renamed code in result

        Returns:
            NiCADResult with clone detection outcome
        """
        # Step 1: Noise removal and pretty-printing
        source_a = fragment_a.source_code.encode("utf-8")
        source_b = fragment_b.source_code.encode("utf-8")

        normalized_a = self._normalize(tree_a.root_node, source_a)
        normalized_b = self._normalize(tree_b.root_node, source_b)

        # Step 2: Type-1 check (exact match after normalization)
        if normalized_a == normalized_b:
            return NiCADResult(
                fragment_a_id=fragment_a.fragment_id,
                fragment_b_id=fragment_b.fragment_id,
                similarity_score=1.0,
                lcs_length=len(normalized_a.split("\n")),
                clone_type="type1",
                is_clone=True,
                normalized_a=normalized_a if include_normalized else None,
                normalized_b=normalized_b if include_normalized else None,
            )

        # Step 3: Blind renaming for Type-2 detection
        self.blind_renamer.reset()
        renamed_a = self.blind_renamer.blind_rename(tree_a.root_node, source_a)
        renamed_b = self.blind_renamer.blind_rename(tree_b.root_node, source_b)

        # Step 4: LCS-based similarity (UPI)
        similarity, lcs_length = self.lcs_matcher.compute_upi(renamed_a, renamed_b)
        is_clone = self.lcs_matcher.is_clone(similarity)

        clone_type = "type2" if is_clone else "non-clone"

        return NiCADResult(
            fragment_a_id=fragment_a.fragment_id,
            fragment_b_id=fragment_b.fragment_id,
            similarity_score=similarity,
            lcs_length=lcs_length,
            clone_type=clone_type,
            is_clone=is_clone,
            normalized_a=normalized_a if include_normalized else None,
            normalized_b=normalized_b if include_normalized else None,
            renamed_a=renamed_a if include_normalized else None,
            renamed_b=renamed_b if include_normalized else None,
        )

    def _normalize(self, node, source_code: bytes) -> str:
        """Apply noise removal and pretty-printing."""
        tokens = self.noise_remover.remove_noise(node, source_code)
        return self.pretty_printer.pretty_print(tokens.split())

    def compare_fragments_batch(
        self,
        fragments: list[CodeFragment],
        trees: list[Tree],
        threshold: float = 0.85,
    ) -> list[NiCADResult]:
        """
        Compare all pairs of fragments in batch.

        Args:
            fragments: List of code fragments
            trees: List of corresponding parsed trees
            threshold: Similarity threshold

        Returns:
            List of NiCADResult for all pairs
        """
        results = []
        n = len(fragments)

        for i in range(n):
            for j in range(i + 1, n):
                # Temporarily adjust threshold if needed
                original_threshold = self.lcs_matcher.similarity_threshold
                self.lcs_matcher.similarity_threshold = threshold

                result = self.detect_clone(
                    fragments[i], fragments[j], trees[i], trees[j]
                )
                results.append(result)

                self.lcs_matcher.similarity_threshold = original_threshold

        return results
