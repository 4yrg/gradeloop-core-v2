"""
Pretty-Printer: Reconstruct code from CST into canonical "one-statement-per-line" format.

This module provides code reconstruction from tokens into a canonical format
suitable for clone comparison.
"""

from typing import List


class PrettyPrinter:
    """
    Reconstruct code from tokens into canonical format.
    Enforces "one-statement-per-line" formatting for consistent comparison.

    Example:
        >>> printer = PrettyPrinter("java")
        >>> canonical = printer.pretty_print(tokens)
    """

    # Language-specific statement terminators
    STATEMENT_TERMINATORS = {
        "python": ["\n", ":"],  # Python uses newlines and colons
        "java": [";"],
        "c": [";"],
    }

    # Tokens that should start new lines
    LINE_START_TOKENS = {
        "python": [
            "def",
            "class",
            "if",
            "elif",
            "else",
            "for",
            "while",
            "try",
            "except",
            "with",
        ],
        "java": [
            "if",
            "else",
            "for",
            "while",
            "do",
            "try",
            "catch",
            "finally",
            "switch",
            "case",
        ],
        "c": ["if", "else", "for", "while", "do", "switch", "case"],
    }

    def __init__(self, language: str):
        """
        Initialize the PrettyPrinter.

        Args:
            language: Programming language (python, java, c)
        """
        self.language = language
        self.terminators = self.STATEMENT_TERMINATORS.get(language, [";"])
        self.line_starts = self.LINE_START_TOKENS.get(language, [])

    def pretty_print(self, tokens: List[str]) -> str:
        """
        Reconstruct code from tokens into canonical format.

        Args:
            tokens: List of tokens from NoiseRemover

        Returns:
            Canonical code string (one statement per line)
        """
        lines = []
        current_line = []

        for token in tokens:
            # Check if token should start a new line
            if token in self.line_starts and current_line:
                lines.append(" ".join(current_line))
                current_line = [token]
            # Check if token ends a statement
            elif token in self.terminators:
                current_line.append(token)
                lines.append(" ".join(current_line))
                current_line = []
            else:
                current_line.append(token)

        # Add remaining tokens as final line
        if current_line:
            lines.append(" ".join(current_line))

        return "\n".join(lines)

    def pretty_print_minimal(self, tokens: List[str]) -> str:
        """
        Minimal pretty-print: just join tokens with spaces.

        Args:
            tokens: List of tokens

        Returns:
            Space-separated token string
        """
        return " ".join(tokens)
