"""
CST-based identifier and literal canonicaliser for CIPAS Type-2 normalisation (E10/US02).

This module transforms a stripped Type-1 source text into a Type-2 canonical form by:

  1. Identifier canonicalisation
       Every user-defined identifier is replaced with a stable canonical token:
         - Function/method names       → FUNC_1, FUNC_2, …
         - Formal parameters           → PARAM_1, PARAM_2, …
         - All other variable names    → VAR_1, VAR_2, …
       Language keywords and well-known built-ins are preserved verbatim.
       The mapping is built in DFS pre-order (depth-first, left-to-right), which
       is the natural tree-sitter traversal order, ensuring that a given identifier's
       canonical token is always the same for structurally identical code.

  2. Literal canonicalisation
       Every numeric, string, and character literal is replaced with LIT_<sha1_6hex>
       where sha1_6hex = SHA-1(raw_literal_text)[:6] (lowercase hex).
       The same literal value always maps to the same token; different values map to
       different tokens (collision probability ≈ 1 in 16^6 ≈ 1 in 16 million).

Determinism contract
─────────────────────
  - Identifier mapping uses collections.OrderedDict keyed by original name.
    Iteration order equals insertion order, which equals DFS pre-order encounter
    order.  Python 3.7+ dicts preserve insertion order; OrderedDict makes this
    contract explicit and visible to readers.
  - Canonical indices (FUNC_1, PARAM_2, …) are assigned by incrementing a
    per-category counter each time a NEW name is encountered for that category.
    Re-encountering a known name uses the already-assigned index.
  - Literal hashing uses hashlib.sha1 with the raw UTF-8 bytes of the literal
    text as extracted from the source.  SHA-1 is used (not SHA-256) because:
      (a) collision resistance is not a security requirement here,
      (b) 6 hex characters (24 bits) give sufficient token uniqueness,
      (c) sha1 is slightly faster than sha256.
  - The two-pass algorithm (collect spans → rebuild text) ensures that byte
    offsets from the tree-sitter parse of the Type-1 text are used for all
    substitutions, never the partially-modified text.

Language-specific identifier classification
────────────────────────────────────────────
Python
  function_definition → name child (identifier)            → FUNC_N
  lambda expression  → parameters > identifier             → PARAM_N
  parameters node    → identifier / typed_parameter.name
                     / default_parameter.name               → PARAM_N
  All other identifier nodes (not keywords / built-ins)    → VAR_N

Java
  method_declaration → name child (identifier)             → FUNC_N
  constructor_declaration → name child (identifier)        → FUNC_N
  formal_parameter → name child (identifier)               → PARAM_N
  spread_parameter → name child (identifier)               → PARAM_N
  All other identifier nodes (not keywords / type names)   → VAR_N

C
  function_declarator → declarator (identifier)            → FUNC_N
  pointer_declarator  → function_declarator → identifier   → FUNC_N
  parameter_declaration → declarator chain → identifier    → PARAM_N
  All other identifier nodes (not keywords / type names)   → VAR_N

Thread safety
─────────────
  Canonicalizer is NOT thread-safe.  Each worker process must hold its own
  instance.  The module-level canonicalize() function uses a process-global
  lazy singleton following the same pattern as stripper.py and pretty_printer.py.
"""

from __future__ import annotations

from collections import OrderedDict
from enum import Enum
import hashlib
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Language keywords and built-in identifiers to preserve verbatim
# ---------------------------------------------------------------------------

_PYTHON_KEYWORDS: frozenset[str] = frozenset(
    {
        "False",
        "None",
        "True",
        "and",
        "as",
        "assert",
        "async",
        "await",
        "break",
        "class",
        "continue",
        "def",
        "del",
        "elif",
        "else",
        "except",
        "finally",
        "for",
        "from",
        "global",
        "if",
        "import",
        "in",
        "is",
        "lambda",
        "nonlocal",
        "not",
        "or",
        "pass",
        "raise",
        "return",
        "try",
        "while",
        "with",
        "yield",
    }
)

_PYTHON_BUILTINS: frozenset[str] = frozenset(
    {
        # Built-in functions
        "abs",
        "aiter",
        "all",
        "anext",
        "any",
        "ascii",
        "bin",
        "bool",
        "breakpoint",
        "bytearray",
        "bytes",
        "callable",
        "chr",
        "classmethod",
        "compile",
        "complex",
        "copyright",
        "credits",
        "delattr",
        "dict",
        "dir",
        "divmod",
        "enumerate",
        "eval",
        "exec",
        "exit",
        "filter",
        "float",
        "format",
        "frozenset",
        "getattr",
        "globals",
        "hasattr",
        "hash",
        "help",
        "hex",
        "id",
        "input",
        "int",
        "isinstance",
        "issubclass",
        "iter",
        "len",
        "license",
        "list",
        "locals",
        "map",
        "max",
        "memoryview",
        "min",
        "next",
        "object",
        "oct",
        "open",
        "ord",
        "pow",
        "print",
        "property",
        "quit",
        "range",
        "repr",
        "reversed",
        "round",
        "set",
        "setattr",
        "slice",
        "sorted",
        "staticmethod",
        "str",
        "sum",
        "super",
        "tuple",
        "type",
        "vars",
        "zip",
        # Common exceptions
        "ArithmeticError",
        "AssertionError",
        "AttributeError",
        "BaseException",
        "BlockingIOError",
        "BrokenPipeError",
        "BufferError",
        "BytesWarning",
        "ChildProcessError",
        "ConnectionAbortedError",
        "ConnectionError",
        "ConnectionRefusedError",
        "ConnectionResetError",
        "DeprecationWarning",
        "EOFError",
        "EnvironmentError",
        "Exception",
        "FileExistsError",
        "FileNotFoundError",
        "FloatingPointError",
        "FutureWarning",
        "GeneratorExit",
        "IOError",
        "ImportError",
        "ImportWarning",
        "IndentationError",
        "IndexError",
        "InterruptedError",
        "IsADirectoryError",
        "KeyError",
        "KeyboardInterrupt",
        "LookupError",
        "MemoryError",
        "ModuleNotFoundError",
        "NameError",
        "NotADirectoryError",
        "NotImplemented",
        "NotImplementedError",
        "OSError",
        "OverflowError",
        "PendingDeprecationWarning",
        "PermissionError",
        "ProcessLookupError",
        "RecursionError",
        "ReferenceError",
        "ResourceWarning",
        "RuntimeError",
        "RuntimeWarning",
        "StopAsyncIteration",
        "StopIteration",
        "SyntaxError",
        "SyntaxWarning",
        "SystemError",
        "SystemExit",
        "TabError",
        "TimeoutError",
        "TypeError",
        "UnboundLocalError",
        "UnicodeDecodeError",
        "UnicodeEncodeError",
        "UnicodeError",
        "UnicodeTranslateError",
        "UnicodeWarning",
        "UserWarning",
        "ValueError",
        "Warning",
        "ZeroDivisionError",
        # Common dunder names
        "__init__",
        "__new__",
        "__del__",
        "__repr__",
        "__str__",
        "__bytes__",
        "__format__",
        "__lt__",
        "__le__",
        "__eq__",
        "__ne__",
        "__gt__",
        "__ge__",
        "__hash__",
        "__bool__",
        "__getattr__",
        "__getattribute__",
        "__setattr__",
        "__delattr__",
        "__dir__",
        "__get__",
        "__set__",
        "__delete__",
        "__set_name__",
        "__slots__",
        "__init_subclass__",
        "__class_getitem__",
        "__len__",
        "__length_hint__",
        "__getitem__",
        "__setitem__",
        "__delitem__",
        "__missing__",
        "__iter__",
        "__reversed__",
        "__contains__",
        "__add__",
        "__radd__",
        "__iadd__",
        "__sub__",
        "__rsub__",
        "__isub__",
        "__mul__",
        "__rmul__",
        "__imul__",
        "__matmul__",
        "__rmatmul__",
        "__imatmul__",
        "__truediv__",
        "__rtruediv__",
        "__itruediv__",
        "__floordiv__",
        "__rfloordiv__",
        "__ifloordiv__",
        "__mod__",
        "__rmod__",
        "__imod__",
        "__divmod__",
        "__rdivmod__",
        "__pow__",
        "__rpow__",
        "__ipow__",
        "__lshift__",
        "__rlshift__",
        "__ilshift__",
        "__rshift__",
        "__rrshift__",
        "__irshift__",
        "__and__",
        "__rand__",
        "__iand__",
        "__xor__",
        "__rxor__",
        "__ixor__",
        "__or__",
        "__ror__",
        "__ior__",
        "__neg__",
        "__pos__",
        "__abs__",
        "__invert__",
        "__complex__",
        "__int__",
        "__float__",
        "__index__",
        "__round__",
        "__trunc__",
        "__floor__",
        "__ceil__",
        "__enter__",
        "__exit__",
        "__await__",
        "__aiter__",
        "__anext__",
        "__aenter__",
        "__aexit__",
        "__call__",
        "__doc__",
        "__name__",
        "__qualname__",
        "__module__",
        "__defaults__",
        "__code__",
        "__globals__",
        "__dict__",
        "__closure__",
        "__annotations__",
        "__kwdefaults__",
        "__class__",
        "__bases__",
        "__mro__",
        "__subclasses__",
        "__all__",
        "__file__",
        "__spec__",
        "__loader__",
        "__package__",
        "__builtins__",
        "__cached__",
        "self",
        "cls",
    }
)

_PYTHON_PRESERVE: frozenset[str] = _PYTHON_KEYWORDS | _PYTHON_BUILTINS

_JAVA_KEYWORDS: frozenset[str] = frozenset(
    {
        "abstract",
        "assert",
        "boolean",
        "break",
        "byte",
        "case",
        "catch",
        "char",
        "class",
        "const",
        "continue",
        "default",
        "do",
        "double",
        "else",
        "enum",
        "extends",
        "final",
        "finally",
        "float",
        "for",
        "goto",
        "if",
        "implements",
        "import",
        "instanceof",
        "int",
        "interface",
        "long",
        "native",
        "new",
        "package",
        "private",
        "protected",
        "public",
        "record",
        "return",
        "sealed",
        "short",
        "static",
        "strictfp",
        "super",
        "switch",
        "synchronized",
        "this",
        "throw",
        "throws",
        "transient",
        "try",
        "var",
        "void",
        "volatile",
        "while",
        "yield",
        # Literals
        "true",
        "false",
        "null",
    }
)

_JAVA_COMMON_TYPES: frozenset[str] = frozenset(
    {
        # java.lang (always imported)
        "Object",
        "String",
        "Integer",
        "Long",
        "Double",
        "Float",
        "Boolean",
        "Byte",
        "Short",
        "Character",
        "Number",
        "Math",
        "System",
        "Runtime",
        "Thread",
        "Runnable",
        "Comparable",
        "Iterable",
        "Cloneable",
        "Serializable",
        "StringBuilder",
        "StringBuffer",
        "CharSequence",
        "Throwable",
        "Exception",
        "RuntimeException",
        "Error",
        "ArithmeticException",
        "ArrayIndexOutOfBoundsException",
        "ClassCastException",
        "ClassNotFoundException",
        "CloneNotSupportedException",
        "IllegalAccessException",
        "IllegalArgumentException",
        "IllegalStateException",
        "IllegalThreadStateException",
        "IndexOutOfBoundsException",
        "InstantiationException",
        "InterruptedException",
        "NegativeArraySizeException",
        "NullPointerException",
        "NumberFormatException",
        "SecurityException",
        "StackOverflowError",
        "StringIndexOutOfBoundsException",
        "UnsupportedOperationException",
        # java.util
        "List",
        "ArrayList",
        "LinkedList",
        "Map",
        "HashMap",
        "LinkedHashMap",
        "TreeMap",
        "Set",
        "HashSet",
        "LinkedHashSet",
        "TreeSet",
        "Queue",
        "Deque",
        "ArrayDeque",
        "PriorityQueue",
        "Collections",
        "Arrays",
        "Optional",
        "Stream",
        "Iterator",
        "Comparator",
        # Common annotations
        "Override",
        "Deprecated",
        "SuppressWarnings",
        "FunctionalInterface",
        # Primitives / void (also keywords but included for completeness)
        "void",
        "int",
        "long",
        "double",
        "float",
        "boolean",
        "byte",
        "short",
        "char",
        # Common I/O
        "Scanner",
        "PrintWriter",
        "BufferedReader",
        "PrintStream",
        "InputStream",
        "OutputStream",
        "IOException",
    }
)

_JAVA_PRESERVE: frozenset[str] = _JAVA_KEYWORDS | _JAVA_COMMON_TYPES

_C_KEYWORDS: frozenset[str] = frozenset(
    {
        "auto",
        "break",
        "case",
        "char",
        "const",
        "continue",
        "default",
        "do",
        "double",
        "else",
        "enum",
        "extern",
        "float",
        "for",
        "goto",
        "if",
        "inline",
        "int",
        "long",
        "register",
        "restrict",
        "return",
        "short",
        "signed",
        "sizeof",
        "static",
        "struct",
        "switch",
        "typedef",
        "union",
        "unsigned",
        "void",
        "volatile",
        "while",
        # C11 additions
        "_Alignas",
        "_Alignof",
        "_Atomic",
        "_Bool",
        "_Complex",
        "_Generic",
        "_Imaginary",
        "_Noreturn",
        "_Static_assert",
        "_Thread_local",
        # Common macros / constants
        "NULL",
        "EOF",
        "EXIT_SUCCESS",
        "EXIT_FAILURE",
        "INT_MAX",
        "INT_MIN",
        "LONG_MAX",
        "LONG_MIN",
        "UINT_MAX",
        "SIZE_MAX",
        "PTRDIFF_MAX",
        "true",
        "false",
        "bool",
    }
)

_C_COMMON_TYPES: frozenset[str] = frozenset(
    {
        # Standard typedefs
        "size_t",
        "ssize_t",
        "ptrdiff_t",
        "intptr_t",
        "uintptr_t",
        "int8_t",
        "int16_t",
        "int32_t",
        "int64_t",
        "uint8_t",
        "uint16_t",
        "uint32_t",
        "uint64_t",
        "int_least8_t",
        "int_least16_t",
        "int_least32_t",
        "int_least64_t",
        "uint_least8_t",
        "uint_least16_t",
        "uint_least32_t",
        "uint_least64_t",
        "int_fast8_t",
        "int_fast16_t",
        "int_fast32_t",
        "int_fast64_t",
        "uint_fast8_t",
        "uint_fast16_t",
        "uint_fast32_t",
        "uint_fast64_t",
        "intmax_t",
        "uintmax_t",
        "FILE",
        "time_t",
        "clock_t",
        # Common stdlib functions (treated as preserved so they are not VAR_N)
        "printf",
        "fprintf",
        "sprintf",
        "snprintf",
        "scanf",
        "fscanf",
        "sscanf",
        "malloc",
        "calloc",
        "realloc",
        "free",
        "memcpy",
        "memmove",
        "memset",
        "memcmp",
        "strlen",
        "strcpy",
        "strncpy",
        "strcat",
        "strncat",
        "strcmp",
        "strncmp",
        "strchr",
        "strstr",
        "fopen",
        "fclose",
        "fread",
        "fwrite",
        "fgets",
        "fputs",
        "exit",
        "abort",
        "atoi",
        "atol",
        "atof",
        "strtol",
        "strtod",
        "strtoul",
        "assert",
        "errno",
        "main",
    }
)

_C_PRESERVE: frozenset[str] = _C_KEYWORDS | _C_COMMON_TYPES

# Single dispatch table used by Canonicalizer._should_preserve()
_PRESERVE_SETS: dict[str, frozenset[str]] = {
    "python": _PYTHON_PRESERVE,
    "java": _JAVA_PRESERVE,
    "c": _C_PRESERVE,
}

# ---------------------------------------------------------------------------
# Literal node types per language
# ---------------------------------------------------------------------------

# These node types are treated as literals and replaced with LIT_<sha1_6hex>.
_LITERAL_NODE_TYPES: dict[str, frozenset[str]] = {
    "python": frozenset(
        {
            "integer",
            "float",
            "string",
            "concatenated_string",
            "none",  # literal None — canonicalised consistently
        }
    ),
    "java": frozenset(
        {
            "decimal_integer_literal",
            "hex_integer_literal",
            "octal_integer_literal",
            "binary_integer_literal",
            "decimal_floating_point_literal",
            "hex_floating_point_literal",
            "character_literal",
            "string_literal",
            "text_block",
            "null_literal",
        }
    ),
    "c": frozenset(
        {
            "number_literal",
            "char_literal",
            "string_literal",
            "concatenated_string",
            "system_lib_string",  # <stdio.h>-style string in #include — preserve context
        }
    ),
}

# Identifier node types per language.
# Only named nodes of these types are candidates for canonicalisation.
_IDENTIFIER_NODE_TYPES: dict[str, frozenset[str]] = {
    "python": frozenset({"identifier"}),
    "java": frozenset({"identifier", "type_identifier"}),
    "c": frozenset({"identifier", "type_identifier"}),
}

# ---------------------------------------------------------------------------
# Identifier kind enum
# ---------------------------------------------------------------------------


class IdentifierKind(str, Enum):
    """
    Semantic category of a user-defined identifier.

    Determines the canonical prefix assigned during Type-2 normalisation.
    """

    FUNC = "FUNC"
    PARAM = "PARAM"
    VAR = "VAR"


# ---------------------------------------------------------------------------
# Per-granule canonical mapping
# ---------------------------------------------------------------------------


class CanonicalMapping:
    """
    Holds the ordered identifier → canonical token mapping for one granule.

    Uses separate OrderedDicts per IdentifierKind to maintain independent
    counters and to make the mapping inspectable in tests.

    Literal values use a separate SHA-1-based dict (value → LIT_token) that
    is shared across all occurrences of the same literal.

    Instances are created fresh for every granule and discarded after use.
    They are NOT shared across granules.
    """

    def __init__(self) -> None:
        # Maps original name → canonical token, per kind.
        # OrderedDict ensures deterministic iteration = stable serialisation.
        self._func_map: OrderedDict[str, str] = OrderedDict()
        self._param_map: OrderedDict[str, str] = OrderedDict()
        self._var_map: OrderedDict[str, str] = OrderedDict()

        # Shared across all kinds: tracks which names have been canonicalised
        # globally (a name used first as a function stays FUNC_N everywhere).
        self._global_map: OrderedDict[str, str] = OrderedDict()

        # Literal value → LIT_<sha1_6hex>
        self._literal_map: OrderedDict[str, str] = OrderedDict()

        # Per-kind counters (1-indexed to match the spec: FUNC_1, not FUNC_0).
        self._func_counter: int = 0
        self._param_counter: int = 0
        self._var_counter: int = 0

    def get_or_assign_identifier(
        self,
        name: str,
        kind: IdentifierKind,
    ) -> str:
        """
        Return the canonical token for `name`, assigning one if not yet seen.

        If `name` was previously assigned a token of a *different* kind (e.g.
        a name used as a function and later as a variable), the previously
        assigned token is returned unchanged.  This preserves the
        first-encounter ordering contract.

        Args:
            name: The original identifier text.
            kind: The semantic role of this occurrence.

        Returns:
            Canonical token string, e.g. "FUNC_1", "PARAM_3", "VAR_2".
        """
        # Check global map first — first-encounter wins.
        existing = self._global_map.get(name)
        if existing is not None:
            return existing

        # Assign a new token.
        if kind == IdentifierKind.FUNC:
            self._func_counter += 1
            token = f"FUNC_{self._func_counter}"
            self._func_map[name] = token
        elif kind == IdentifierKind.PARAM:
            self._param_counter += 1
            token = f"PARAM_{self._param_counter}"
            self._param_map[name] = token
        else:  # VAR
            self._var_counter += 1
            token = f"VAR_{self._var_counter}"
            self._var_map[name] = token

        self._global_map[name] = token
        return token

    def get_or_assign_literal(self, raw_text: str) -> str:
        """
        Return the LIT_<sha1_6hex> token for a literal's raw text.

        The same raw literal value always maps to the same token.  Different
        values produce different tokens (with negligible collision probability).

        Args:
            raw_text: The exact source text of the literal node (including
                      quotes for strings, type suffixes for integers, etc.).

        Returns:
            Token string, e.g. "LIT_a3f2c1".
        """
        existing = self._literal_map.get(raw_text)
        if existing is not None:
            return existing

        sha1_hex = hashlib.sha1(
            raw_text.encode("utf-8"),
            usedforsecurity=False,
        ).hexdigest()
        token = f"LIT_{sha1_hex[:6]}"
        self._literal_map[raw_text] = token
        return token

    def snapshot(self) -> dict[str, dict[str, str]]:
        """
        Return a snapshot of the current mapping state (for debugging/testing).

        Returns:
            Dict with keys "functions", "parameters", "variables", "literals",
            each mapping original text → canonical token.
        """
        return {
            "functions": dict(self._func_map),
            "parameters": dict(self._param_map),
            "variables": dict(self._var_map),
            "literals": dict(self._literal_map),
        }


# ---------------------------------------------------------------------------
# Substitution record
# ---------------------------------------------------------------------------


class _Substitution:
    """
    A single byte-range substitution to apply to the source text.

    Collected in DFS pre-order, then applied in one final reconstruction pass.
    All byte offsets are relative to the Type-1 stripped source bytes.
    """

    __slots__ = ("start_byte", "end_byte", "replacement")

    def __init__(self, start_byte: int, end_byte: int, replacement: str) -> None:
        self.start_byte = start_byte
        self.end_byte = end_byte
        self.replacement = replacement


# ---------------------------------------------------------------------------
# Canonicalizer
# ---------------------------------------------------------------------------


class Canonicalizer:
    """
    Produces Type-2 canonical source text from Type-1 stripped source text.

    One instance is created per worker process and reused across all granules.
    The per-granule state (CanonicalMapping) is created fresh for each call
    to canonicalize() and discarded when the call returns.

    Usage:
        canon = Canonicalizer()
        type2_text = canon.canonicalize(type1_text, "python")
    """

    def __init__(self) -> None:
        """
        Initialise tree-sitter parsers for all supported languages.

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

        self._parsers: dict[str, Any] = {
            lang: get_parser(lang) for lang in ("python", "java", "c")
        }
        self._languages: dict[str, Any] = {
            lang: get_language(lang) for lang in ("python", "java", "c")
        }

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def canonicalize(self, type1_text: str, language: str) -> str:
        """
        Transform Type-1 normalised text into Type-2 canonical form.

        Algorithm:
          1. Encode type1_text to UTF-8 bytes.
          2. Parse with the language-appropriate tree-sitter parser.
          3. Walk the CST in DFS pre-order, classifying each named leaf node:
               - Literal node  → LIT_<sha1_6hex>
               - Identifier node (not preserved) → FUNC_N / PARAM_N / VAR_N
               - All other nodes → not substituted
          4. Collect substitutions as (start_byte, end_byte, replacement) triples.
          5. Rebuild the source text by applying substitutions in byte order.

        The DFS traversal is performed by _collect_substitutions(), which
        dispatches to language-specific classification helpers.

        Args:
            type1_text: Type-1 normalised source text (output of type1.py).
            language:   One of "python", "java", "c".

        Returns:
            Type-2 canonical source text.

        Raises:
            ValueError: If language is not supported.
        """
        if language not in self._parsers:
            raise ValueError(
                f"Canonicalizer does not support language {language!r}. "
                f"Supported: {sorted(self._parsers)}"
            )

        if not type1_text.strip():
            return type1_text

        source_bytes: bytes = type1_text.encode("utf-8")
        tree: Any = self._parsers[language].parse(source_bytes)
        root: Any = tree.root_node

        mapping = CanonicalMapping()
        substitutions: list[_Substitution] = []

        self._collect_substitutions(
            root=root,
            source_bytes=source_bytes,
            language=language,
            mapping=mapping,
            substitutions=substitutions,
        )

        if not substitutions:
            return type1_text

        # Sort by start_byte ascending to apply in order.
        substitutions.sort(key=lambda s: s.start_byte)

        return _apply_substitutions(source_bytes, substitutions)

    # ------------------------------------------------------------------
    # CST walker
    # ------------------------------------------------------------------

    def _collect_substitutions(
        self,
        root: Any,
        source_bytes: bytes,
        language: str,
        mapping: CanonicalMapping,
        substitutions: list[_Substitution],
    ) -> None:
        """
        Walk the CST in DFS pre-order and populate substitutions.

        Uses an explicit stack (not Python recursion) to avoid hitting
        sys.getrecursionlimit() on deeply nested code (e.g. 1000-deep
        nested ternaries or chained method calls).

        The stack carries (node, context) pairs where context is a
        _NodeContext describing the role expected of the node (e.g. "the
        next identifier we encounter is a function name").

        Args:
            root:          Tree-sitter root node.
            source_bytes:  UTF-8 bytes of the Type-1 source.
            language:      Source language key.
            mapping:       CanonicalMapping instance for this granule.
            substitutions: Output list; substitutions are appended here.
        """
        literal_types = _LITERAL_NODE_TYPES[language]
        identifier_types = _IDENTIFIER_NODE_TYPES[language]
        preserve_set = _PRESERVE_SETS[language]

        # Stack entries: (node, expected_kind)
        # expected_kind is set by the parent context (see _push_children).
        # None means "not yet determined — classify by parent type".
        stack: list[tuple[Any, Optional[IdentifierKind]]] = [(root, None)]

        while stack:
            node, expected_kind = stack.pop()

            # ── Literal node ──────────────────────────────────────────
            if node.is_named and node.type in literal_types:
                raw_text = source_bytes[node.start_byte : node.end_byte].decode(
                    "utf-8", errors="replace"
                )
                token = mapping.get_or_assign_literal(raw_text)
                substitutions.append(
                    _Substitution(node.start_byte, node.end_byte, token)
                )
                # Do not descend into literal children.
                continue

            # ── Identifier node ───────────────────────────────────────
            if node.is_named and node.type in identifier_types:
                raw_name = source_bytes[node.start_byte : node.end_byte].decode(
                    "utf-8", errors="replace"
                )
                if raw_name not in preserve_set:
                    kind = (
                        expected_kind
                        if expected_kind is not None
                        else IdentifierKind.VAR
                    )
                    token = mapping.get_or_assign_identifier(raw_name, kind)
                    substitutions.append(
                        _Substitution(node.start_byte, node.end_byte, token)
                    )
                # Identifiers are leaf nodes — no children to push.
                continue

            # ── Structural node — push children with context ──────────
            children_with_context = _classify_children(node, language, source_bytes)
            # Push in reverse order so leftmost child is processed first (DFS pre-order).
            for child, child_kind in reversed(children_with_context):
                stack.append((child, child_kind))

    # ------------------------------------------------------------------
    # Preservation helper
    # ------------------------------------------------------------------

    @staticmethod
    def _should_preserve(name: str, language: str) -> bool:
        """
        Return True if `name` should NOT be canonicalised.

        Args:
            name:     The identifier text.
            language: Source language key.

        Returns:
            True if the name is a keyword or well-known built-in.
        """
        return name in _PRESERVE_SETS.get(language, frozenset())


# ---------------------------------------------------------------------------
# Child classification helpers
# ---------------------------------------------------------------------------


def _classify_children(
    parent: Any,
    language: str,
    source_bytes: bytes,
) -> list[tuple[Any, Optional[IdentifierKind]]]:
    """
    Determine the IdentifierKind context for each child of `parent`.

    Returns a list of (child_node, kind_or_None) pairs.  kind_or_None is:
      - IdentifierKind.FUNC   if the child is expected to be a function name.
      - IdentifierKind.PARAM  if the child is expected to be a parameter name.
      - None                  if the child's kind should be inferred from its
                              own parent context (i.e. VAR by default).

    Language-specific rules are dispatched here.
    """
    if language == "python":
        return _classify_python_children(parent)
    elif language == "java":
        return _classify_java_children(parent)
    elif language == "c":
        return _classify_c_children(parent, source_bytes)
    else:
        return [(child, None) for child in parent.children]


def _classify_python_children(
    parent: Any,
) -> list[tuple[Any, Optional[IdentifierKind]]]:
    """
    Classify the children of a Python CST node.

    Rules:
      function_definition → the `name` field (identifier) → FUNC
      parameters, typed_parameter, default_parameter,
        list_splat_pattern, dictionary_splat_pattern → identifier children → PARAM
      lambda → lambda_parameters children → PARAM
      All other identifier children → None (→ VAR by default)
    """
    result: list[tuple[Any, Optional[IdentifierKind]]] = []

    if parent.type == "function_definition":
        for child in parent.children:
            if child.is_named and child.type == "identifier":
                # This is the function name.
                result.append((child, IdentifierKind.FUNC))
            else:
                result.append((child, None))

    elif parent.type in (
        "parameters",
        "lambda_parameters",
    ):
        for child in parent.children:
            if child.is_named and child.type == "identifier":
                result.append((child, IdentifierKind.PARAM))
            else:
                result.append((child, None))

    elif parent.type in (
        "typed_parameter",
        "default_parameter",
        "typed_default_parameter",
        "list_splat_pattern",
        "dictionary_splat_pattern",
        "keyword_separator",
        "positional_separator",
    ):
        for child in parent.children:
            if child.is_named and child.type == "identifier":
                # First identifier in these nodes is the parameter name.
                result.append((child, IdentifierKind.PARAM))
            else:
                result.append((child, None))

    else:
        for child in parent.children:
            result.append((child, None))

    return result


def _classify_java_children(
    parent: Any,
) -> list[tuple[Any, Optional[IdentifierKind]]]:
    """
    Classify the children of a Java CST node.

    Rules:
      method_declaration → name field (identifier) → FUNC
      constructor_declaration → name field (identifier) → FUNC
      formal_parameter → name field (identifier) → PARAM
      spread_parameter → last identifier → PARAM
      All others → None (→ VAR)
    """
    result: list[tuple[Any, Optional[IdentifierKind]]] = []

    if parent.type in ("method_declaration", "constructor_declaration"):
        # The `name` field child is the method/constructor identifier.
        name_seen = False
        for child in parent.children:
            if not name_seen and child.is_named and child.type == "identifier":
                # The first identifier that is the name field.
                # In tree-sitter Java grammar the name field is always the
                # identifier directly after the return type / modifiers.
                name_seen = True
                result.append((child, IdentifierKind.FUNC))
            else:
                result.append((child, None))

    elif parent.type in ("formal_parameter", "spread_parameter"):
        identifiers_seen = 0
        for child in parent.children:
            if child.is_named and child.type == "identifier":
                identifiers_seen += 1
                # In formal_parameter, the last identifier is the parameter name;
                # earlier identifiers may be type names.
                # We mark all as PARAM here and let the preserve-set filter type names.
                result.append((child, IdentifierKind.PARAM))
            else:
                result.append((child, None))

    else:
        for child in parent.children:
            result.append((child, None))

    return result


def _classify_c_children(
    parent: Any,
    source_bytes: bytes,
) -> list[tuple[Any, Optional[IdentifierKind]]]:
    """
    Classify the children of a C CST node.

    Rules:
      function_definition → declarator chain → identifier → FUNC
      function_declarator → direct declarator (identifier) → FUNC
      pointer_declarator  → chained down to identifier → FUNC (via recursion hint)
      parameter_declaration → declarator chain → identifier → PARAM
      All others → None (→ VAR)
    """
    result: list[tuple[Any, Optional[IdentifierKind]]] = []

    if parent.type == "function_definition":
        for child in parent.children:
            if child.type in ("function_declarator", "pointer_declarator"):
                # Push with a "this subtree contains a function name" hint.
                result.append((child, IdentifierKind.FUNC))
            else:
                result.append((child, None))

    elif parent.type == "function_declarator":
        for child in parent.children:
            if child.is_named and child.type == "identifier":
                result.append((child, IdentifierKind.FUNC))
            elif child.type == "pointer_declarator":
                result.append((child, IdentifierKind.FUNC))
            else:
                result.append((child, None))

    elif parent.type == "pointer_declarator":
        for child in parent.children:
            if child.is_named and child.type in ("identifier", "function_declarator"):
                result.append((child, IdentifierKind.FUNC))
            else:
                result.append((child, None))

    elif parent.type == "parameter_declaration":
        for child in parent.children:
            if child.type in (
                "identifier",
                "pointer_declarator",
                "array_declarator",
                "function_declarator",
            ):
                result.append((child, IdentifierKind.PARAM))
            else:
                result.append((child, None))

    else:
        for child in parent.children:
            result.append((child, None))

    return result


# ---------------------------------------------------------------------------
# Substitution application
# ---------------------------------------------------------------------------


def _apply_substitutions(
    source_bytes: bytes,
    substitutions: list[_Substitution],
) -> str:
    """
    Rebuild the source text by applying a sorted list of substitutions.

    Substitutions must be sorted by start_byte ascending and must not overlap
    (the CST guarantees non-overlapping leaf nodes).

    Args:
        source_bytes:   UTF-8 bytes of the Type-1 source.
        substitutions:  Non-overlapping substitutions sorted by start_byte.

    Returns:
        Reconstructed source text with all substitutions applied.
    """
    parts: list[str] = []
    cursor: int = 0

    for sub in substitutions:
        if sub.start_byte > cursor:
            # Emit the unchanged segment between the last substitution and this one.
            parts.append(
                source_bytes[cursor : sub.start_byte].decode("utf-8", errors="replace")
            )
        elif sub.start_byte < cursor:
            # Overlapping substitution — should never happen with a well-formed CST.
            # Skip this substitution to avoid corrupting the output.
            continue

        parts.append(sub.replacement)
        cursor = sub.end_byte

    # Emit any remaining source after the last substitution.
    if cursor < len(source_bytes):
        parts.append(source_bytes[cursor:].decode("utf-8", errors="replace"))

    return "".join(parts)


# ---------------------------------------------------------------------------
# Module-level convenience function (subprocess-worker entry point)
# ---------------------------------------------------------------------------


def canonicalize(type1_text: str, language: str) -> str:
    """
    Module-level function: canonicalize type1_text for the given language.

    Lazily initialises a process-global Canonicalizer instance (one tree-sitter
    parser init per worker process, amortised over all granules).

    Args:
        type1_text: Type-1 normalised source text.
        language:   One of "python", "java", "c".

    Returns:
        Type-2 canonical source text.
    """
    global _PROCESS_CANONICALIZER  # noqa: PLW0603

    if _PROCESS_CANONICALIZER is None:
        _PROCESS_CANONICALIZER = Canonicalizer()

    return _PROCESS_CANONICALIZER.canonicalize(type1_text, language)


# Process-global singleton — initialised lazily.
_PROCESS_CANONICALIZER: Optional[Canonicalizer] = None


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "IdentifierKind",
    "CanonicalMapping",
    "Canonicalizer",
    "canonicalize",
    "_PYTHON_PRESERVE",
    "_JAVA_PRESERVE",
    "_C_PRESERVE",
    "_LITERAL_NODE_TYPES",
    "_IDENTIFIER_NODE_TYPES",
]
