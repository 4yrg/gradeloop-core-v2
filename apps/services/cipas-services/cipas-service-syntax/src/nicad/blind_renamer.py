"""
Blind Renaming: Replace identifiers and literals with generic markers.

This module provides identifier and literal renaming to ignore naming variations
in Type-2 clone detection.
"""

from typing import Dict, List

try:
    from tree_sitter import Node
except ImportError:
    Node = object  # type: ignore


class BlindRenamer:
    """
    Replace identifiers (variables, functions) and literals (numbers, strings)
    with generic markers to ignore naming variations.

    Example:
        >>> renamer = BlindRenamer("python")
        >>> renamed = renamer.blind_rename(node, source_code)
        # "def calculate_sum(a, b): return a + b"
        # becomes: "def var1 ( var2 , var3 ) : return var2 + var3"
    """

    # Language-specific identifier and literal node types
    NODE_TYPE_MAPPING = {
        "python": {
            "identifiers": ["identifier"],
            "literals": ["string", "integer", "float"],
        },
        "java": {
            "identifiers": ["identifier"],
            "literals": [
                "string_literal",
                "decimal_integer_literal",
                "decimal_floating_point_literal",
                "character_literal",
            ],
        },
        "c": {
            "identifiers": ["identifier"],
            "literals": ["string_literal", "number_literal", "char_literal"],
        },
    }

    # Keywords to preserve (not rename)
    KEYWORDS = {
        "python": {
            "def",
            "class",
            "if",
            "elif",
            "else",
            "for",
            "while",
            "try",
            "except",
            "finally",
            "with",
            "as",
            "import",
            "from",
            "return",
            "yield",
            "raise",
            "pass",
            "break",
            "continue",
            "and",
            "or",
            "not",
            "in",
            "is",
            "lambda",
            "True",
            "False",
            "None",
        },
        "java": {
            "public",
            "private",
            "protected",
            "static",
            "final",
            "class",
            "interface",
            "extends",
            "implements",
            "if",
            "else",
            "for",
            "while",
            "do",
            "switch",
            "case",
            "break",
            "continue",
            "return",
            "void",
            "int",
            "long",
            "float",
            "double",
            "boolean",
            "char",
            "byte",
            "short",
            "new",
            "this",
            "super",
            "try",
            "catch",
            "finally",
            "throw",
            "throws",
        },
        "c": {
            "int",
            "float",
            "double",
            "char",
            "void",
            "struct",
            "union",
            "enum",
            "typedef",
            "if",
            "else",
            "for",
            "while",
            "do",
            "switch",
            "case",
            "break",
            "continue",
            "return",
            "goto",
            "sizeof",
            "const",
            "volatile",
            "static",
            "extern",
            "register",
        },
    }

    def __init__(self, language: str):
        """
        Initialize the BlindRenamer.

        Args:
            language: Programming language (python, java, c)
        """
        self.language = language
        config = self.NODE_TYPE_MAPPING.get(language, {})
        self.identifier_types = set(config.get("identifiers", ["identifier"]))
        self.literal_types = set(config.get("literals", []))
        self.keywords = self.KEYWORDS.get(language, set())

        # Renaming counters
        self.identifier_map: Dict[str, str] = {}
        self.literal_map: Dict[str, str] = {}
        self.identifier_counter = 1
        self.literal_counter = 1

    def reset(self):
        """Reset renaming maps for a new comparison."""
        self.identifier_map.clear()
        self.literal_map.clear()
        self.identifier_counter = 1
        self.literal_counter = 1

    def blind_rename(self, node: "Node", source_code: bytes) -> str:
        """
        Apply blind renaming to CST node.

        Args:
            node: Tree-sitter CST node
            source_code: Original source code as bytes

        Returns:
            Renamed code string
        """
        tokens = self._rename_tokens(node, source_code)
        return " ".join(tokens)

    def _rename_tokens(self, node: "Node", source_code: bytes) -> List[str]:
        """Recursively extract and rename tokens."""
        tokens = []

        # Leaf node
        if node.child_count == 0:
            token_text = node.text.decode("utf-8", errors="ignore")

            if node.type in self.identifier_types:
                # Check if it's a keyword (should not be renamed)
                if token_text in self.keywords:
                    if token_text.strip():
                        tokens.append(token_text.strip())
                else:
                    renamed = self._get_or_create_identifier(token_text)
                    tokens.append(renamed)
            elif node.type in self.literal_types:
                renamed = self._get_or_create_literal(token_text)
                tokens.append(renamed)
            else:
                if token_text.strip():
                    tokens.append(token_text.strip())
        else:
            # Internal node: recurse
            for child in node.children:
                tokens.extend(self._rename_tokens(child, source_code))

        return tokens

    def _get_or_create_identifier(self, original: str) -> str:
        """Get existing renamed identifier or create new one."""
        if original not in self.identifier_map:
            self.identifier_map[original] = f"var{self.identifier_counter}"
            self.identifier_counter += 1
        return self.identifier_map[original]

    def _get_or_create_literal(self, original: str) -> str:
        """Get existing renamed literal or create new one."""
        if original not in self.literal_map:
            self.literal_map[original] = f"lit{self.literal_counter}"
            self.literal_counter += 1
        return self.literal_map[original]

    def get_renaming_map(self) -> Dict[str, str]:
        """
        Get the current renaming mapping.

        Returns:
            Dictionary mapping original names to renamed versions
        """
        combined = {}
        combined.update(self.identifier_map)
        combined.update(self.literal_map)
        return combined
