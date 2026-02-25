"""
Fragmenter: Extract method-level code blocks using Tree-sitter S-expression queries.

This module provides functionality to extract code fragments (functions, methods,
classes) from parsed Concrete Syntax Trees.
"""

from dataclasses import dataclass, field
from typing import List, Optional

try:
    from tree_sitter import Node, Tree
except ImportError:
    Tree = object  # type: ignore
    Node = object  # type: ignore

from .engine import ParserEngine


@dataclass
class CodeFragment:
    """
    Represents an extracted code fragment at method/function level.

    Attributes:
        fragment_id: Unique identifier for the fragment
        source_file: Path to the source file
        language: Programming language (python, java, c)
        start_line: Starting line number (1-indexed)
        end_line: Ending line number (1-indexed)
        start_column: Starting column (0-indexed)
        end_column: Ending column (0-indexed)
        source_code: The actual source code text
        fragment_type: Type of fragment (function, method, constructor, class)
        name: Optional name of the function/method/class
    """

    fragment_id: str
    source_file: str
    language: str
    start_line: int
    end_line: int
    start_column: int
    end_column: int
    source_code: str
    fragment_type: str
    name: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert fragment to dictionary representation."""
        return {
            "fragment_id": self.fragment_id,
            "source_file": self.source_file,
            "language": self.language,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "start_column": self.start_column,
            "end_column": self.end_column,
            "source_code": self.source_code,
            "fragment_type": self.fragment_type,
            "name": self.name,
            "metadata": self.metadata,
        }


class Fragmenter:
    """
    Extract method-level code fragments from parsed CST using S-expression queries.

    Example:
        >>> engine = ParserEngine()
        >>> fragmenter = Fragmenter(engine)
        >>> with open("example.py", "rb") as f:
        ...     fragments = fragmenter.extract_fragments(
        ...         source_code=f.read(),
        ...         language="python",
        ...         source_file="example.py"
        ...     )
    """

    def __init__(self, parser_engine: ParserEngine):
        """
        Initialize the Fragmenter.

        Args:
            parser_engine: ParserEngine instance for grammar access
        """
        self.engine = parser_engine

    def extract_fragments(
        self,
        source_code: bytes,
        language: str,
        source_file: str,
        fragment_types: Optional[List[str]] = None,
    ) -> List[CodeFragment]:
        """
        Extract code fragments from source code.

        Args:
            source_code: Source code as bytes
            language: Language name (python, java, c)
            source_file: Path to source file
            fragment_types: Optional list of fragment types to extract
                         (default: all configured types)

        Returns:
            List of CodeFragment objects

        Raises:
            ValueError: If language is not supported
        """
        tree = self.engine.parse(source_code, language)
        lang_config = self.engine.get_language_config(language)
        queries = lang_config.get("fragment_queries", {})

        if fragment_types is None:
            fragment_types = list(queries.keys())

        fragments = []
        fragment_counter = 0

        for frag_type in fragment_types:
            if frag_type not in queries:
                continue

            query = self.engine.languages[language].query(queries[frag_type])
            captures = query.captures(tree.root_node)

            for node, capture_name in captures:
                fragment = self._create_fragment(
                    node=node,
                    source_code=source_code,
                    language=language,
                    source_file=source_file,
                    fragment_type=frag_type,
                    fragment_counter=fragment_counter,
                )
                if fragment:
                    fragments.append(fragment)
                    fragment_counter += 1

        return fragments

    def _create_fragment(
        self,
        node: "Node",
        source_code: bytes,
        language: str,
        source_file: str,
        fragment_type: str,
        fragment_counter: int,
    ) -> Optional[CodeFragment]:
        """Create a CodeFragment from a Tree-sitter node."""
        start_point = node.start_point
        end_point = node.end_point

        fragment_source = source_code[node.start_byte : node.end_byte].decode(
            "utf-8", errors="ignore"
        )

        # Extract name if available
        name = self._extract_name(node, language)

        # Generate unique fragment ID
        fragment_id = f"{language}_{fragment_type}_{fragment_counter}_{source_file}"

        return CodeFragment(
            fragment_id=fragment_id,
            source_file=source_file,
            language=language,
            start_line=start_point[0] + 1,  # 1-indexed
            end_line=end_point[0] + 1,
            start_column=start_point[1],
            end_column=end_point[1],
            source_code=fragment_source,
            fragment_type=fragment_type,
            name=name,
            metadata={"capture_name": node.type},
        )

    def _extract_name(self, node: "Node", language: str) -> Optional[str]:
        """
        Extract the name of a function/method/class from CST node.

        Args:
            node: Tree-sitter CST node
            language: Programming language

        Returns:
            Name string or None if not found
        """
        # Language-specific name extraction
        name_node_types = {
            "python": ["identifier", "attribute"],
            "java": ["identifier", "string"],
            "c": ["identifier"],
        }

        types_to_check = name_node_types.get(language, ["identifier"])

        # For function/method definitions, look for name in children
        for child in node.children:
            if child.type in types_to_check:
                return child.text.decode("utf-8", errors="ignore")

            # Special handling for Java method declarations
            if language == "java" and child.type == "identifier":
                return child.text.decode("utf-8", errors="ignore")

        return None

    def extract_from_file(
        self, file_path: str, language: Optional[str] = None
    ) -> List[CodeFragment]:
        """
        Extract fragments directly from a source file.

        Args:
            file_path: Path to source file
            language: Optional language override (auto-detected from extension if not provided)

        Returns:
            List of CodeFragment objects

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If language cannot be determined
        """
        from pathlib import Path

        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"Source file not found: {file_path}")

        # Auto-detect language from file extension
        if language is None:
            extension = file_path.suffix.lower()
            lang_mapping = {
                ".py": "python",
                ".java": "java",
                ".c": "c",
                ".h": "c",
            }
            language = lang_mapping.get(extension)

        if language is None:
            raise ValueError(f"Cannot determine language for file: {file_path}")

        with open(file_path, "rb") as f:
            source_code = f.read()

        return self.extract_fragments(
            source_code=source_code, language=language, source_file=str(file_path)
        )
