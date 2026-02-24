"""
Type-1 normalisation pipeline for CIPAS (E10/US02).

Type-1 clones are code fragments that are identical after removing purely
cosmetic differences: comments, docstrings, and whitespace/formatting
variation.  This module implements the complete Type-1 pipeline:

  Step 1 — CST comment/docstring stripping
    Delegates to CSTStripper (stripper.py).  Uses the tree-sitter Concrete
    Syntax Tree to find and excise comment and docstring byte ranges.
    Language dispatch:
      Python  → "comment" nodes + first-statement string expressions (docstrings)
      Java    → "line_comment" + "block_comment" nodes
      C       → "comment" nodes (tree-sitter C unifies // and /* */ under one type)

  Step 2 — Pretty printing
    Delegates to PrettyPrinter (pretty_printer.py).  Invokes an external
    formatter as a subprocess:
      Python → black --quiet --fast --line-length 88 --target-version py311
      Java   → google-java-format --aosp -
      C      → clang-format --style="{BasedOnStyle: GNU, IndentWidth: 4, ...}"
    Timeout: 2 seconds per granule.
    Fallback: if the formatter times out, exits non-zero, or is unavailable,
    the stripped text (Step 1 output) is used verbatim.

  Step 3 — Hash
    SHA-256 of the UTF-8–encoded formatted text.

Pipeline entry points
──────────────────────
run_type1(request_dict)
  Module-level function, safe for ProcessPoolExecutor dispatch.
  Accepts a plain dict (from NormalizationRequest.to_worker_dict()) and
  returns a plain dict {"type1": str, "hash_type1": str}.

run_type1_direct(source_bytes, language, granule_id)
  Convenience wrapper for in-process calls (tests, benchmarks).
  Returns (type1_text, hash_type1_hex).

Determinism
────────────
Given identical source_bytes and language, this pipeline always returns
the same type1 text and hash.  The CSTStripper and PrettyPrinter are
both stateless with respect to content (they carry parser state for
performance but never accumulate per-granule state).  The SHA-256 hash
is content-addressed and platform-independent.

Worker process lifecycle
─────────────────────────
Both CSTStripper and PrettyPrinter are initialised lazily on the first
call within each worker process via module-level singletons in their
respective modules (strip_comments() and format_source()).  This amortises
the tree-sitter grammar load and formatter version-probe cost over the
lifetime of the worker process.

Error handling
───────────────
  - Formatter failure (timeout, non-zero exit, unavailable binary):
    Silently falls back to stripped text.  The fallback is logged at WARNING
    by PrettyPrinter._run_formatter().  No exception is raised to the caller.
  - CST parse failure (e.g. completely invalid syntax):
    tree-sitter always returns a partial tree; stripping always returns some
    text.  An empty source_bytes returns an empty string.
  - Encoding errors in source_bytes:
    Decoded with errors="replace" (U+FFFD substitution).  The resulting text
    is hashed as-is.

This module has NO non-stdlib imports beyond the cipas.normalization package
submodules.  It is safe to import and execute inside ProcessPoolExecutor
worker processes.
"""

from __future__ import annotations

import hashlib
from typing import Any

from cipas.normalization.pretty_printer import format_source
from cipas.normalization.stripper import strip_comments

# ---------------------------------------------------------------------------
# Worker-dispatch entry point
# ---------------------------------------------------------------------------


def run_type1(request_dict: dict[str, Any]) -> dict[str, str]:
    """
    Execute the full Type-1 normalisation pipeline on one granule.

    This is the module-level function dispatched to ProcessPoolExecutor
    workers.  It must be a module-level function (not a method or closure)
    to be picklable by the executor's IPC mechanism.

    Args:
        request_dict:
            A plain dict produced by NormalizationRequest.to_worker_dict().
            Required keys:
              "granule_id"   — str, opaque identifier for logging
              "language"     — str, one of "python" | "java" | "c"
              "source_bytes" — bytes, raw UTF-8 source of the granule
            Optional keys (passed through from NormalizationService config):
              "java_formatter_jar"         — str, path to GJF JAR
              "black_version_prefix"       — str, e.g. "24."
              "clang_format_major_version" — int, e.g. 17

    Returns:
        Plain dict with keys:
          "type1"      — str, Type-1 normalised source text
          "hash_type1" — str, 64-char lowercase SHA-256 hex digest of type1

    Note:
        Never raises.  Any exception during stripping or formatting is caught
        and handled by the underlying helpers (returning stripped/original text
        on failure).  If source_bytes is empty, both fields are empty strings.
    """
    granule_id: str = request_dict.get("granule_id", "<unknown>")
    language: str = request_dict["language"]
    source_bytes: bytes = request_dict["source_bytes"]

    # Forward optional formatter configuration to format_source().
    java_formatter_jar: str = request_dict.get("java_formatter_jar", "")
    black_version_prefix: str = request_dict.get("black_version_prefix", "24.")
    clang_format_major_version: int = int(
        request_dict.get("clang_format_major_version", 0)
    )

    type1_text, hash_type1 = _execute(
        source_bytes=source_bytes,
        language=language,
        granule_id=granule_id,
        java_formatter_jar=java_formatter_jar,
        black_version_prefix=black_version_prefix,
        clang_format_major_version=clang_format_major_version,
    )

    return {
        "type1": type1_text,
        "hash_type1": hash_type1,
    }


# ---------------------------------------------------------------------------
# In-process convenience wrapper
# ---------------------------------------------------------------------------


def run_type1_direct(
    source_bytes: bytes,
    language: str,
    *,
    granule_id: str = "<unknown>",
    java_formatter_jar: str = "",
    black_version_prefix: str = "24.",
    clang_format_major_version: int = 0,
) -> tuple[str, str]:
    """
    Execute the Type-1 pipeline directly (no ProcessPoolExecutor).

    Intended for use in tests, benchmarks, and in-process service calls where
    the caller has already ensured CPU isolation.

    Args:
        source_bytes:               Raw UTF-8 bytes of the granule source.
        language:                   One of "python", "java", "c".
        granule_id:                 Opaque identifier used in log messages.
        java_formatter_jar:         Path to google-java-format JAR (optional).
        black_version_prefix:       Expected black version prefix (optional).
        clang_format_major_version: Expected clang-format major version (optional).

    Returns:
        Tuple of (type1_text, hash_type1_hex).
        type1_text is the formatted/stripped source.
        hash_type1_hex is the 64-char SHA-256 hex of type1_text.
    """
    return _execute(
        source_bytes=source_bytes,
        language=language,
        granule_id=granule_id,
        java_formatter_jar=java_formatter_jar,
        black_version_prefix=black_version_prefix,
        clang_format_major_version=clang_format_major_version,
    )


# ---------------------------------------------------------------------------
# Core implementation
# ---------------------------------------------------------------------------


def _execute(
    source_bytes: bytes,
    language: str,
    granule_id: str,
    java_formatter_jar: str,
    black_version_prefix: str,
    clang_format_major_version: int,
) -> tuple[str, str]:
    """
    Internal implementation shared by run_type1() and run_type1_direct().

    Runs Step 1 (strip) → Step 2 (format) → Step 3 (hash) in sequence.
    Never raises.

    Args:
        source_bytes:               Raw UTF-8 source bytes.
        language:                   "python" | "java" | "c".
        granule_id:                 For log messages.
        java_formatter_jar:         GJF JAR path (may be empty).
        black_version_prefix:       black version pin prefix (may be empty).
        clang_format_major_version: clang-format major version pin (0 = disabled).

    Returns:
        (type1_text, hash_type1_hex)
    """
    # ── Step 1: CST comment/docstring stripping ───────────────────────────
    stripped: str = strip_comments(source_bytes, language)

    # ── Step 2: Pretty printing ───────────────────────────────────────────
    # format_source() never raises — it falls back to stripped on any error.
    # Formatter config is forwarded so worker processes use the same version
    # pins as the service process that spawned them.
    formatted: str = format_source(
        stripped,
        language,
        granule_id=granule_id,
        java_formatter_jar=java_formatter_jar,
        black_version_prefix=black_version_prefix,
        clang_format_major_version=clang_format_major_version,
    )

    # ── Step 3: Deterministic SHA-256 hash ───────────────────────────────
    # Encode as UTF-8 before hashing to ensure cross-platform byte identity.
    # The hash is over the formatted text (not stripped), so two granules that
    # differ only in comment placement but format identically are Type-1 clones.
    hash_type1: str = _sha256_text(formatted)

    return formatted, hash_type1


# ---------------------------------------------------------------------------
# Hashing helper
# ---------------------------------------------------------------------------


def _sha256_text(text: str) -> str:
    """
    Compute the SHA-256 hex digest of a UTF-8 encoded text string.

    This is the canonical hash function for Type-1 normalised text.
    Encoding is always UTF-8 to ensure cross-platform determinism —
    never the platform-default codec.

    Args:
        text: Normalised source text.

    Returns:
        64-character lowercase hex string (SHA-256 digest).
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "run_type1",
    "run_type1_direct",
]
