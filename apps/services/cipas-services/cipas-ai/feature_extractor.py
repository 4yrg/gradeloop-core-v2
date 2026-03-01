"""
Feature Extractor for Tier 1 CatBoost Classifier.

Extracts structural AST features from source code using tree-sitter.
Supports Python, Java, and C languages.

Features extracted:
- whitespace_ratio: Ratio of whitespace characters to total characters
- avg_identifier_length: Average length of variable/function names
- ast_density: Number of AST nodes per line of code
- line_count: Total number of lines
- avg_line_length: Average characters per line
- comment_density: Ratio of comment characters to total characters
- max_nesting_depth: Maximum nesting level of control structures
- unique_node_ratio: Ratio of unique node types to total nodes
"""

import logging
from dataclasses import dataclass
from typing import Optional

from tree_sitter import Language, Parser

logger = logging.getLogger(__name__)


@dataclass
class StructuralFeatures:
    """Structural features extracted from source code."""

    whitespace_ratio: float
    avg_identifier_length: float
    ast_density: float
    line_count: int
    avg_line_length: float
    comment_density: float
    max_nesting_depth: int
    unique_node_ratio: float

    def to_dict(self) -> dict:
        """Convert features to dictionary for model input."""
        return {
            "whitespace_ratio": self.whitespace_ratio,
            "avg_identifier_length": self.avg_identifier_length,
            "ast_density": self.ast_density,
            "line_count": self.line_count,
            "avg_line_length": self.avg_line_length,
            "comment_density": self.comment_density,
            "max_nesting_depth": self.max_nesting_depth,
            "unique_node_ratio": self.unique_node_ratio,
        }

    def to_list(self) -> list[float]:
        """Convert features to list for CatBoost model input."""
        return [
            self.whitespace_ratio,
            self.avg_identifier_length,
            self.ast_density,
            float(self.line_count),
            self.avg_line_length,
            self.comment_density,
            float(self.max_nesting_depth),
            self.unique_node_ratio,
        ]


# Tree-sitter language mappings
LANGUAGE_MAP = {
    "python": "python",
    "py": "python",
    "java": "java",
    "c": "c",
    "cpp": "cpp",
    "h": "c",  # Treat C headers as C
}

# Tree-sitter grammar paths (relative to models directory)
GRAMMAR_PATHS = {
    "python": "models/tree-sitter-python.so",
    "java": "models/tree-sitter-java.so",
    "c": "models/tree-sitter-c.so",
    "cpp": "models/tree-sitter-cpp.so",
}

# Node types considered as identifiers
IDENTIFIER_NODE_TYPES = {
    "identifier",
    "simple_name",
    "field_identifier",
    "type_identifier",
}

# Node types considered as comments
COMMENT_NODE_TYPES = {
    "comment",
    "line_comment",
    "block_comment",
    "multiline_comment",
}

# Control structure node types for nesting depth calculation
CONTROL_STRUCTURE_TYPES = {
    "if_statement",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "try_statement",
    "with_statement",
    "match_statement",
    "function_definition",
    "method_definition",
    "class_definition",
}


class FeatureExtractor:
    """
    Extracts structural features from source code using tree-sitter.

    The extractor parses code into an AST and computes various structural
    metrics that help distinguish between human-written and AI-generated code.
    """

    def __init__(self, grammar_path: Optional[str] = None):
        """
        Initialize the feature extractor.

        Args:
            grammar_path: Optional path to tree-sitter grammar directory.
                         Defaults to 'models' directory.
        """
        self.grammar_path = grammar_path or "models"
        self._parsers: dict[str, Parser] = {}
        self._languages: dict[str, Language] = {}

    def _get_language(self, language: str) -> Language:
        """
        Get or load a tree-sitter language.

        Args:
            language: Programming language name.

        Returns:
            Loaded tree-sitter Language object.

        Raises:
            ValueError: If language is not supported.
        """
        if language not in self._languages:
            if language not in GRAMMAR_PATHS:
                raise ValueError(
                    f"Unsupported language: {language}. "
                    f"Supported: {list(GRAMMAR_PATHS.keys())}"
                )

            grammar_file = f"{self.grammar_path}/{GRAMMAR_PATHS[language]}"
            try:
                self._languages[language] = Language(grammar_file)
                logger.debug(f"Loaded tree-sitter language: {language}")
            except Exception as e:
                logger.error(f"Failed to load grammar for {language}: {e}")
                raise

        return self._languages[language]

    def _get_parser(self, language: str) -> Parser:
        """
        Get or create a parser for the specified language.

        Args:
            language: Programming language name.

        Returns:
            Configured tree-sitter Parser object.
        """
        if language not in self._parsers:
            lang = self._get_language(language)
            self._parsers[language] = Parser()
            self._parsers[language].set_language(lang)

        return self._parsers[language]

    def _normalize_language(self, language: str) -> str:
        """
        Normalize language string to internal representation.

        Args:
            language: Language string (e.g., 'Python', 'PY', 'python').

        Returns:
            Normalized language key.
        """
        lang_lower = language.lower().strip()
        return LANGUAGE_MAP.get(lang_lower, lang_lower)

    def _count_identifiers(self, tree, source_code: bytes) -> tuple[int, int]:
        """
        Count identifier nodes and calculate total identifier length.

        Args:
            tree: Parsed tree-sitter tree.
            source_code: Original source code as bytes.

        Returns:
            Tuple of (total_identifiers, total_identifier_length).
        """
        total_identifiers = 0
        total_length = 0

        def traverse(node):
            nonlocal total_identifiers, total_length

            if node.type in IDENTIFIER_NODE_TYPES:
                total_identifiers += 1
                identifier_text = node.text.decode("utf-8", errors="ignore")
                total_length += len(identifier_text)

            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return total_identifiers, total_length

    def _count_comments(self, tree, source_code: bytes) -> int:
        """
        Count comment characters in the source code.

        Args:
            tree: Parsed tree-sitter tree.
            source_code: Original source code as bytes.

        Returns:
            Total number of comment characters.
        """
        comment_chars = 0

        def traverse(node):
            nonlocal comment_chars

            if node.type in COMMENT_NODE_TYPES:
                comment_chars += len(node.text)

            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return comment_chars

    def _calculate_nesting_depth(self, node, current_depth: int = 0) -> int:
        """
        Calculate maximum nesting depth of control structures.

        Args:
            node: Current tree-sitter node.
            current_depth: Current nesting depth.

        Returns:
            Maximum nesting depth found.
        """
        max_depth = current_depth

        if node.type in CONTROL_STRUCTURE_TYPES:
            max_depth = current_depth + 1

        for child in node.children:
            child_depth = self._calculate_nesting_depth(child, max_depth)
            max_depth = max(max_depth, child_depth)

        return max_depth

    def _count_node_types(self, tree) -> tuple[int, set[str]]:
        """
        Count total nodes and unique node types in the AST.

        Args:
            tree: Parsed tree-sitter tree.

        Returns:
            Tuple of (total_nodes, set of unique node types).
        """
        total_nodes = 0
        unique_types: set[str] = set()

        def traverse(node):
            nonlocal total_nodes, unique_types

            total_nodes += 1
            unique_types.add(node.type)

            for child in node.children:
                traverse(child)

        traverse(tree.root_node)
        return total_nodes, unique_types

    def extract(self, code: str, language: str) -> StructuralFeatures:
        """
        Extract structural features from source code.

        Args:
            code: Source code string.
            language: Programming language (python, java, c, cpp).

        Returns:
            StructuralFeatures dataclass with extracted features.

        Raises:
            ValueError: If code is empty or language is unsupported.
            Exception: If parsing fails.
        """
        if not code or not code.strip():
            raise ValueError("Code cannot be empty")

        # Normalize language
        lang = self._normalize_language(language)
        if lang not in GRAMMAR_PATHS:
            raise ValueError(
                f"Unsupported language: {language}. "
                f"Supported: {list(GRAMMAR_PATHS.keys())}"
            )

        # Encode code to bytes
        source_bytes = code.encode("utf-8")

        # Parse with tree-sitter
        parser = self._get_parser(lang)
        tree = parser.parse(source_bytes)

        # Basic statistics
        total_chars = len(code)
        line_count = code.count("\n") + 1
        lines = code.split("\n")

        # Whitespace ratio
        whitespace_count = sum(1 for c in code if c.isspace())
        whitespace_ratio = whitespace_count / total_chars if total_chars > 0 else 0.0

        # Average line length
        avg_line_length = (
            sum(len(line) for line in lines) / line_count if line_count > 0 else 0.0
        )

        # Identifier statistics
        total_identifiers, total_identifier_length = self._count_identifiers(
            tree, source_bytes
        )
        avg_identifier_length = (
            total_identifier_length / total_identifiers
            if total_identifiers > 0
            else 0.0
        )

        # Comment density
        comment_chars = self._count_comments(tree, source_bytes)
        comment_density = comment_chars / total_chars if total_chars > 0 else 0.0

        # AST density (nodes per line)
        total_nodes, unique_types = self._count_node_types(tree)
        ast_density = total_nodes / line_count if line_count > 0 else 0.0

        # Maximum nesting depth
        max_nesting_depth = self._calculate_nesting_depth(tree.root_node)

        # Unique node ratio
        unique_node_ratio = len(unique_types) / total_nodes if total_nodes > 0 else 0.0

        return StructuralFeatures(
            whitespace_ratio=whitespace_ratio,
            avg_identifier_length=avg_identifier_length,
            ast_density=ast_density,
            line_count=line_count,
            avg_line_length=avg_line_length,
            comment_density=comment_density,
            max_nesting_depth=max_nesting_depth,
            unique_node_ratio=unique_node_ratio,
        )


# Global singleton instance
_extractor: Optional[FeatureExtractor] = None


def get_extractor(grammar_path: Optional[str] = None) -> FeatureExtractor:
    """
    Get the singleton FeatureExtractor instance.

    Args:
        grammar_path: Optional path to tree-sitter grammar directory.

    Returns:
        FeatureExtractor instance.
    """
    global _extractor
    if _extractor is None:
        _extractor = FeatureExtractor(grammar_path)
    return _extractor


def extract_features(code: str, language: str) -> StructuralFeatures:
    """
    Convenience function to extract features from code.

    Args:
        code: Source code string.
        language: Programming language.

    Returns:
        StructuralFeatures dataclass.
    """
    extractor = get_extractor()
    return extractor.extract(code, language)
