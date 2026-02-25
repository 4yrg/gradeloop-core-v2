"""
Noise Removal: Strip comments and normalize whitespace using Tree-sitter CST nodes.

This module provides CST-based noise removal for code fragments, preserving
structural integrity while removing non-essential elements like comments.
"""

from typing import List

try:
    from tree_sitter import Node
except ImportError:
    Node = object  # type: ignore


class NoiseRemover:
    """
    Remove noise from code fragments using CST-based filtering.
    Operates on Tree-sitter CST nodes to preserve structural integrity.

    Example:
        >>> remover = NoiseRemover("python")
        >>> tokens = remover.remove_noise(node, source_code_bytes)
    """

    # Language-specific comment node types
    COMMENT_NODE_TYPES = {
        "python": ["comment"],
        "java": ["line_comment", "block_comment"],
        "c": ["comment"],
    }

    # Whitespace normalization
    WHITESPACE_NORMALIZER = " "

    def __init__(self, language: str):
        """
        Initialize the NoiseRemover.

        Args:
            language: Programming language (python, java, c)
        """
        self.language = language
        self.comment_types = set(self.COMMENT_NODE_TYPES.get(language, ["comment"]))

    def remove_noise(self, node: "Node", source_code: bytes) -> str:
        """
        Remove comments and normalize whitespace from a CST node.

        Args:
            node: Tree-sitter CST node
            source_code: Original source code as bytes

        Returns:
            Normalized code string with noise removed
        """
        tokens = self._extract_tokens(node, source_code)
        return self.WHITESPACE_NORMALIZER.join(tokens)

    def _extract_tokens(self, node: "Node", source_code: bytes) -> List[str]:
        """
        Recursively extract tokens from CST, excluding comments.

        Args:
            node: Current CST node
            source_code: Original source code

        Returns:
            List of token strings
        """
        tokens = []

        # Skip comment nodes
        if node.type in self.comment_types:
            return tokens

        # Leaf node (terminal)
        if node.child_count == 0:
            token = node.text.decode("utf-8", errors="ignore").strip()
            if token and not token.isspace():
                tokens.append(token)
        else:
            # Internal node: recurse into children
            for child in node.children:
                tokens.extend(self._extract_tokens(child, source_code))

        return tokens

    def strip_comments_only(self, node: "Node", source_code: bytes) -> str:
        """
        Strip only comments, preserving original whitespace.

        Args:
            node: CST node
            source_code: Source code bytes

        Returns:
            Code string with comments removed
        """
        result = []
        self._extract_with_whitespace(node, source_code, result)
        return "".join(result)

    def _extract_with_whitespace(
        self, node: "Node", source_code: bytes, result: List[str]
    ):
        """Extract tokens preserving original whitespace."""
        if node.type in self.comment_types:
            return

        if node.child_count == 0:
            text = node.text.decode("utf-8", errors="ignore")
            result.append(text)
        else:
            for child in node.children:
                self._extract_with_whitespace(child, source_code, result)
