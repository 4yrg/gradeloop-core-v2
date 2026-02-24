"""
CIPAS Syntactic Normalisation Pipeline — E10/US02.

This package implements a two-stage normalisation pipeline for source code
granules extracted by the CIPAS parsing layer (E15/US07).

Pipeline stages
───────────────
Type 1 — Cosmetic normalisation
  1. CST-based comment and docstring stripping (tree-sitter, NOT regex).
  2. Pretty-printing via language-specific formatters:
       Python → black  (≥24.x)
       Java   → google-java-format
       C      → clang-format  (K&R style)
  Produces a deterministic, whitespace-normalised source text.

Type 2 — Structural normalisation
  Runs on top of the Type 1 output.
  1. Identifier canonicalisation:
       variables   → VAR_1, VAR_2, …
       parameters  → PARAM_1, PARAM_2, …
       functions   → FUNC_1, FUNC_2, …
     Keywords and language built-ins are preserved.
     Mapping follows stable order-of-first-appearance (DFS pre-order).
  2. Literal canonicalisation:
       All numeric, string, and character literals → LIT_<sha1_6hex>
     Stable SHA-1 hashing, cross-platform deterministic.

Output
──────
Each normalised result is published to Redis under the key:
    cipas:normalized:{granule_id}
with a 1-hour TTL and a JSON payload conforming to NormalizedResult.

Public API
──────────
The canonical import surface for external consumers:

    from cipas.normalization import NormalizationService, NormalizedResult, NormalizationRequest

All other symbols are considered internal.
"""

from __future__ import annotations

from cipas.normalization.models import (
    NormalizationError,
    NormalizationRequest,
    NormalizationStage,
    NormalizedResult,
)
from cipas.normalization.service import NormalizationService

__all__ = [
    "NormalizationService",
    "NormalizationRequest",
    "NormalizedResult",
    "NormalizationError",
    "NormalizationStage",
]
