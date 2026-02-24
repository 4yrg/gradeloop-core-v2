"""
CST-based comment and docstring stripper for CIPAS normalisation (E10/US02).

This module removes comments and docstrings from source code by walking the
tree-sitter Concrete Syntax Tree (CST).  It does NOT use regular expressions
for structural removal — the CST provides exact byte ranges for comment and
docstring nodes, which are excised directly from the source byte array.

Why CST instead of regex
─────────────────────────
Regex-based comment removal is unreliable for:
  - Multi-line block comments containing regex-confusing characters.
  - Comment-like sequences inside string literals  (e.g. "http://example.com").
  - Python docstrings — which are valid expression statements, not syntactic
    comment tokens, so there is no regex pattern that reliably identifies them
    without parsing context.
  - Nested comment markers in some languages.
The CST gives us precise node types and byte ranges; no heuristics required.

Stripping rules by language
────────────────────────────
Python
  - node type "comment"             → single-line comments  (# …)
  - expression_statement whose sole named child is a "string" node AND which
    is the first statement in a function/class/module body  → docstring.
    Detection: the expression_statement's parent is a "block" node (function
    or class body) or "module" node, AND it is the first named child of that
    parent that is an expression_statement.

Java
  - node type "line_comment"        → // …
  - node type "block_comment"       → /* … */ and /** … */ (Javadoc)

C
  - node type "comment"             → both // … and /* … */ (tree-sitter C
    grammar unifies both under the same "comment" node type)

Byte-range removal strategy
────────────────────────────
After collecting the set of (start_byte, end_byte) spans to remove:
  1. Sort spans by start_byte ascending.
  2. Merge overlapping or adjacent spans (defensive — should not overlap in a
     well-formed CST, but guards against malformed inputs).
  3. Reconstruct the byte buffer by concatenating non-removed segments.
  4. Decode the resulting bytes to UTF-8 (errors="replace").
  5. Collapse sequences of blank lines / leading-trailing whitespace.

The stripped text (not bytes) is the return value, because the downstream
PrettyPrinter operates on strings.  If the caller needs bytes, encode with
.encode("utf-8").

Immutability / determinism
──────────────────────────
CSTStripper is stateless after __init__ (which pre-loads parsers once per
process).  Given the same source_bytes and language, strip() always returns
the same string.  No randomness, no datetime, no process-specific state.

Thread safety
─────────────
tree-sitter Parser objects are NOT thread-safe.  CSTStripper holds one Parser
per language.  In the async pipeline, stripping is dispatched to a
ProcessPoolExecutor where each worker process has its own CSTStripper instance.
Never share a CSTStripper instance across threads.
"""

from __future__ import annotations

import re
import sys
from typing import Any

# ---------------------------------------------------------------------------
# Comment/docstring node types per language
# ---------------------------------------------------------------------------

# Mapping: language_key → frozenset of tree-sitter node types to strip.
# For Python, docstrings require special detection logic (see _is_docstring());
# they are NOT in this set.  "comment" nodes (# …) are in this set.
_COMMENT_NODE_TYPES: dict[str, frozenset[str]] = {
    "python": frozenset({"comment"}),
    "java": frozenset({"line_comment", "block_comment"}),
    "c": frozenset({"comment"}),
}

# Regex: collapse runs of blank lines to a single blank line, and trim.
# Used to clean up the gap left after removing multi-line block comments.
_BLANK_LINES_RE: re.Pattern[str] = re.compile(r"\n{3,}")
_TRAILING_WHITESPACE_PER_LINE_RE: re.Pattern[str] = re.compile(r"[ \t]+$", re.MULTILINE)


# ---------------------------------------------------------------------------
# CSTStripper
# ---------------------------------------------------------------------------


class CSTStripper:
    """
    Strips comments and docstrings from source code using tree-sitter CST nodes.

    One instance is created per worker process and reused across all granules
    (parsers are expensive to initialise; reuse amortises the cost).

    Usage:
        stripper = CSTStripper()
        stripped_text = stripper.strip(source_bytes, "python")

    The returned string is suitable for passing directly to PrettyPrinter.
    """

    def __init__(self) -> None:
        """
        Initialise tree-sitter parsers for all supported languages.

        Defers tree-sitter imports to __init__ so this module is importable
        in environments where tree-sitter is not installed (e.g. static type
        checkers, documentation builders).

        Raises:
            ImportError: If tree-sitter-languages is not installed.
        """
        try:
            from tree_sitter_languages import (  # type: ignore[import]
                get_language,
                get_parser,
            )
        except ImportError as exc:
            raise ImportError(
                "tree-sitter and tree-sitter-languages must be installed. "
                "Run: poetry install"
            ) from exc

        # One Parser per language — each holds a C-level parser state that
        # is NOT thread-safe.  Safe to reuse sequentially within one process.
        self._parsers: dict[str, Any] = {
            lang: get_parser(lang) for lang in ("python", "java", "c")
        }
        self._languages: dict[str, Any] = {
            lang: get_language(lang) for lang in ("python", "java", "c")
        }

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def strip(self, source_bytes: bytes, language: str) -> str:
        """
        Strip comments (and Python docstrings) from source_bytes using the CST.

        Args:
            source_bytes: Raw UTF-8 source bytes of the granule.
            language:     One of "python", "java", "c".

        Returns:
            Stripped source text with comment/docstring byte ranges removed,
            excess blank lines collapsed, and trailing per-line whitespace
            trimmed.  Never raises on syntax errors in source_bytes — partial
            CSTs are handled gracefully (tree-sitter always returns a tree).

        Raises:
            ValueError: If language is not supported.
            ImportError: If tree-sitter is not installed (raised in __init__,
                         not here — this method assumes __init__ succeeded).
        """
        if language not in _COMMENT_NODE_TYPES:
            raise ValueError(
                f"CSTStripper does not support language {language!r}. "
                f"Supported: {sorted(_COMMENT_NODE_TYPES)}"
            )

        if not source_bytes:
            return ""

        # Parse with the language-appropriate parser.
        tree: Any = self._parsers[language].parse(source_bytes)
        root: Any = tree.root_node

        # Collect byte spans to remove.
        spans_to_remove: list[tuple[int, int]] = self._collect_spans(
            root=root,
            source_bytes=source_bytes,
            language=language,
        )

        if not spans_to_remove:
            # Fast path: no comments/docstrings found.
            return self._post_process(source_bytes.decode("utf-8", errors="replace"))

        # Merge overlapping/adjacent spans (ascending order).
        merged: list[tuple[int, int]] = _merge_spans(
            sorted(spans_to_remove, key=lambda s: s[0])
        )

        # Excise the merged spans from the byte buffer.
        stripped_bytes: bytes = _excise_spans(source_bytes, merged)

        # Decode and post-process whitespace.
        decoded = stripped_bytes.decode("utf-8", errors="replace")
        return self._post_process(decoded)

    # ------------------------------------------------------------------
    # Span collection
    # ------------------------------------------------------------------

    def _collect_spans(
        self,
        root: Any,
        source_bytes: bytes,
        language: str,
    ) -> list[tuple[int, int]]:
        """
        Walk the CST and collect (start_byte, end_byte) pairs to remove.

        Uses an iterative DFS stack to avoid Python recursion limits on
        deeply nested trees (e.g. a function with 500 nested if/else blocks).

        For Python, also calls _collect_python_docstring_spans() in a second
        pass to detect docstring nodes (which require parent-context awareness).

        Args:
            root:         The tree-sitter root node of the parsed source.
            source_bytes: The original source bytes (used for docstring detection).
            language:     Source language key.

        Returns:
            List of (start_byte, end_byte) pairs — may contain duplicates or
            overlaps; callers must merge before excision.
        """
        comment_types = _COMMENT_NODE_TYPES[language]
        spans: list[tuple[int, int]] = []

        # Iterative DFS (pre-order): avoids Python recursion limit.
        stack: list[Any] = [root]
        while stack:
            node: Any = stack.pop()

            if node.type in comment_types:
                # Found a comment node — record its byte range.
                # Extend to include the preceding whitespace/newline on the same
                # line so the removed comment does not leave a dangling blank line.
                # We include one trailing newline if the comment ends before one.
                start, end = _comment_span_with_newline(node, source_bytes)
                spans.append((start, end))
                # Do NOT push children — comment nodes have no meaningful children.
                continue

            # Push all children in reverse order so leftmost is processed first.
            for child in reversed(node.children):
                stack.append(child)

        # Python-specific: collect docstring spans in a second pass.
        if language == "python":
            docstring_spans = self._collect_python_docstring_spans(root, source_bytes)
            spans.extend(docstring_spans)

        return spans

    def _collect_python_docstring_spans(
        self,
        root: Any,
        source_bytes: bytes,
    ) -> list[tuple[int, int]]:
        """
        Detect and collect Python docstring byte spans.

        A Python docstring is an expression_statement whose sole named child
        is a string node, AND which appears as the FIRST named statement in:
          - a function_definition body (block)
          - a class_definition body (block)
          - the module root node

        The detection algorithm:
          1. Find all function_definition, class_definition, and module nodes.
          2. For each, locate their body (block child for functions/classes,
             or the module root itself).
          3. Check if the FIRST non-comment named child of the body is an
             expression_statement containing only a string node.
          4. If so, record its byte span.

        We use a DFS that visits all nodes (not just the root's children) so
        that nested function/class docstrings are also collected.

        Args:
            root:         tree-sitter root node (module).
            source_bytes: Original source bytes.

        Returns:
            List of (start_byte, end_byte) pairs for docstring nodes.
        """
        docstring_spans: list[tuple[int, int]] = []

        # Node types whose first string expression_statement is a docstring.
        _BODY_PARENTS: frozenset[str] = frozenset(
            {"function_definition", "class_definition", "decorated_definition"}
        )

        def _get_first_docstring_node(body_node: Any) -> Any | None:
            """
            Return the first expression_statement child that is a pure string,
            or None if no docstring is present.

            Skips leading comment nodes (which were collected separately) to
            correctly handle:
                def foo():
                    # Leading comment
                    \"\"\"Docstring.\"\"\"
            """
            for child in body_node.children:
                if not child.is_named:
                    continue
                if child.type == "comment":
                    # Leading comment — skip to check next statement.
                    continue
                if child.type == "expression_statement":
                    # Check if the sole named child is a string node.
                    named_children = [c for c in child.children if c.is_named]
                    if len(named_children) == 1 and named_children[0].type == "string":
                        return child
                # First non-comment named child is NOT an expression_statement
                # with a string — no docstring.
                return None
            return None

        # Iterative DFS to visit every node in the tree.
        stack: list[Any] = [root]
        while stack:
            node: Any = stack.pop()

            if node.type == "module":
                # Module-level docstring: first expression_statement with string.
                ds = _get_first_docstring_node(node)
                if ds is not None:
                    start, end = _comment_span_with_newline(ds, source_bytes)
                    docstring_spans.append((start, end))

            elif node.type in _BODY_PARENTS:
                # For function/class definitions, find the body (block) child.
                body: Any | None = None
                for child in node.children:
                    if child.type == "block":
                        body = child
                        break
                if body is not None:
                    ds = _get_first_docstring_node(body)
                    if ds is not None:
                        start, end = _comment_span_with_newline(ds, source_bytes)
                        docstring_spans.append((start, end))

            # Continue DFS into all children.
            for child in reversed(node.children):
                stack.append(child)

        return docstring_spans

    # ------------------------------------------------------------------
    # Post-processing
    # ------------------------------------------------------------------

    @staticmethod
    def _post_process(text: str) -> str:
        """
        Collapse excess whitespace left by span removal.

        Steps:
          1. Remove trailing whitespace from every line (tabs/spaces at EOL).
          2. Collapse 3+ consecutive newlines to 2 (preserves paragraph breaks).
          3. Strip leading and trailing whitespace from the full text.

        Args:
            text: Decoded text after byte-span excision.

        Returns:
            Clean text ready for the pretty-printer or direct use.
        """
        # Step 1: strip trailing whitespace per line.
        result = _TRAILING_WHITESPACE_PER_LINE_RE.sub("", text)
        # Step 2: collapse runs of 3+ blank lines to 2.
        result = _BLANK_LINES_RE.sub("\n\n", result)
        # Step 3: strip outer whitespace.
        return result.strip()


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


def _comment_span_with_newline(
    node: Any,
    source_bytes: bytes,
) -> tuple[int, int]:
    """
    Return the byte span for a comment/docstring node, extended to consume
    the surrounding newline so that removal does not leave a blank line.

    Strategy:
      - If the byte immediately preceding start_byte is a newline (\\n), include
        it in the span by shifting start_byte back by 1.  This handles:
            code()\\n# comment\\n → code()\\n
        becoming code()\\n after the comment and its preceding \\n are removed,
        which the post-processor then collapses cleanly.
      - Do NOT extend end_byte past end_byte because the tree-sitter node already
        includes everything up to (but not including) the next newline for single-
        line comment types, or the closing */ for block comments.

    For docstring expression_statement nodes, the node span covers the entire
    string token including quotes and possible triple-quote newlines.  We extend
    end_byte by 1 if the byte at end_byte is a newline, consuming it.

    Args:
        node:         tree-sitter Node (comment or expression_statement).
        source_bytes: Original source bytes.

    Returns:
        (start_byte, end_byte) pair, adjusted for newline consumption.
    """
    start: int = node.start_byte
    end: int = node.end_byte

    # Extend start backward to consume a preceding newline (if any).
    if start > 0 and source_bytes[start - 1] == ord("\n"):
        start -= 1

    # Extend end forward to consume a trailing newline (if any).
    if end < len(source_bytes) and source_bytes[end] == ord("\n"):
        end += 1

    return (start, end)


def _merge_spans(
    sorted_spans: list[tuple[int, int]],
) -> list[tuple[int, int]]:
    """
    Merge a sorted list of (start, end) byte spans into non-overlapping intervals.

    Assumes spans are sorted by start_byte ascending (callers must sort first).
    Adjacent spans (where end_a == start_b) are merged into a single span to
    prevent an empty zero-byte segment in the reconstruction pass.

    Args:
        sorted_spans: List of (start_byte, end_byte) pairs, sorted by start.

    Returns:
        New list of merged, non-overlapping (start_byte, end_byte) pairs.
    """
    if not sorted_spans:
        return []

    merged: list[tuple[int, int]] = [sorted_spans[0]]
    for start, end in sorted_spans[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            # Overlapping or adjacent — extend the current merged span.
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))

    return merged


def _excise_spans(
    source_bytes: bytes,
    merged_spans: list[tuple[int, int]],
) -> bytes:
    """
    Reconstruct source bytes with the given spans removed.

    Builds the result by concatenating the byte segments that lie BETWEEN the
    removed spans.  The removed byte ranges are simply dropped (not replaced
    with spaces), letting the post-processor collapse any resulting whitespace.

    Args:
        source_bytes:  Original source bytes.
        merged_spans:  Non-overlapping (start, end) pairs sorted by start,
                       as returned by _merge_spans().

    Returns:
        New bytes object with the specified ranges excised.
    """
    segments: list[bytes] = []
    cursor: int = 0
    for start, end in merged_spans:
        if start > cursor:
            segments.append(source_bytes[cursor:start])
        cursor = end

    # Append the tail after the last removed span.
    if cursor < len(source_bytes):
        segments.append(source_bytes[cursor:])

    return b"".join(segments)


# ---------------------------------------------------------------------------
# Module-level convenience function (subprocess-worker entry point)
# ---------------------------------------------------------------------------


def strip_comments(source_bytes: bytes, language: str) -> str:
    """
    Module-level function: strip comments from source_bytes for the given language.

    This is the entry point called by ProcessPoolExecutor worker functions.
    It lazily initialises a process-global CSTStripper instance so that parser
    objects are created once per worker process, not once per granule.

    Args:
        source_bytes: Raw UTF-8 source bytes.
        language:     One of "python", "java", "c".

    Returns:
        Stripped source text.

    Note:
        Lazy initialisation is intentional: the worker process should not import
        tree-sitter at module load time (before _worker_init() is called) because
        that would double the initialisation cost.  The first call to this function
        from within the worker process triggers initialisation.
    """
    global _PROCESS_STRIPPER  # noqa: PLW0603

    if _PROCESS_STRIPPER is None:
        _PROCESS_STRIPPER = CSTStripper()

    return _PROCESS_STRIPPER.strip(source_bytes, language)


# Process-global singleton — initialised lazily on first call within the worker.
_PROCESS_STRIPPER: CSTStripper | None = None


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "CSTStripper",
    "strip_comments",
    "_merge_spans",
    "_excise_spans",
    "_comment_span_with_newline",
]
