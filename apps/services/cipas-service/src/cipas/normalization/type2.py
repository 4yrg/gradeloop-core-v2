"""
Type-2 normalisation pipeline for CIPAS (E10/US02).

Type-2 clones are code fragments that are structurally identical after replacing
all user-defined identifiers and literals with canonical tokens.  Two granules
are Type-2 clones iff their Type-2 normalised texts are equal (and therefore
their hash_type2 values match).

This module implements the complete Type-2 pipeline, which runs on top of the
Type-1 output:

  Input  → Type-1 normalised text  (comments stripped, pretty-printed)
  Step 1 → Identifier canonicalisation  (VAR_N / PARAM_N / FUNC_N)
  Step 2 → Literal canonicalisation     (LIT_<sha1_6hex>)
  Step 3 → SHA-256 hash of the canonical text
  Output → (type2_text, hash_type2_hex)

Both Steps 1 and 2 are performed in a single CST walk by Canonicalizer
(canonicalizer.py).  The split is conceptual — the implementation collects
all substitutions in one DFS pass and applies them in one reconstruction pass.

Pipeline entry points
──────────────────────
run_type2(request_dict)
  Module-level function, safe for ProcessPoolExecutor dispatch.
  Accepts a plain dict with keys "type1" (str), "language" (str),
  "granule_id" (str) and returns {"type2": str, "hash_type2": str}.

run_type2_direct(type1_text, language, granule_id)
  Convenience wrapper for in-process calls (tests, benchmarks).
  Returns (type2_text, hash_type2_hex).

Determinism
────────────
Given identical type1_text and language, this pipeline always returns the
same type2 text and hash.  The CanonicalMapping inside Canonicalizer is
freshly created per granule (never shared), and the DFS traversal order is
determined entirely by the tree-sitter parse tree structure, which is
deterministic for a given input.

The SHA-256 hash is over the UTF-8 encoding of type2_text.  Since type2_text
is itself deterministic, hash_type2 is stable across invocations, processes,
platforms, and Python interpreter restarts.

Identifier assignment ordering
────────────────────────────────
Identifiers are assigned canonical indices in DFS pre-order:
  - The first user-defined function name encountered → FUNC_1
  - The first parameter encountered → PARAM_1
  - The first other variable encountered → VAR_1
  - Subsequent new names get incrementing indices within their category.
  - A name encountered for the second time (in any role) reuses the token
    assigned on first encounter.

This ordering is stable because:
  1. tree-sitter's DFS pre-order is deterministic for a given source text.
  2. The Type-1 input is itself deterministic (same pretty-printer output
     for the same stripped source).
  3. The CanonicalMapping uses OrderedDict so insertion order is preserved.

Worker process lifecycle
─────────────────────────
Canonicalizer is initialised lazily on the first call within each worker
process via the process-global canonicalize() function in canonicalizer.py.
Parser objects are reused across granules.

Error handling
───────────────
  - CST parse errors in the Type-1 text: tree-sitter returns a partial tree;
    the canonicaliser processes whatever nodes are present.  Completely
    unparseable text returns unchanged.
  - Empty type1_text: returns ("", sha256_of_empty_string).
  - Encoding errors: decoded with errors="replace".
"""

from __future__ import annotations

import hashlib
from typing import Any

from cipas.normalization.canonicalizer import canonicalize

# ---------------------------------------------------------------------------
# Worker-dispatch entry point
# ---------------------------------------------------------------------------


def run_type2(request_dict: dict[str, Any]) -> dict[str, str]:
    """
    Execute the full Type-2 normalisation pipeline on one granule.

    This is the module-level function dispatched to ProcessPoolExecutor
    workers.  It must be module-level (not a method or closure) to be
    picklable by the executor's IPC mechanism.

    The caller is responsible for having already computed Type-1 normalisation.
    This function receives the Type-1 output and produces Type-2 output.
    In the NormalizationService, both Type-1 and Type-2 are computed in the
    same worker task (run_normalization_worker) to avoid a redundant subprocess
    round-trip; run_type2 is provided as a standalone entry point for
    independent Type-2 re-normalisation and for testing.

    Args:
        request_dict:
            Plain dict with the following required keys:
              "type1"      — str, Type-1 normalised source text
              "language"   — str, one of "python" | "java" | "c"
            Optional keys:
              "granule_id" — str, opaque identifier for logging (default "<unknown>")

    Returns:
        Plain dict with keys:
          "type2"      — str, Type-2 canonical source text
          "hash_type2" — str, 64-char lowercase SHA-256 hex digest of type2

    Note:
        Never raises.  An empty or unparseable type1 produces an empty type2
        with the SHA-256 of the empty string as hash_type2.
    """
    type1_text: str = request_dict["type1"]
    language: str = request_dict["language"]
    granule_id: str = request_dict.get("granule_id", "<unknown>")

    type2_text, hash_type2 = _execute(
        type1_text=type1_text,
        language=language,
        granule_id=granule_id,
    )

    return {
        "type2": type2_text,
        "hash_type2": hash_type2,
    }


# ---------------------------------------------------------------------------
# In-process convenience wrapper
# ---------------------------------------------------------------------------


def run_type2_direct(
    type1_text: str,
    language: str,
    *,
    granule_id: str = "<unknown>",
) -> tuple[str, str]:
    """
    Execute the Type-2 pipeline directly (no ProcessPoolExecutor).

    Intended for use in tests, benchmarks, and in-process service calls.

    Args:
        type1_text:  Type-1 normalised source text.
        language:    One of "python", "java", "c".
        granule_id:  Opaque identifier used in log messages.

    Returns:
        Tuple of (type2_text, hash_type2_hex).
        type2_text    — canonical source with identifiers and literals replaced.
        hash_type2_hex — 64-char SHA-256 hex digest of type2_text.
    """
    return _execute(
        type1_text=type1_text,
        language=language,
        granule_id=granule_id,
    )


# ---------------------------------------------------------------------------
# Combined worker function (used by NormalizationService)
# ---------------------------------------------------------------------------


def run_normalization_worker(request_dict: dict[str, Any]) -> dict[str, str]:
    """
    Execute both Type-1 and Type-2 pipelines in a single worker invocation.

    This is the primary entry point dispatched by NormalizationService to
    its ProcessPoolExecutor.  Running both pipelines in one worker task
    avoids the IPC overhead of two separate executor.submit() calls and
    the latency of deserialising the Type-1 result back into the event loop
    before re-submitting it for Type-2 processing.

    The Type-1 pipeline (stripper + pretty-printer) is imported here rather
    than in the module header so that the import is deferred to the worker
    process.  This keeps the event-loop process's import footprint small.

    Args:
        request_dict:
            Plain dict produced by NormalizationRequest.to_worker_dict(),
            with the following keys:
              "granule_id"                 — str
              "language"                   — str
              "source_bytes"               — bytes
            Optional formatter config keys (forwarded to PrettyPrinter):
              "java_formatter_jar"         — str
              "black_version_prefix"       — str
              "clang_format_major_version" — int

    Returns:
        Plain dict with keys:
          "type1"      — str
          "hash_type1" — str (64-char SHA-256 hex)
          "type2"      — str
          "hash_type2" — str (64-char SHA-256 hex)
    """
    # Defer import to worker process to avoid event-loop import overhead.
    from cipas.normalization.type1 import run_type1  # noqa: PLC0415

    # Step A: Type-1 pipeline (strip + format).
    type1_result = run_type1(request_dict)

    # Step B: Type-2 pipeline (canonicalise).
    type2_input = {
        "type1": type1_result["type1"],
        "language": request_dict["language"],
        "granule_id": request_dict.get("granule_id", "<unknown>"),
    }
    type2_result = run_type2(type2_input)

    return {
        "type1": type1_result["type1"],
        "hash_type1": type1_result["hash_type1"],
        "type2": type2_result["type2"],
        "hash_type2": type2_result["hash_type2"],
    }


# ---------------------------------------------------------------------------
# Core implementation
# ---------------------------------------------------------------------------


def _execute(
    type1_text: str,
    language: str,
    granule_id: str,
) -> tuple[str, str]:
    """
    Internal implementation shared by run_type2() and run_type2_direct().

    Runs identifier + literal canonicalisation via the process-global
    Canonicalizer singleton, then hashes the result.

    Args:
        type1_text:  Type-1 normalised source text.
        language:    "python" | "java" | "c".
        granule_id:  For log messages (not used in computation).

    Returns:
        (type2_text, hash_type2_hex)
    """
    # ── Step 1+2: Identifier and literal canonicalisation (single CST pass) ──
    # canonicalize() uses the process-global Canonicalizer singleton, which
    # holds one tree-sitter Parser per language, initialised once per process.
    type2_text: str = canonicalize(type1_text, language)

    # ── Step 3: Deterministic SHA-256 hash ────────────────────────────────────
    hash_type2: str = _sha256_text(type2_text)

    return type2_text, hash_type2


# ---------------------------------------------------------------------------
# Hashing helper
# ---------------------------------------------------------------------------


def _sha256_text(text: str) -> str:
    """
    Compute the SHA-256 hex digest of a UTF-8 encoded text string.

    This is the canonical hash function for Type-2 normalised text.
    Must be byte-for-byte identical to NormalizedResult.make_hash() so that
    the model's cross-field validator (validate_hash_matches_text) always
    accepts results produced by this function.

    Args:
        text: Canonical Type-2 source text.

    Returns:
        64-character lowercase hex string (SHA-256 digest).
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "run_type2",
    "run_type2_direct",
    "run_normalization_worker",
]
