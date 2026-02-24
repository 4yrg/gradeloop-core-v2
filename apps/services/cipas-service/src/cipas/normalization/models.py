"""
Domain models for the CIPAS Syntactic Normalisation Pipeline (E10/US02).

This module is the single source of truth for every data shape that flows
through the normalisation pipeline.  It has NO non-stdlib imports beyond
Pydantic, so it is importable from both the async event-loop process and from
subprocess worker processes that reconstruct results from plain dicts.

Model hierarchy
───────────────
  NormalizationRequest  — input to the pipeline (one granule)
  NormalizedResult      — output from the pipeline (both Type-1 and Type-2)
  NormalizationStage    — enum of pipeline stages (for error attribution)
  NormalizationError    — structured exception carrying stage + granule context
  FormatterKind         — enum of available pretty-printers
  FormatterCheckResult  — outcome of a version-pin probe

Determinism contract
────────────────────
  NormalizedResult carries hash_type1 and hash_type2 which are SHA-256 digests
  of the normalised text.  Running the pipeline twice on identical input MUST
  produce identical hashes.  The models enforce this contract by:
    - Using frozen Pydantic models (no in-place mutation after creation).
    - Requiring normalised_at to be a fixed ISO-8601 timestamp provided by the
      caller (never derived inside the model from datetime.now()).
    - Rejecting empty hashes via field validators.

Redis key contract
──────────────────
  The Redis key for a result is always:
      cipas:normalized:{granule_id}
  This is provided by NormalizedResult.redis_key() to avoid key-string
  duplication across publisher, service, and cache-lookup layers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
import hashlib
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REDIS_KEY_PREFIX: str = "cipas:normalized"

# Supported language identifiers — kept in sync with cipas.domain.models.Language
# without importing from there, so this module stays subprocess-safe.
SUPPORTED_LANGUAGES: frozenset[str] = frozenset({"python", "java", "c"})


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class NormalizationStage(str, Enum):
    """
    Identifies the pipeline stage at which a normalisation error occurred.

    Used by NormalizationError for structured error attribution and by the
    metrics layer to record error counts per stage.
    """

    CST_STRIP = "cst_strip"
    PRETTY_PRINT = "pretty_print"
    CANONICALIZE_IDENTIFIERS = "canonicalize_identifiers"
    CANONICALIZE_LITERALS = "canonicalize_literals"
    TYPE1_PIPELINE = "type1_pipeline"
    TYPE2_PIPELINE = "type2_pipeline"
    REDIS_PUBLISH = "redis_publish"
    FORMATTER_VERSION_CHECK = "formatter_version_check"
    HASH = "hash"


class FormatterKind(str, Enum):
    """
    Identifies which external formatter binary is invoked for pretty-printing.

    Each value corresponds to a specific language's canonical formatter:
      BLACK        — Python (black ≥24.x, pyproject.toml / --quiet / --fast)
      GOOGLE_JAVA  — Java  (google-java-format JAR, stdin mode)
      CLANG_FORMAT — C     (clang-format, --style="{BasedOnStyle: GNU,...}")
    """

    BLACK = "black"
    GOOGLE_JAVA = "google-java-format"
    CLANG_FORMAT = "clang-format"

    @classmethod
    def for_language(cls, language: str) -> "FormatterKind":
        """
        Return the canonical formatter for the given language string.

        Args:
            language: One of "python", "java", "c".

        Returns:
            The FormatterKind for that language.

        Raises:
            ValueError: If the language is not supported.
        """
        _MAP: dict[str, FormatterKind] = {
            "python": cls.BLACK,
            "java": cls.GOOGLE_JAVA,
            "c": cls.CLANG_FORMAT,
        }
        try:
            return _MAP[language]
        except KeyError:
            raise ValueError(
                f"No formatter registered for language {language!r}. "
                f"Supported: {sorted(_MAP)}"
            )


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


class NormalizationRequest(BaseModel):
    """
    Input to the normalisation pipeline for a single granule.

    Both source_text and source_bytes must be consistent (source_bytes is the
    UTF-8 encoding of source_text).  Callers should supply source_bytes
    directly (sliced from the original file bytes) and set source_text by
    decoding with errors="replace".

    The model is NOT frozen — the pipeline may attach metadata fields during
    orchestration.  Use NormalizedResult (frozen) for final outputs.

    Fields
    ──────
    granule_id      UUID string or any opaque identifier assigned by the caller.
                    Used as the suffix in the Redis key cipas:normalized:{granule_id}.
    language        One of "python", "java", "c" (lowercase).
    source_text     Decoded source text (UTF-8, errors replaced).
    source_bytes    Raw UTF-8 source bytes — required by the CST stripper and
                    canonicaliser (tree-sitter operates on bytes).
    """

    model_config = ConfigDict(frozen=False, arbitrary_types_allowed=True)

    granule_id: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Opaque granule identifier (UUID string or composite key)",
    )
    language: str = Field(
        ...,
        description="Source language: python | java | c",
    )
    source_text: str = Field(
        ...,
        description="Decoded source text (UTF-8, errors replaced with U+FFFD)",
    )
    source_bytes: bytes = Field(
        ...,
        description="Raw UTF-8 source bytes as sliced from the original file",
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        lowered = v.lower()
        if lowered not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language {v!r}. Supported: {sorted(SUPPORTED_LANGUAGES)}"
            )
        return lowered

    @field_validator("granule_id")
    @classmethod
    def validate_granule_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("granule_id must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_bytes_text_consistency(self) -> "NormalizationRequest":
        """
        Warn (but do not raise) if source_bytes is empty while source_text is not.

        We cannot enforce strict byte-text equality because source_text may have
        had decode errors replaced (U+FFFD), making strict round-trip comparison
        unreliable.  We only assert non-empty bytes when source_text is non-empty
        to catch obvious caller mistakes.
        """
        if self.source_text and not self.source_bytes:
            raise ValueError(
                "source_bytes must be non-empty when source_text is non-empty"
            )
        return self

    def to_worker_dict(self) -> dict[str, Any]:
        """
        Serialise the request to a plain dict safe for pickle IPC.

        ProcessPoolExecutor workers receive arguments via pickle.  This method
        produces a dict with only basic Python types (str, bytes) so pickle
        never encounters Pydantic internals.

        Returns:
            Plain dict with keys: granule_id, language, source_text, source_bytes.
        """
        return {
            "granule_id": self.granule_id,
            "language": self.language,
            "source_text": self.source_text,
            "source_bytes": self.source_bytes,
        }

    @classmethod
    def from_worker_dict(cls, d: dict[str, Any]) -> "NormalizationRequest":
        """
        Reconstruct a NormalizationRequest from a plain dict (reverse of to_worker_dict).

        Useful in tests and when deserialising results from worker processes.
        """
        return cls(
            granule_id=d["granule_id"],
            language=d["language"],
            source_text=d["source_text"],
            source_bytes=d["source_bytes"],
        )


# ---------------------------------------------------------------------------
# Output model
# ---------------------------------------------------------------------------


class NormalizedResult(BaseModel):
    """
    Fully normalised output for a single granule — the Redis payload.

    Frozen after construction to enforce the determinism contract: once a
    NormalizedResult is created, it is immutable.  Any re-processing of the
    same granule must produce a new NormalizedResult with identical field
    values (verified by the determinism test suite).

    Redis payload schema (serialised as JSON):
    ──────────────────────────────────────────
    {
      "granule_id":    "...",     // matches NormalizationRequest.granule_id
      "language":      "...",     // python | java | c
      "type1":         "...",     // Type-1 normalised source text
      "type2":         "...",     // Type-2 normalised source text
      "hash_type1":    "...",     // 64-char SHA-256 hex of type1
      "hash_type2":    "...",     // 64-char SHA-256 hex of type2
      "normalized_at": "..."      // ISO-8601 UTC timestamp (caller-supplied)
    }

    Hash fields are validated to be exactly 64-character lowercase hex strings.
    normalized_at is validated to be a non-empty ISO-8601 string (not a datetime
    object, so that JSON serialisation is trivially stable).
    """

    model_config = ConfigDict(frozen=True)

    granule_id: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="Opaque granule identifier — matches the request",
    )
    language: str = Field(
        ...,
        description="Source language: python | java | c",
    )
    type1: str = Field(
        ...,
        description="Type-1 normalised source (comments stripped, pretty-printed)",
    )
    type2: str = Field(
        ...,
        description=(
            "Type-2 normalised source (Type-1 + identifier/literal canonicalisation)"
        ),
    )
    hash_type1: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex digest of the type1 field (64 lowercase hex chars)",
    )
    hash_type2: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex digest of the type2 field (64 lowercase hex chars)",
    )
    normalized_at: str = Field(
        ...,
        description=(
            "ISO-8601 UTC timestamp when normalisation completed. "
            "Caller-supplied so that hash computation is not affected by clock skew."
        ),
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language {v!r}. Supported: {sorted(SUPPORTED_LANGUAGES)}"
            )
        return v

    @field_validator("hash_type1", "hash_type2")
    @classmethod
    def validate_sha256_hex(cls, v: str) -> str:
        if len(v) != 64 or not all(c in "0123456789abcdef" for c in v):
            raise ValueError(
                f"Hash must be exactly 64 lowercase hex characters. Got {len(v)} chars: {v[:16]!r}…"
            )
        return v

    @field_validator("normalized_at")
    @classmethod
    def validate_iso_timestamp(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("normalized_at must not be blank")
        # Light structural check — must be parseable as ISO-8601.
        # We don't store datetime objects to keep JSON serialisation trivially stable.
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(
                f"normalized_at must be a valid ISO-8601 timestamp. Got: {v!r}"
            )
        return v

    @model_validator(mode="after")
    def validate_hash_matches_text(self) -> "NormalizedResult":
        """
        Runtime determinism guard: recompute hashes and compare.

        This cross-field validator ensures that hash_type1 == sha256(type1) and
        hash_type2 == sha256(type2).  It fires at construction time so that any
        caller who supplies a mismatched hash is caught immediately.

        Both type1 and type2 are encoded as UTF-8 before hashing (consistent
        with the normalisation service's hash computation).
        """
        computed_h1 = hashlib.sha256(self.type1.encode("utf-8")).hexdigest()
        if self.hash_type1 != computed_h1:
            raise ValueError(
                f"hash_type1 mismatch: supplied {self.hash_type1!r} "
                f"but SHA-256(type1) = {computed_h1!r}"
            )
        computed_h2 = hashlib.sha256(self.type2.encode("utf-8")).hexdigest()
        if self.hash_type2 != computed_h2:
            raise ValueError(
                f"hash_type2 mismatch: supplied {self.hash_type2!r} "
                f"but SHA-256(type2) = {computed_h2!r}"
            )
        return self

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @property
    def redis_key(self) -> str:
        """
        The Redis key where this result is stored.

        Always: cipas:normalized:{granule_id}

        Never derived anywhere else — all layers import this property to avoid
        key-string duplication.
        """
        return f"{REDIS_KEY_PREFIX}:{self.granule_id}"

    def to_redis_payload(self) -> dict[str, str]:
        """
        Serialise to the canonical Redis payload dict.

        All values are strings for JSON-safe serialisation.  The caller
        (RedisPublisher) is responsible for json.dumps() and TTL management.

        Returns:
            Dict with keys: granule_id, language, type1, type2,
                            hash_type1, hash_type2, normalized_at.
        """
        return {
            "granule_id": self.granule_id,
            "language": self.language,
            "type1": self.type1,
            "type2": self.type2,
            "hash_type1": self.hash_type1,
            "hash_type2": self.hash_type2,
            "normalized_at": self.normalized_at,
        }

    @classmethod
    def from_redis_payload(cls, payload: dict[str, str]) -> "NormalizedResult":
        """
        Reconstruct a NormalizedResult from a deserialized Redis payload dict.

        Used by cache-lookup paths (service.get_cached()) to restore a result
        without re-running the pipeline.

        Args:
            payload: A dict as produced by json.loads(redis_value).

        Returns:
            NormalizedResult — fully validated, frozen.

        Raises:
            ValidationError: If the payload is malformed or hashes do not match.
        """
        return cls(
            granule_id=payload["granule_id"],
            language=payload["language"],
            type1=payload["type1"],
            type2=payload["type2"],
            hash_type1=payload["hash_type1"],
            hash_type2=payload["hash_type2"],
            normalized_at=payload["normalized_at"],
        )

    @staticmethod
    def now_utc_iso() -> str:
        """
        Return the current UTC time as an ISO-8601 string.

        This is a convenience method for callers that do not need to inject
        a specific timestamp.  Uses timezone-aware datetime (Python 3.11+).

        Returns:
            ISO-8601 string, e.g. "2024-06-01T12:34:56.789012+00:00"
        """
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def make_hash(text: str) -> str:
        """
        Compute SHA-256 of a UTF-8 encoded text string.

        Centralised here to ensure all layers use the same encoding (UTF-8)
        and the same algorithm (SHA-256), preventing drift between the
        pipeline computation and the validator's recomputation.

        Args:
            text: The normalised source text to hash.

        Returns:
            64-character lowercase hex string.
        """
        return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Formatter version check result
# ---------------------------------------------------------------------------


class FormatterCheckResult(BaseModel):
    """
    Outcome of a formatter binary version-pin probe.

    Returned by PrettyPrinter.check_versions() and consumed by the metrics
    layer and the service startup sequence.

    Fields
    ──────
    formatter:          Which formatter was checked.
    available:          True if the binary/JAR was found on PATH.
    version_string:     Raw version string extracted from the binary output.
                        Empty string if the binary is unavailable.
    version_matches:    True if the version matches the configured pin prefix.
                        Always True when no pin prefix is configured (pin disabled).
    warn_message:       Human-readable warning if version does not match pin.
                        Empty string when version matches or pin is disabled.
    """

    model_config = ConfigDict(frozen=True)

    formatter: FormatterKind
    available: bool
    version_string: str = ""
    version_matches: bool = True
    warn_message: str = ""


# ---------------------------------------------------------------------------
# Structured exception
# ---------------------------------------------------------------------------


class NormalizationError(Exception):
    """
    Structured exception raised by any stage of the normalisation pipeline.

    Carries enough context to:
      - Log a structured error record with all relevant fields.
      - Emit a per-stage error metric.
      - Return a useful HTTP 500 / 422 response body from the API layer.
      - Trigger a fallback path (e.g., fall back to stripped text on formatter
        failure) without losing the original error detail.

    Usage:
        raise NormalizationError(
            granule_id="abc-123",
            language="python",
            stage=NormalizationStage.PRETTY_PRINT,
            reason="black subprocess timed out after 2.0s",
        )

    Fallback:
        The pipeline catches NormalizationError from the pretty-printer and
        falls back to the stripped text.  In that case, the exception is logged
        as a warning (not re-raised) and the result carries the stripped text
        instead of the formatted text.
    """

    def __init__(
        self,
        granule_id: str,
        language: str,
        stage: NormalizationStage,
        reason: str,
        *,
        cause: BaseException | None = None,
    ) -> None:
        """
        Args:
            granule_id: The granule being normalised when the error occurred.
            language:   Source language of the granule.
            stage:      The pipeline stage that raised.
            reason:     Human-readable error description (no stack trace).
            cause:      Optional chained exception (subprocess.TimeoutExpired, etc.).
        """
        self.granule_id = granule_id
        self.language = language
        self.stage = stage
        self.reason = reason
        self.cause = cause
        super().__init__(
            f"[{stage.value}] granule={granule_id!r} lang={language!r}: {reason}"
        )

    def to_dict(self) -> dict[str, str]:
        """
        Serialise to a plain dict for structured logging and API error bodies.

        Returns:
            Dict with keys: granule_id, language, stage, reason.
        """
        return {
            "granule_id": self.granule_id,
            "language": self.language,
            "stage": self.stage.value,
            "reason": self.reason,
        }


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "REDIS_KEY_PREFIX",
    "SUPPORTED_LANGUAGES",
    "NormalizationStage",
    "FormatterKind",
    "FormatterCheckResult",
    "NormalizationRequest",
    "NormalizedResult",
    "NormalizationError",
]
