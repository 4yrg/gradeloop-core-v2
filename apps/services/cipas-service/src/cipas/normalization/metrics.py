"""
Prometheus metrics for the CIPAS Syntactic Normalisation Pipeline (E10/US02).

This module defines all Prometheus instrumentation for the normalisation
pipeline.  Every metric is registered exactly once at module load time via
module-level constants.  Importing this module in multiple places is safe —
Prometheus's CollectorRegistry raises if a metric with the same name is
registered twice, so we guard against double-registration with a try/except
pattern.

Metric naming convention
─────────────────────────
All metrics are prefixed with cipas_normalization_ to scope them to this
subsystem within the broader CIPAS service.  The prometheus_client library
automatically appends _total to Counter names and _seconds to Histogram names
where appropriate.

Metrics defined
────────────────
  cipas_normalization_duration_seconds  [Histogram]
    Per-granule wall-clock latency from pipeline start to Redis publish.
    Labels: language ("python"|"java"|"c"), pipeline ("type1"|"type2"|"both")

  cipas_normalization_granules_total  [Counter]
    Total granules processed.
    Labels: language, status ("success"|"error")

  cipas_normalization_errors_total  [Counter]
    Per-stage error count.
    Labels: language, stage (NormalizationStage.value strings)

  cipas_normalization_formatter_fallback_total  [Counter]
    Number of times the pretty-printer fell back to stripped text.
    Labels: language, formatter ("black"|"google-java-format"|"clang-format")

  cipas_normalization_redis_ops_total  [Counter]
    Redis operation count.
    Labels: operation ("set"|"get"|"mget"|"pipeline_set"), status ("ok"|"error"|"miss")

  cipas_normalization_batch_size  [Histogram]
    Distribution of normalize_batch() call sizes (number of granules).
    No labels.  Buckets: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512.

  cipas_normalization_cache_hit_ratio  [Counter pair]
    Cache hits and misses for get_cached() calls.
    Labels: language, result ("hit"|"miss")

  cipas_normalization_worker_queue_depth  [Gauge]
    Number of normalization tasks currently queued in the ProcessPoolExecutor.
    No labels.  Updated by NormalizationService before/after submit.

  cipas_normalization_type1_bytes  [Histogram]
    Distribution of Type-1 normalised text sizes in bytes.
    Labels: language.  Buckets: 64, 256, 1KB, 4KB, 16KB, 64KB, 256KB.

  cipas_normalization_type2_bytes  [Histogram]
    Distribution of Type-2 canonical text sizes in bytes.
    Labels: language.  Buckets: same as type1.

Double-registration guard
─────────────────────────
prometheus_client raises ValueError if a metric with the same name is
registered twice in the default registry.  This happens when:
  - Tests reload the module.
  - The module is imported in both the main process and a subprocess that
    forked before the import (the subprocess inherits the registry).

We guard each metric definition with a try/except ValueError block that
retrieves the already-registered metric from the registry on collision.
This makes the module idempotent.

Usage
──────
    from cipas.normalization.metrics import (
        record_normalization_duration,
        record_granule_processed,
        record_normalization_error,
        record_formatter_fallback,
        record_redis_op,
        record_batch_size,
        record_cache_result,
        set_worker_queue_depth,
        record_output_sizes,
    )

    with record_normalization_duration("python", "both"):
        result = await service.normalize(request)

All public functions are thin wrappers around the underlying Prometheus
objects.  They never raise — metric recording is non-critical and any
exception from prometheus_client is caught and silently suppressed to
prevent metrics instrumentation from breaking the normalisation pipeline.
"""

from __future__ import annotations

import contextlib
from contextlib import contextmanager
import time
from typing import Generator, Optional

try:
    from prometheus_client import (
        REGISTRY,
        Counter,
        Gauge,
        Histogram,
    )

    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False


# ---------------------------------------------------------------------------
# Histogram bucket definitions
# ---------------------------------------------------------------------------

# Latency buckets tuned for sub-100ms target (500 LOC ≤ 100ms).
# Fine-grained at the low end, coarser at the high end.
_LATENCY_BUCKETS = (
    0.005,  # 5ms
    0.010,  # 10ms
    0.025,  # 25ms
    0.050,  # 50ms
    0.075,  # 75ms
    0.100,  # 100ms  ← SLO boundary
    0.150,  # 150ms
    0.250,  # 250ms
    0.500,  # 500ms
    1.000,  # 1s
    2.000,  # 2s   (formatter timeout boundary)
    5.000,  # 5s
    10.000,  # 10s  (per-granule hard timeout)
)

# Batch size buckets (powers of 2).
_BATCH_BUCKETS = (1, 2, 4, 8, 16, 32, 64, 128, 256, 512)

# Text size buckets in bytes.
_TEXT_SIZE_BUCKETS = (
    64,
    256,
    1_024,  # 1KB
    4_096,  # 4KB
    16_384,  # 16KB
    65_536,  # 64KB
    262_144,  # 256KB
    1_048_576,  # 1MB
)


# ---------------------------------------------------------------------------
# Safe metric factory helpers
# ---------------------------------------------------------------------------


def _make_counter(
    name: str, documentation: str, labelnames: list[str]
) -> Optional[object]:
    """
    Register a Counter, retrieving the existing one if already registered.

    Returns the Counter object, or None if prometheus_client is unavailable.
    """
    if not _PROMETHEUS_AVAILABLE:
        return None
    try:
        return Counter(name, documentation, labelnames)
    except ValueError:
        # Already registered — retrieve from registry.
        return REGISTRY._names_to_collectors.get(name)  # type: ignore[attr-defined]


def _make_histogram(
    name: str,
    documentation: str,
    labelnames: list[str],
    buckets: tuple[float, ...],
) -> Optional[object]:
    """
    Register a Histogram, retrieving the existing one if already registered.

    Returns the Histogram object, or None if prometheus_client is unavailable.
    """
    if not _PROMETHEUS_AVAILABLE:
        return None
    try:
        return Histogram(name, documentation, labelnames, buckets=buckets)
    except ValueError:
        return REGISTRY._names_to_collectors.get(name)  # type: ignore[attr-defined]


def _make_gauge(
    name: str, documentation: str, labelnames: list[str]
) -> Optional[object]:
    """
    Register a Gauge, retrieving the existing one if already registered.

    Returns the Gauge object, or None if prometheus_client is unavailable.
    """
    if not _PROMETHEUS_AVAILABLE:
        return None
    try:
        return Gauge(name, documentation, labelnames)
    except ValueError:
        return REGISTRY._names_to_collectors.get(name)  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Metric definitions
# ---------------------------------------------------------------------------

_NORMALIZATION_DURATION: Optional[object] = _make_histogram(
    name="cipas_normalization_duration_seconds",
    documentation=(
        "Per-granule wall-clock latency from pipeline start to Redis publish completion. "
        "SLO: p99 ≤ 100ms for 500 LOC granules."
    ),
    labelnames=["language", "pipeline"],
    buckets=_LATENCY_BUCKETS,
)

_GRANULES_PROCESSED: Optional[object] = _make_counter(
    name="cipas_normalization_granules_total",
    documentation="Total number of granules submitted to the normalisation pipeline.",
    labelnames=["language", "status"],
)

_NORMALIZATION_ERRORS: Optional[object] = _make_counter(
    name="cipas_normalization_errors_total",
    documentation="Per-stage normalisation error count.",
    labelnames=["language", "stage"],
)

_FORMATTER_FALLBACK: Optional[object] = _make_counter(
    name="cipas_normalization_formatter_fallback_total",
    documentation=(
        "Number of times the pretty-printer fell back to stripped text "
        "due to formatter timeout, non-zero exit, or binary unavailability."
    ),
    labelnames=["language", "formatter"],
)

_REDIS_OPS: Optional[object] = _make_counter(
    name="cipas_normalization_redis_ops_total",
    documentation="Redis operation count for the normalisation pipeline.",
    labelnames=["operation", "status"],
)

_BATCH_SIZE: Optional[object] = _make_histogram(
    name="cipas_normalization_batch_size",
    documentation="Distribution of normalize_batch() call sizes (number of granules per call).",
    labelnames=[],
    buckets=_BATCH_BUCKETS,
)

_CACHE_RESULT: Optional[object] = _make_counter(
    name="cipas_normalization_cache_result_total",
    documentation="Cache hit/miss counter for get_cached() lookups.",
    labelnames=["language", "result"],
)

_WORKER_QUEUE_DEPTH: Optional[object] = _make_gauge(
    name="cipas_normalization_worker_queue_depth",
    documentation=(
        "Number of normalisation tasks currently queued in the ProcessPoolExecutor. "
        "High values indicate the executor is saturated."
    ),
    labelnames=[],
)

_TYPE1_BYTES: Optional[object] = _make_histogram(
    name="cipas_normalization_type1_bytes",
    documentation="Distribution of Type-1 normalised source text sizes in bytes.",
    labelnames=["language"],
    buckets=_TEXT_SIZE_BUCKETS,
)

_TYPE2_BYTES: Optional[object] = _make_histogram(
    name="cipas_normalization_type2_bytes",
    documentation="Distribution of Type-2 canonical source text sizes in bytes.",
    labelnames=["language"],
    buckets=_TEXT_SIZE_BUCKETS,
)


# ---------------------------------------------------------------------------
# Public recording functions
# ---------------------------------------------------------------------------


@contextmanager
def record_normalization_duration(
    language: str,
    pipeline: str,
) -> Generator[None, None, None]:
    """
    Context manager that records wall-clock latency for one normalisation run.

    Usage:
        with record_normalization_duration("python", "both"):
            result = run_normalization_worker(request_dict)

    Args:
        language: "python" | "java" | "c"
        pipeline: "type1" | "type2" | "both"

    Yields:
        None.  The histogram observation is recorded on context exit.
    """
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        with contextlib.suppress(Exception):
            if _NORMALIZATION_DURATION is not None:
                _NORMALIZATION_DURATION.labels(  # type: ignore[union-attr]
                    language=language,
                    pipeline=pipeline,
                ).observe(elapsed)


def record_granule_processed(language: str, *, success: bool) -> None:
    """
    Increment the granule processed counter.

    Args:
        language: Source language of the granule.
        success:  True if normalisation succeeded, False on error.
    """
    with contextlib.suppress(Exception):
        if _GRANULES_PROCESSED is not None:
            status = "success" if success else "error"
            _GRANULES_PROCESSED.labels(  # type: ignore[union-attr]
                language=language,
                status=status,
            ).inc()


def record_normalization_error(language: str, stage: str) -> None:
    """
    Increment the per-stage error counter.

    Args:
        language: Source language of the granule where the error occurred.
        stage:    NormalizationStage.value string (e.g. "pretty_print",
                  "cst_strip", "redis_publish").
    """
    with contextlib.suppress(Exception):
        if _NORMALIZATION_ERRORS is not None:
            _NORMALIZATION_ERRORS.labels(  # type: ignore[union-attr]
                language=language,
                stage=stage,
            ).inc()


def record_formatter_fallback(language: str, formatter: str) -> None:
    """
    Increment the formatter fallback counter.

    Called by PrettyPrinter._run_formatter() when the formatter binary is
    unavailable, times out, or exits non-zero, and the pipeline falls back
    to the stripped text.

    Args:
        language:  Source language.
        formatter: Formatter kind value, e.g. "black", "google-java-format",
                   "clang-format".
    """
    with contextlib.suppress(Exception):
        if _FORMATTER_FALLBACK is not None:
            _FORMATTER_FALLBACK.labels(  # type: ignore[union-attr]
                language=language,
                formatter=formatter,
            ).inc()


def record_redis_op(operation: str, *, success: bool, miss: bool = False) -> None:
    """
    Increment the Redis operation counter.

    Args:
        operation: One of "set", "get", "mget", "pipeline_set".
        success:   True if the operation completed without error.
        miss:      True if a GET/MGET returned no value (cache miss).
                   Only meaningful for read operations; ignored for writes.
    """
    with contextlib.suppress(Exception):
        if _REDIS_OPS is not None:
            if not success:
                status = "error"
            elif miss:
                status = "miss"
            else:
                status = "ok"
            _REDIS_OPS.labels(  # type: ignore[union-attr]
                operation=operation,
                status=status,
            ).inc()


def record_batch_size(size: int) -> None:
    """
    Record the size of a normalize_batch() call.

    Args:
        size: Number of granules in the batch.
    """
    with contextlib.suppress(Exception):
        if _BATCH_SIZE is not None:
            _BATCH_SIZE.observe(float(size))  # type: ignore[union-attr]


def record_cache_result(language: str, *, hit: bool) -> None:
    """
    Increment the cache hit/miss counter.

    Args:
        language: Source language of the granule.
        hit:      True for a cache hit, False for a miss.
    """
    with contextlib.suppress(Exception):
        if _CACHE_RESULT is not None:
            _CACHE_RESULT.labels(  # type: ignore[union-attr]
                language=language,
                result="hit" if hit else "miss",
            ).inc()


def set_worker_queue_depth(depth: int) -> None:
    """
    Set the worker queue depth gauge to the given value.

    Should be called by NormalizationService after each submit() and after
    each Future completion so the gauge reflects the current backlog.

    Args:
        depth: Current number of pending/running tasks in the executor.
    """
    with contextlib.suppress(Exception):
        if _WORKER_QUEUE_DEPTH is not None:
            _WORKER_QUEUE_DEPTH.set(float(depth))  # type: ignore[union-attr]


def record_output_sizes(
    language: str,
    *,
    type1_text: str,
    type2_text: str,
) -> None:
    """
    Record the byte sizes of the Type-1 and Type-2 normalised outputs.

    Args:
        language:   Source language.
        type1_text: Type-1 normalised source text.
        type2_text: Type-2 canonical source text.
    """
    with contextlib.suppress(Exception):
        type1_size = len(type1_text.encode("utf-8"))
        type2_size = len(type2_text.encode("utf-8"))

        if _TYPE1_BYTES is not None:
            _TYPE1_BYTES.labels(language=language).observe(float(type1_size))  # type: ignore[union-attr]

        if _TYPE2_BYTES is not None:
            _TYPE2_BYTES.labels(language=language).observe(float(type2_size))  # type: ignore[union-attr]


def observe_latency(language: str, pipeline: str, elapsed_seconds: float) -> None:
    """
    Record a pre-computed latency observation directly (without context manager).

    Useful when the start/end time is measured externally (e.g. in the
    NormalizationService after awaiting an executor Future).

    Args:
        language:         Source language label.
        pipeline:         Pipeline label: "type1" | "type2" | "both".
        elapsed_seconds:  Wall-clock duration in seconds (float).
    """
    with contextlib.suppress(Exception):
        if _NORMALIZATION_DURATION is not None:
            _NORMALIZATION_DURATION.labels(  # type: ignore[union-attr]
                language=language,
                pipeline=pipeline,
            ).observe(elapsed_seconds)


# ---------------------------------------------------------------------------
# Diagnostic snapshot (for health-check and /metrics debug endpoints)
# ---------------------------------------------------------------------------


def metrics_snapshot() -> dict[str, object]:
    """
    Return a minimal dict snapshot of key metric values for health-check use.

    This is NOT a replacement for the Prometheus /metrics endpoint — it is
    a lightweight diagnostic that the CIPAS health router can include in its
    response body without pulling in full prometheus_client scrape machinery.

    Returns:
        Dict with string keys and numeric or string values.  Always returns
        a valid dict; if prometheus_client is unavailable, returns a dict
        indicating that metrics are disabled.
    """
    if not _PROMETHEUS_AVAILABLE:
        return {"metrics_available": False}

    def _safe_get_counter_value(metric: Optional[object], **labels: str) -> float:
        """Extract the current value of a Counter label combination."""
        try:
            if metric is None:
                return 0.0
            child = metric.labels(**labels)  # type: ignore[union-attr]
            return float(child._value.get())  # type: ignore[attr-defined]
        except Exception:
            return 0.0

    return {
        "metrics_available": True,
        "prometheus_client_installed": True,
        # Spot-check counters — useful for quick health confirmation.
        "granules_processed_python_success": _safe_get_counter_value(
            _GRANULES_PROCESSED, language="python", status="success"
        ),
        "granules_processed_java_success": _safe_get_counter_value(
            _GRANULES_PROCESSED, language="java", status="success"
        ),
        "granules_processed_c_success": _safe_get_counter_value(
            _GRANULES_PROCESSED, language="c", status="success"
        ),
        "errors_total_python": sum(
            _safe_get_counter_value(_NORMALIZATION_ERRORS, language="python", stage=s)
            for s in (
                "cst_strip",
                "pretty_print",
                "canonicalize_identifiers",
                "canonicalize_literals",
                "type1_pipeline",
                "type2_pipeline",
                "redis_publish",
                "hash",
            )
        ),
    }


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "record_normalization_duration",
    "record_granule_processed",
    "record_normalization_error",
    "record_formatter_fallback",
    "record_redis_op",
    "record_batch_size",
    "record_cache_result",
    "set_worker_queue_depth",
    "record_output_sizes",
    "observe_latency",
    "metrics_snapshot",
]
