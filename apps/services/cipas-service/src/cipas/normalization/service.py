"""
NormalizationService — async orchestrator for the CIPAS Syntactic Normalisation Pipeline (E10/US02).

This is the top-level service class that wires together:
  - A ProcessPoolExecutor for CPU-bound normalisation work (stripping,
    pretty-printing, canonicalisation).
  - An async Redis publisher for persisting results.
  - Prometheus metrics instrumentation.
  - A cache-read path (get_cached) to skip re-normalisation of already-cached granules.

Architecture
─────────────
                ┌─────────────────────────────────────┐
                │           NormalizationService       │
                │  (async, runs in FastAPI event loop) │
                │                                      │
  normalize() ──┼──► cache check (Redis GET)           │
                │         │                            │
                │    hit ◄─┤─► miss                    │
                │              │                       │
                │         executor.submit(             │
                │           run_normalization_worker   │
                │         ) [ProcessPoolExecutor]      │
                │              │                       │
                │         await Future ─────────────── │──► NormalizedResult
                │              │                       │
                │         Redis publish (async)        │
                │         Metrics record               │
                └─────────────────────────────────────┘

ProcessPoolExecutor worker processes each execute run_normalization_worker()
from type2.py, which internally runs the full Type-1 (strip + format) and
Type-2 (canonicalise) pipelines synchronously.  Workers are initialised with
_normalization_worker_init() to pre-warm tree-sitter parsers and the
formatter version probe exactly once per worker process.

Concurrency model
──────────────────
  - normalize_batch() submits all granules to the executor concurrently
    (asyncio.gather on the futures) up to NORMALIZATION_BATCH_SIZE.
  - A semaphore (asyncio.Semaphore) bounds the number of simultaneously
    pending executor futures to prevent OOM from large concurrent batches.
  - Redis publishes are performed concurrently via asyncio.gather after all
    worker futures have resolved.
  - Cache lookups for batches use MGET (one Redis round-trip for the entire batch).

Performance targets
────────────────────
  ≤ 100ms per 500 LOC granule (wall-clock from normalize() call to return).
  CPU-bound work runs in the ProcessPoolExecutor off the event loop.
  Redis I/O is fully async (never blocks the event loop).

Lifecycle
──────────
  1. Construct:  NormalizationService(settings)
  2. Start:      await service.start()   — spawns workers, pings Redis
  3. Use:        await service.normalize(request)
                 await service.normalize_batch(requests)
  4. Stop:       await service.stop()    — drains executor, closes Redis pool

Error handling
───────────────
  - Worker task timeout (asyncio.wait_for on executor future):
    Raises NormalizationError(stage=TYPE1_PIPELINE or TYPE2_PIPELINE).
  - Redis publish failure:
    Logged at WARNING.  The NormalizedResult is still returned to the caller
    (cache failure does not block the result).
  - Cache read failure:
    Treated as a miss; normalisation proceeds normally.
  - Worker process crash (BrokenProcessPool):
    The executor is recreated on the next normalize() call.  The failed
    granule raises NormalizationError(stage=TYPE1_PIPELINE).
"""

from __future__ import annotations

import asyncio
from concurrent.futures import BrokenExecutor, ProcessPoolExecutor
import os
import time
from typing import Optional

from loguru import logger  # type: ignore[import]

from cipas.core.config import Settings
from cipas.normalization.metrics import (
    observe_latency,
    record_batch_size,
    record_cache_result,
    record_granule_processed,
    record_normalization_error,
    record_output_sizes,
    record_redis_op,
    set_worker_queue_depth,
)
from cipas.normalization.models import (
    NormalizationError,
    NormalizationRequest,
    NormalizationStage,
    NormalizedResult,
)
from cipas.normalization.redis_publisher import RedisPublisher
from cipas.normalization.type2 import run_normalization_worker

# ---------------------------------------------------------------------------
# Worker process initialiser
# ---------------------------------------------------------------------------


def _normalization_worker_init(
    java_formatter_jar: str,
    black_version_prefix: str,
    clang_format_major_version: int,
) -> None:
    """
    ProcessPoolExecutor worker initialiser — called once per worker process.

    Pre-warms all tree-sitter grammars (CSTStripper + Canonicalizer) and
    performs the formatter version probe (PrettyPrinter) so these one-time
    costs are paid at pool startup rather than on the first granule.

    Args:
        java_formatter_jar:         Path to google-java-format JAR (may be "").
        black_version_prefix:       Expected black version prefix (may be "").
        clang_format_major_version: Expected clang-format major version (0 = disabled).
    """
    import sys  # noqa: PLC0415

    # Store config in process globals so run_normalization_worker can forward them.
    import cipas.normalization._worker_config as _cfg  # noqa: PLC0415

    _cfg.JAVA_FORMATTER_JAR = java_formatter_jar
    _cfg.BLACK_VERSION_PREFIX = black_version_prefix
    _cfg.CLANG_FORMAT_MAJOR_VERSION = clang_format_major_version

    try:
        # Pre-warm CSTStripper (loads tree-sitter Python/Java/C grammars).
        from cipas.normalization.stripper import CSTStripper  # noqa: PLC0415

        _stripper = CSTStripper()

        # Pre-warm Canonicalizer (loads tree-sitter grammars independently).
        from cipas.normalization.canonicalizer import Canonicalizer  # noqa: PLC0415

        _canonicalizer = Canonicalizer()

        # Pre-warm PrettyPrinter (performs formatter version probes).
        from cipas.normalization.pretty_printer import PrettyPrinter  # noqa: PLC0415

        _printer = PrettyPrinter(
            java_formatter_jar=java_formatter_jar,
            black_version_prefix=black_version_prefix,
            clang_format_major_version=clang_format_major_version,
        )
        _printer.check_versions()

        print(
            f"[cipas-norm-worker pid={os.getpid()}] Worker initialised OK",
            file=sys.stderr,
            flush=True,
        )

    except Exception as exc:
        print(
            f"[cipas-norm-worker pid={os.getpid()}] Worker init WARNING: {exc}",
            file=sys.stderr,
            flush=True,
        )
        # Do not re-raise: a pre-warm failure should not crash the worker.
        # The first actual task will trigger lazy initialisation.


# ---------------------------------------------------------------------------
# NormalizationService
# ---------------------------------------------------------------------------


class NormalizationService:
    """
    Async orchestrator for the CIPAS syntactic normalisation pipeline.

    Owns a ProcessPoolExecutor (for CPU-bound work) and a RedisPublisher
    (for async I/O).  Both are managed within the service lifecycle
    (start / stop).

    Usage (within an async context, e.g. FastAPI lifespan):

        service = NormalizationService(settings)
        await service.start()

        result = await service.normalize(request)
        results = await service.normalize_batch(requests)

        await service.stop()

    Dependency injection:
        The service is stored on app.state.normalization_service and accessed
        via a FastAPI dependency (similar to app.state.pipeline for ingestion).
    """

    def __init__(self, settings: Settings) -> None:
        """
        Construct the service.  Does NOT start the executor or Redis client.

        Call await start() before using normalize() or normalize_batch().

        Args:
            settings: Validated CIPAS settings (from get_settings()).
        """
        self._settings = settings
        self._executor: Optional[ProcessPoolExecutor] = None
        self._publisher: Optional[RedisPublisher] = None

        # Semaphore: limits concurrent pending executor futures to prevent OOM
        # when a large batch arrives.  Bounded by NORMALIZATION_BATCH_SIZE.
        self._semaphore: asyncio.Semaphore = asyncio.Semaphore(
            max(1, settings.NORMALIZATION_BATCH_SIZE)
        )

        # Active futures counter (for queue depth gauge).
        self._pending_count: int = 0
        self._pending_lock: asyncio.Lock = asyncio.Lock()  # type: ignore[var-annotated]

        self._started: bool = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """
        Start the normalisation service.

        Spawns the ProcessPoolExecutor workers (with pre-warm initialiser)
        and constructs the RedisPublisher.  Pings Redis to verify connectivity.

        Raises:
            RuntimeError:       If start() has already been called.
            NormalizationError: If Redis is unreachable at startup.
        """
        if self._started:
            raise RuntimeError("NormalizationService.start() called more than once")

        # ── ProcessPoolExecutor ───────────────────────────────────────────────
        worker_count = self._settings.NORMALIZATION_WORKERS or os.cpu_count() or 2
        logger.info(  # type: ignore[call-arg]
            "NormalizationService: spawning worker pool",
            worker_count=worker_count,
            max_tasks_per_child=self._settings.WORKER_MAX_TASKS_PER_CHILD,
        )

        self._executor = ProcessPoolExecutor(
            max_workers=worker_count,
            max_tasks_per_child=self._settings.WORKER_MAX_TASKS_PER_CHILD,
            initializer=_normalization_worker_init,
            initargs=(
                self._settings.JAVA_FORMATTER_JAR,
                self._settings.BLACK_VERSION_PREFIX,
                self._settings.CLANG_FORMAT_MAJOR_VERSION,
            ),
        )

        # ── RedisPublisher ────────────────────────────────────────────────────
        logger.info(  # type: ignore[call-arg]
            "NormalizationService: connecting to Redis",
            redis_url_redacted=True,
        )
        self._publisher = RedisPublisher.from_url(
            self._settings.REDIS_URL,
            ttl_seconds=self._settings.NORMALIZATION_TTL_SECONDS,
            max_connections=10,
            socket_connect_timeout=self._settings.HEALTH_CHECK_TIMEOUT_SECONDS,
        )

        # Verify Redis connectivity at startup.
        redis_ok = await self._publisher.ping()
        if not redis_ok:
            logger.warning(
                "NormalizationService: Redis ping failed at startup — "
                "normalisation results will NOT be cached until Redis is reachable",
            )
        else:
            logger.info("NormalizationService: Redis ping OK")

        self._started = True
        logger.info(  # type: ignore[call-arg]
            "NormalizationService started",
            worker_count=worker_count,
            redis_ttl_seconds=self._settings.NORMALIZATION_TTL_SECONDS,
            batch_size_limit=self._settings.NORMALIZATION_BATCH_SIZE,
            task_timeout_seconds=self._settings.NORMALIZATION_TASK_TIMEOUT,
        )

    async def stop(self) -> None:
        """
        Gracefully shut down the service.

        Waits for in-flight executor futures to complete (up to 30 s), then
        shuts down the executor and closes the Redis connection pool.

        Safe to call even if start() was never called.
        """
        if not self._started:
            return

        logger.info("NormalizationService: shutdown initiated")

        if self._executor is not None:
            _executor = self._executor
            try:
                # wait=True: block until in-flight tasks complete.
                # cancel_futures=False: do not cancel pending tasks, let them finish.
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: _executor.shutdown(wait=True, cancel_futures=False),
                )
            except Exception as exc:
                logger.warning(  # type: ignore[call-arg]
                    "NormalizationService: error during executor shutdown (non-fatal)",
                    error=str(exc),
                )
            finally:
                self._executor = None

        if self._publisher is not None:
            try:
                await self._publisher.aclose()
            except Exception as exc:
                logger.warning(  # type: ignore[call-arg]
                    "NormalizationService: error during Redis client shutdown (non-fatal)",
                    error=str(exc),
                )
            finally:
                self._publisher = None

        self._started = False
        logger.info("NormalizationService: shutdown complete")

    # ------------------------------------------------------------------
    # Single-granule normalisation
    # ------------------------------------------------------------------

    async def normalize(
        self,
        request: NormalizationRequest,
    ) -> NormalizedResult:
        """
        Normalise a single granule through the full Type-1 + Type-2 pipeline.

        Flow:
          1. Check Redis cache (get_cached).  Return immediately on hit.
          2. Submit run_normalization_worker to ProcessPoolExecutor.
          3. Await the future with NORMALIZATION_TASK_TIMEOUT deadline.
          4. Construct NormalizedResult from the worker output dict.
          5. Publish result to Redis (fire-and-forget: cache failure logged,
             not raised).
          6. Record metrics.
          7. Return NormalizedResult.

        Args:
            request: Validated NormalizationRequest for the granule.

        Returns:
            NormalizedResult with type1, type2, hash_type1, hash_type2,
            normalized_at, granule_id, and language.

        Raises:
            NormalizationError: On worker timeout or worker process crash.
            RuntimeError:       If start() was not called before normalize().
        """
        self._assert_started()

        start_time = time.perf_counter()

        # ── Step 1: Cache check ───────────────────────────────────────────────
        cached = await self._get_cached(request.granule_id, request.language)
        if cached is not None:
            return cached

        # ── Step 2–4: CPU-bound work in executor ──────────────────────────────
        result = await self._run_worker(request)

        # ── Step 5: Publish to Redis (non-blocking on failure) ────────────────
        await self._safe_publish(result)

        # ── Step 6: Metrics ───────────────────────────────────────────────────
        elapsed = time.perf_counter() - start_time
        observe_latency(request.language, "both", elapsed)
        record_granule_processed(request.language, success=True)
        record_output_sizes(
            request.language,
            type1_text=result.type1,
            type2_text=result.type2,
        )

        logger.debug(  # type: ignore[call-arg]
            "Granule normalised",
            granule_id=request.granule_id,
            language=request.language,
            elapsed_ms=round(elapsed * 1000, 2),
            hash_type1=result.hash_type1[:12],
            hash_type2=result.hash_type2[:12],
        )

        return result

    # ------------------------------------------------------------------
    # Batch normalisation
    # ------------------------------------------------------------------

    async def normalize_batch(
        self,
        requests: list[NormalizationRequest],
    ) -> list[NormalizedResult]:
        """
        Normalise a list of granules concurrently.

        Flow:
          1. Batch cache lookup via Redis MGET (one round-trip).
          2. For cache misses, submit all worker tasks concurrently to executor.
          3. Await all futures with individual task timeouts.
          4. Publish all new results to Redis via pipeline (one round-trip).
          5. Record batch metrics.
          6. Return results in the same order as the input requests.

        Args:
            requests: List of NormalizationRequest instances.  Maximum length
                      is NORMALIZATION_BATCH_SIZE (validated by the caller).

        Returns:
            List of NormalizedResult, one per request, in input order.

        Raises:
            ValueError:         If requests is empty.
            NormalizationError: If any worker task fails (all other results
                                are still returned; failed granules raise).
        """
        self._assert_started()

        if not requests:
            raise ValueError("normalize_batch() requires at least one request")

        record_batch_size(len(requests))

        start_time = time.perf_counter()

        # ── Step 1: Batch cache lookup ────────────────────────────────────────
        granule_ids = [r.granule_id for r in requests]
        cache_map = await self._get_batch_cached(granule_ids)

        # Separate hits from misses.
        results: list[Optional[NormalizedResult]] = [None] * len(requests)
        miss_indices: list[int] = []
        _ = None  # suppress unused variable warning for zip without strict

        for idx, request in enumerate(requests):
            hit = cache_map.get(request.granule_id)
            if hit is not None:
                results[idx] = hit
                record_cache_result(request.language, hit=True)
            else:
                miss_indices.append(idx)

        if not miss_indices:
            # All hits — return immediately.
            total_elapsed = time.perf_counter() - start_time
            logger.debug(  # type: ignore[call-arg]
                "Batch normalisation complete (all cache hits)",
                batch_size=len(requests),
                elapsed_ms=round(total_elapsed * 1000, 2),
            )
            return results  # type: ignore[return-value]

        # ── Step 2–3: Submit worker tasks for cache misses ────────────────────
        miss_requests = [requests[i] for i in miss_indices]
        miss_results = await self._run_workers_concurrent(miss_requests)

        # Place results back in original order.
        for original_idx, miss_result in zip(miss_indices, miss_results):
            results[original_idx] = miss_result

        # ── Step 4: Publish new results to Redis ──────────────────────────────
        new_results = [res for res in miss_results if res is not None]
        if new_results and self._publisher is not None:
            try:
                await self._publisher.publish_batch(new_results)
                for _res in new_results:
                    record_redis_op("pipeline_set", success=True)
            except Exception as exc:
                logger.warning(  # type: ignore[call-arg]
                    "Batch Redis publish failed (non-fatal)",
                    error=str(exc),
                    batch_size=len(new_results),
                )
                for _ in new_results:
                    record_redis_op("pipeline_set", success=False)

        # ── Step 5: Metrics ───────────────────────────────────────────────────
        total_elapsed = time.perf_counter() - start_time
        for request in miss_requests:
            record_granule_processed(request.language, success=True)

        logger.debug(  # type: ignore[call-arg]
            "Batch normalisation complete",
            batch_size=len(requests),
            cache_hits=len(requests) - len(miss_indices),
            cache_misses=len(miss_indices),
            elapsed_ms=round(total_elapsed * 1000, 2),
        )

        return results  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> dict[str, object]:
        """
        Return a dict describing the service's health.

        Checks:
          - executor: is the ProcessPoolExecutor alive?
          - redis: can we PING Redis?

        Returns:
            Dict with keys "executor_ok" (bool), "redis_ok" (bool),
            "worker_count" (int), "pending_tasks" (int).
        """
        executor_ok = self._executor is not None and not getattr(
            self._executor, "_broken", False
        )
        redis_ok = False
        if self._publisher is not None:
            redis_ok = await self._publisher.ping()

        return {
            "executor_ok": executor_ok,
            "redis_ok": redis_ok,
            "worker_count": (
                self._settings.NORMALIZATION_WORKERS or os.cpu_count() or 2
            ),
            "pending_tasks": self._pending_count,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _assert_started(self) -> None:
        """Raise RuntimeError if the service has not been started."""
        if not self._started or self._executor is None:
            raise RuntimeError(
                "NormalizationService.start() must be called before normalize(). "
                "Ensure the service is started in the FastAPI lifespan context."
            )

    async def _get_cached(
        self,
        granule_id: str,
        language: str,
    ) -> Optional[NormalizedResult]:
        """
        Try to retrieve a cached result from Redis.

        Returns None on miss, error, or if the publisher is unavailable.
        """
        if self._publisher is None:
            return None

        try:
            result = await self._publisher.get_cached(granule_id)
            is_hit = result is not None
            record_cache_result(language, hit=is_hit)
            record_redis_op("get", success=True, miss=not is_hit)
            return result
        except Exception as exc:
            logger.debug(  # type: ignore[call-arg]
                "Cache lookup failed — treating as miss",
                granule_id=granule_id,
                error=str(exc),
            )
            record_redis_op("get", success=False)
            return None

    async def _get_batch_cached(
        self,
        granule_ids: list[str],
    ) -> dict[str, Optional[NormalizedResult]]:
        """
        Batch cache lookup via Redis MGET.

        Returns a dict mapping granule_id → NormalizedResult (or None on miss).
        Returns all-None dict if publisher is unavailable or MGET fails.
        """
        if self._publisher is None:
            return dict.fromkeys(granule_ids, None)

        try:
            result_map = await self._publisher.get_batch_cached(granule_ids)
            hit_count = sum(1 for v in result_map.values() if v is not None)
            record_redis_op("mget", success=True, miss=(hit_count < len(granule_ids)))
            return result_map
        except Exception as exc:
            logger.debug(  # type: ignore[call-arg]
                "Batch cache lookup failed — treating all as misses",
                batch_size=len(granule_ids),
                error=str(exc),
            )
            record_redis_op("mget", success=False)
            return dict.fromkeys(granule_ids, None)

    async def _run_worker(
        self,
        request: NormalizationRequest,
    ) -> NormalizedResult:
        """
        Submit one granule to the ProcessPoolExecutor and await the result.

        Acquires the semaphore before submitting to bound concurrency.
        Applies asyncio.wait_for with NORMALIZATION_TASK_TIMEOUT.

        Args:
            request: The granule to normalise.

        Returns:
            NormalizedResult.

        Raises:
            NormalizationError: On timeout or worker crash.
        """
        request_dict = request.to_worker_dict()
        # Inject formatter config so worker uses the same version pins.
        request_dict["java_formatter_jar"] = self._settings.JAVA_FORMATTER_JAR
        request_dict["black_version_prefix"] = self._settings.BLACK_VERSION_PREFIX
        request_dict["clang_format_major_version"] = (
            self._settings.CLANG_FORMAT_MAJOR_VERSION
        )

        loop = asyncio.get_running_loop()

        async with self._semaphore:
            async with self._make_pending_ctx():
                try:
                    worker_result: dict[str, str] = await asyncio.wait_for(
                        loop.run_in_executor(
                            self._executor,
                            run_normalization_worker,
                            request_dict,
                        ),
                        timeout=self._settings.NORMALIZATION_TASK_TIMEOUT,
                    )
                except asyncio.TimeoutError as exc:
                    msg = (
                        f"Normalisation worker timed out after "
                        f"{self._settings.NORMALIZATION_TASK_TIMEOUT}s "
                        f"for granule {request.granule_id!r}"
                    )
                    logger.warning(  # type: ignore[call-arg]
                        "Normalisation worker timeout",
                        granule_id=request.granule_id,
                        language=request.language,
                        timeout_seconds=self._settings.NORMALIZATION_TASK_TIMEOUT,
                    )
                    record_normalization_error(
                        request.language, NormalizationStage.TYPE1_PIPELINE.value
                    )
                    record_granule_processed(request.language, success=False)
                    raise NormalizationError(
                        granule_id=request.granule_id,
                        language=request.language,
                        stage=NormalizationStage.TYPE1_PIPELINE,
                        reason=msg,
                        cause=exc,
                    ) from exc

                except BrokenExecutor as exc:
                    msg = (
                        f"Normalisation worker pool is broken — "
                        f"granule {request.granule_id!r}: {exc}"
                    )
                    logger.error(  # type: ignore[call-arg]
                        "Normalisation worker pool broken",
                        granule_id=request.granule_id,
                        language=request.language,
                        error=str(exc),
                    )
                    record_normalization_error(
                        request.language, NormalizationStage.TYPE1_PIPELINE.value
                    )
                    record_granule_processed(request.language, success=False)
                    # Attempt to recreate the executor for subsequent requests.
                    await self._recreate_executor()
                    raise NormalizationError(
                        granule_id=request.granule_id,
                        language=request.language,
                        stage=NormalizationStage.TYPE1_PIPELINE,
                        reason=msg,
                        cause=exc,
                    ) from exc

        return self._build_result(request, worker_result)

    async def _run_workers_concurrent(
        self,
        requests: list[NormalizationRequest],
    ) -> list[NormalizedResult]:
        """
        Submit multiple granules to the executor and gather results.

        All tasks run concurrently (bounded by the semaphore).  Individual
        failures raise NormalizationError but do not cancel sibling tasks
        (asyncio.gather with return_exceptions=False would cancel on first
        failure; we use gather tasks individually to collect partial results).

        Returns results in the same order as requests.  Raises
        NormalizationError for the first failing granule after all tasks
        complete; callers that need partial results should catch and handle
        individually.

        Args:
            requests: List of NormalizationRequest for cache-miss granules.

        Returns:
            List of NormalizedResult in input order.

        Raises:
            NormalizationError: If any worker task fails.
        """
        tasks = [self._run_worker(req) for req in requests]
        gathered = await asyncio.gather(*tasks, return_exceptions=True)

        # Separate successes from failures.
        output: list[NormalizedResult] = []
        first_error: Optional[NormalizationError] = None

        for req, result in zip(requests, gathered):
            if isinstance(result, BaseException):
                if first_error is None and isinstance(result, NormalizationError):
                    first_error = result
                elif first_error is None:
                    first_error = NormalizationError(
                        granule_id=req.granule_id,
                        language=req.language,
                        stage=NormalizationStage.TYPE1_PIPELINE,
                        reason=str(result),
                        cause=result,
                    )
                # Append a placeholder so caller can identify failed positions.
                output.append(None)  # type: ignore[arg-type]
            else:
                output.append(result)  # type: ignore[arg-type]

        if first_error is not None:
            raise first_error

        return output

    async def _safe_publish(self, result: NormalizedResult) -> None:
        """
        Publish a result to Redis, logging (but not raising) on failure.

        Cache failures are non-fatal: the normalisation result is still
        returned to the caller.

        Args:
            result: The NormalizedResult to cache.
        """
        if self._publisher is None:
            return

        try:
            await self._publisher.publish(result)
            record_redis_op("set", success=True)
        except NormalizationError as exc:
            logger.warning(  # type: ignore[call-arg]
                "Redis publish failed — result not cached",
                granule_id=result.granule_id,
                language=result.language,
                stage=exc.stage.value,
                reason=exc.reason,
            )
            record_redis_op("set", success=False)
            record_normalization_error(result.language, exc.stage.value)
        except Exception as exc:
            logger.warning(  # type: ignore[call-arg]
                "Unexpected error during Redis publish — result not cached",
                granule_id=result.granule_id,
                language=result.language,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            record_redis_op("set", success=False)

    @staticmethod
    def _build_result(
        request: NormalizationRequest,
        worker_dict: dict[str, str],
    ) -> NormalizedResult:
        """
        Construct a NormalizedResult from a worker output dict.

        The worker returns a plain dict (pickle-safe) with keys:
          type1, hash_type1, type2, hash_type2.

        This method adds the granule_id, language, and normalized_at fields
        and constructs the validated, frozen NormalizedResult.

        Args:
            request:     The original NormalizationRequest.
            worker_dict: Plain dict returned by run_normalization_worker().

        Returns:
            Validated NormalizedResult.

        Raises:
            NormalizationError: If the worker dict is malformed or the hash
                                cross-field validator fails.
        """
        try:
            return NormalizedResult(
                granule_id=request.granule_id,
                language=request.language,
                type1=worker_dict["type1"],
                type2=worker_dict["type2"],
                hash_type1=worker_dict["hash_type1"],
                hash_type2=worker_dict["hash_type2"],
                normalized_at=NormalizedResult.now_utc_iso(),
            )
        except (KeyError, ValueError) as exc:
            raise NormalizationError(
                granule_id=request.granule_id,
                language=request.language,
                stage=NormalizationStage.HASH,
                reason=f"Failed to construct NormalizedResult from worker output: {exc}",
                cause=exc,
            ) from exc

    async def _recreate_executor(self) -> None:
        """
        Attempt to recreate the ProcessPoolExecutor after a BrokenProcessPool error.

        Called after a BrokenExecutor exception to restore the worker pool for
        subsequent requests.  Logs the outcome but does not raise.
        """
        try:
            if self._executor is not None:
                self._executor.shutdown(wait=False, cancel_futures=True)
        except Exception:
            pass

        try:
            worker_count = self._settings.NORMALIZATION_WORKERS or os.cpu_count() or 2
            self._executor = ProcessPoolExecutor(
                max_workers=worker_count,
                max_tasks_per_child=self._settings.WORKER_MAX_TASKS_PER_CHILD,
                initializer=_normalization_worker_init,
                initargs=(
                    self._settings.JAVA_FORMATTER_JAR,
                    self._settings.BLACK_VERSION_PREFIX,
                    self._settings.CLANG_FORMAT_MAJOR_VERSION,
                ),
            )
            logger.info(  # type: ignore[call-arg]
                "NormalizationService: ProcessPoolExecutor recreated after crash",
                worker_count=worker_count,
            )
        except Exception as exc:
            logger.error(  # type: ignore[call-arg]
                "NormalizationService: Failed to recreate executor — "
                "normalisation unavailable until restart",
                error=str(exc),
            )
            self._executor = None

    def _make_pending_ctx(self) -> "_PendingIncrementCtx":
        """Return an async context manager that tracks pending task count."""
        return _PendingIncrementCtx(self)  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def worker_count(self) -> int:
        """Number of worker processes in the executor (0 if not started)."""
        if not self._started or self._executor is None:
            return 0
        return self._settings.NORMALIZATION_WORKERS or os.cpu_count() or 2

    @property
    def is_started(self) -> bool:
        """True if start() has been called and stop() has not yet been called."""
        return self._started


# ---------------------------------------------------------------------------
# Pending-task async context manager (module-level — not a nested class)
# ---------------------------------------------------------------------------


class _PendingIncrementCtx:
    """
    Async context manager that increments/decrements NormalizationService._pending_count
    and updates the Prometheus queue depth gauge.

    Defined at module level (not nested inside NormalizationService) to avoid the
    name-shadowing conflict between the class definition and the factory method
    that would occur with a nested class of the same name.
    """

    __slots__ = ("_service",)

    def __init__(self, service: NormalizationService) -> None:
        self._service = service

    async def __aenter__(self) -> None:
        async with self._service._pending_lock:
            self._service._pending_count += 1
            set_worker_queue_depth(self._service._pending_count)

    async def __aexit__(
        self,
        exc_type: object,
        exc_val: object,
        exc_tb: object,
    ) -> None:
        async with self._service._pending_lock:
            self._service._pending_count = max(0, self._service._pending_count - 1)
            set_worker_queue_depth(self._service._pending_count)


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "NormalizationService",
]
