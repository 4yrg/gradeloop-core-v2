"""
Async Redis publisher for CIPAS normalisation results (E10/US02).

This module is responsible for persisting NormalizedResult payloads to Redis
after the normalisation pipeline completes.  It is the only component in the
normalisation package that performs I/O — all other modules are pure CPU work
and run inside ProcessPoolExecutor workers.

Redis key schema
─────────────────
  cipas:normalized:{granule_id}

  TTL: 3600 seconds (1 hour) — configurable via CIPAS_NORMALIZATION_TTL_SECONDS.

  Value: JSON string of the canonical payload dict:
    {
      "granule_id":    "...",
      "language":      "...",
      "type1":         "...",
      "type2":         "...",
      "hash_type1":    "...",
      "hash_type2":    "...",
      "normalized_at": "..."
    }

Connection management
──────────────────────
RedisPublisher owns a single redis.asyncio.Redis client created at construction
time.  The client maintains a connection pool internally (pool_size=10 by
default in redis-py ≥5.x).  The caller (NormalizationService) is responsible
for calling aclose() during application shutdown to drain the pool cleanly.

The client is created with:
  - decode_responses=False  — we control encoding explicitly via json.dumps()
    and .encode("utf-8") to guarantee deterministic byte output.
  - socket_keepalive=True   — prevents silent connection drops under NAT/firewall
    idle timeouts (common in container-to-container Redis communication).
  - socket_connect_timeout=5.0  — fail fast on startup if Redis is unreachable.
  - retry_on_timeout=True   — transparently retry on transient socket timeouts.
  - health_check_interval=30  — background ping every 30 s to detect stale connections.

JSON serialisation
───────────────────
  json.dumps() with sort_keys=False (key order is already canonical from
  NormalizedResult.to_redis_payload()) and separators=(",", ":") (compact,
  no extra whitespace) to produce the smallest possible payload.

  The JSON is encoded to UTF-8 bytes before passing to Redis SET to ensure
  that the redis-py client never performs implicit codec selection.

Cache read (get_cached)
────────────────────────
  get_cached(granule_id) returns a NormalizedResult if the key exists and
  the payload validates, or None on cache miss / parse error.  A parse error
  (e.g. corrupt or stale payload from a schema migration) logs a WARNING and
  is treated as a cache miss — the pipeline re-normalises the granule.

Retry and error handling
─────────────────────────
  publish() retries once on redis.exceptions.ConnectionError before raising
  NormalizationError(stage=REDIS_PUBLISH).  A single retry handles transient
  connection drops without unbounded latency.  If the retry also fails, the
  error propagates to NormalizationService, which logs it and continues
  (Redis publish failure does not block the normalisation result from being
  returned to the caller — the result is still returned, just not cached).

  All Redis operations are guarded by asyncio.wait_for() with a 2-second
  timeout to prevent a slow/hanging Redis from blocking the event loop.

Thread / async safety
──────────────────────
  RedisPublisher is async-safe.  The redis.asyncio.Redis client is internally
  thread-safe and coroutine-safe.  Multiple concurrent publish() calls are
  safe and will be serialised by the Redis connection pool.
  Do NOT share a RedisPublisher instance across multiple event loops.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from loguru import logger

try:
    from redis.asyncio import Redis
    from redis.asyncio.retry import Retry
    from redis.backoff import ExponentialBackoff
    from redis.exceptions import ConnectionError as RedisConnectionError
    from redis.exceptions import RedisError
    from redis.exceptions import TimeoutError as RedisTimeoutError
except ImportError as _redis_import_err:
    raise ImportError(
        "redis[asyncio] must be installed. Run: poetry add 'redis[asyncio,hiredis]'"
    ) from _redis_import_err

from cipas.normalization.models import (
    NormalizationError,
    NormalizationStage,
    NormalizedResult,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default TTL for cached normalisation results.
_DEFAULT_TTL_SECONDS: int = 3600  # 1 hour

# Timeout for individual Redis operations (SET / GET / PING).
_REDIS_OP_TIMEOUT_SECONDS: float = 2.0

# Number of times publish() retries on transient ConnectionError.
_PUBLISH_MAX_RETRIES: int = 1


# ---------------------------------------------------------------------------
# RedisPublisher
# ---------------------------------------------------------------------------


class RedisPublisher:
    """
    Async Redis publisher for normalised granule results.

    Manages a single redis.asyncio.Redis client with an internal connection
    pool.  The client is created at construction time and kept alive for the
    service's lifetime.

    Usage (within an async context):
        publisher = RedisPublisher.from_url("redis://localhost:6379/0", ttl=3600)
        await publisher.publish(normalized_result)
        cached = await publisher.get_cached("granule-uuid-123")
        await publisher.aclose()

    Lifecycle:
        - Create: RedisPublisher.from_url(url, ttl)
        - Use:    publish() / get_cached() / ping()
        - Close:  aclose()  (called by NormalizationService.stop())
    """

    def __init__(
        self,
        client: "Redis[bytes]",
        *,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
    ) -> None:
        """
        Initialise with a pre-constructed Redis client.

        Prefer the from_url() factory method over this constructor unless
        you need to inject a mock client in tests.

        Args:
            client:      A redis.asyncio.Redis instance (owns the pool).
            ttl_seconds: TTL for SET operations.  Default: 3600 (1 hour).
        """
        self._client: "Redis[bytes]" = client
        self._ttl_seconds: int = ttl_seconds

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_url(
        cls,
        url: str,
        *,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
        max_connections: int = 10,
        socket_connect_timeout: float = 5.0,
    ) -> "RedisPublisher":
        """
        Construct a RedisPublisher from a Redis URL string.

        Creates a redis.asyncio.Redis client with:
          - An internal connection pool (max_connections).
          - Socket keepalive to handle NAT/firewall idle drops.
          - Automatic retry on transient ConnectionError (exponential backoff,
            1 retry, capped at 0.5 s delay).
          - decode_responses=False so we control encoding explicitly.

        Args:
            url:                   Redis URL, e.g. "redis://localhost:6379/0"
                                   or "rediss://user:pass@host:6380/1" (TLS).
            ttl_seconds:           TTL in seconds for SET operations.
            max_connections:       Connection pool size.
            socket_connect_timeout: Timeout in seconds for initial TCP connect.

        Returns:
            A ready-to-use RedisPublisher instance.
        """
        retry_policy = Retry(
            ExponentialBackoff(cap=0.5, base=0.1),
            retries=_PUBLISH_MAX_RETRIES,
            supported_errors=(RedisConnectionError, RedisTimeoutError),
        )

        client: "Redis[bytes]" = Redis.from_url(
            url,
            decode_responses=False,
            max_connections=max_connections,
            socket_keepalive=True,
            socket_connect_timeout=socket_connect_timeout,
            socket_timeout=_REDIS_OP_TIMEOUT_SECONDS,
            retry_on_timeout=True,
            retry=retry_policy,
            health_check_interval=30,
        )

        logger.debug(
            "RedisPublisher created",
            url=_redact_url(url),
            ttl_seconds=ttl_seconds,
            max_connections=max_connections,
        )

        return cls(client=client, ttl_seconds=ttl_seconds)

    # ------------------------------------------------------------------
    # Publish
    # ------------------------------------------------------------------

    async def publish(self, result: NormalizedResult) -> None:
        """
        Persist a NormalizedResult to Redis with the configured TTL.

        Serialises the result to compact JSON (UTF-8), then issues a Redis SET
        with EX (TTL in seconds).

        The key is result.redis_key → cipas:normalized:{granule_id}.

        On transient ConnectionError, retries once (handled by the client's
        built-in retry policy).  If the retry fails, raises NormalizationError
        with stage=REDIS_PUBLISH so the caller can decide whether to propagate
        or ignore the cache failure.

        Args:
            result: The fully validated NormalizedResult to store.

        Raises:
            NormalizationError: If the Redis SET fails after retries.
        """
        key: str = result.redis_key
        payload_bytes: bytes = _serialize(result)

        try:
            await asyncio.wait_for(
                self._client.set(
                    name=key,
                    value=payload_bytes,
                    ex=self._ttl_seconds,
                ),
                timeout=_REDIS_OP_TIMEOUT_SECONDS,
            )
            logger.debug(
                "Normalisation result published to Redis",
                redis_key=key,
                granule_id=result.granule_id,
                language=result.language,
                ttl_seconds=self._ttl_seconds,
                payload_bytes=len(payload_bytes),
            )

        except asyncio.TimeoutError as exc:
            msg = (
                f"Redis SET timed out after {_REDIS_OP_TIMEOUT_SECONDS}s "
                f"for key {key!r}"
            )
            logger.warning(
                "Redis publish timeout",
                redis_key=key,
                granule_id=result.granule_id,
                timeout_seconds=_REDIS_OP_TIMEOUT_SECONDS,
            )
            raise NormalizationError(
                granule_id=result.granule_id,
                language=result.language,
                stage=NormalizationStage.REDIS_PUBLISH,
                reason=msg,
                cause=exc,
            ) from exc

        except RedisError as exc:
            msg = f"Redis SET failed for key {key!r}: {exc}"
            logger.warning(
                "Redis publish error",
                redis_key=key,
                granule_id=result.granule_id,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise NormalizationError(
                granule_id=result.granule_id,
                language=result.language,
                stage=NormalizationStage.REDIS_PUBLISH,
                reason=msg,
                cause=exc,
            ) from exc

    # ------------------------------------------------------------------
    # Cache read
    # ------------------------------------------------------------------

    async def get_cached(self, granule_id: str) -> Optional[NormalizedResult]:
        """
        Retrieve a cached NormalizedResult for the given granule_id.

        Looks up cipas:normalized:{granule_id} in Redis, deserialises the
        JSON payload, and reconstructs a NormalizedResult.

        Returns None on:
          - Cache miss (key does not exist or has expired).
          - Deserialisation failure (corrupt payload, schema mismatch).
          - Redis connectivity error (logged as WARNING; treated as miss).
          - Timeout (treated as miss).

        Args:
            granule_id: The granule identifier string.

        Returns:
            NormalizedResult if the cache entry is valid, else None.
        """
        key = f"cipas:normalized:{granule_id}"

        try:
            raw: Optional[bytes] = await asyncio.wait_for(
                self._client.get(key),
                timeout=_REDIS_OP_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Redis GET timed out — treating as cache miss",
                redis_key=key,
                granule_id=granule_id,
                timeout_seconds=_REDIS_OP_TIMEOUT_SECONDS,
            )
            return None
        except RedisError as exc:
            logger.warning(
                "Redis GET failed — treating as cache miss",
                redis_key=key,
                granule_id=granule_id,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            return None

        if raw is None:
            # Cache miss.
            return None

        try:
            payload: dict[str, str] = json.loads(raw.decode("utf-8"))
            result = NormalizedResult.from_redis_payload(payload)
            logger.debug(
                "Cache hit",
                redis_key=key,
                granule_id=granule_id,
                language=result.language,
            )
            return result

        except (json.JSONDecodeError, KeyError, ValueError, UnicodeDecodeError) as exc:
            logger.warning(
                "Corrupt or invalid Redis payload — treating as cache miss",
                redis_key=key,
                granule_id=granule_id,
                error=str(exc),
                error_type=type(exc).__name__,
            )
            return None

    # ------------------------------------------------------------------
    # Bulk operations
    # ------------------------------------------------------------------

    async def publish_batch(self, results: list[NormalizedResult]) -> list[bool]:
        """
        Publish a list of NormalizedResult objects using a Redis pipeline.

        Uses a redis.asyncio Pipeline to batch all SET commands into a single
        round-trip.  More efficient than calling publish() in a loop when
        normalising a large batch of granules.

        Args:
            results: List of validated NormalizedResult objects.

        Returns:
            List of booleans, one per result.  True = successfully published,
            False = failed (error is logged at WARNING level).
        """
        if not results:
            return []

        success_flags: list[bool] = [False] * len(results)

        try:
            async with self._client.pipeline(transaction=False) as pipe:
                for result in results:
                    key = result.redis_key
                    payload_bytes = _serialize(result)
                    await pipe.set(
                        name=key,
                        value=payload_bytes,
                        ex=self._ttl_seconds,
                    )

                responses = await asyncio.wait_for(
                    pipe.execute(raise_on_error=False),
                    timeout=_REDIS_OP_TIMEOUT_SECONDS * len(results),
                )

            for idx, (result, response) in enumerate(zip(results, responses)):
                if isinstance(response, RedisError):
                    logger.warning(
                        "Redis pipeline SET failed for one result",
                        redis_key=result.redis_key,
                        granule_id=result.granule_id,
                        error=str(response),
                    )
                    success_flags[idx] = False
                else:
                    success_flags[idx] = True

        except asyncio.TimeoutError as exc:
            logger.warning(
                "Redis pipeline timed out during batch publish",
                batch_size=len(results),
                timeout_seconds=_REDIS_OP_TIMEOUT_SECONDS * len(results),
            )
            # All flags remain False.

        except RedisError as exc:
            logger.warning(
                "Redis pipeline error during batch publish",
                batch_size=len(results),
                error=str(exc),
                error_type=type(exc).__name__,
            )
            # All flags remain False.

        published_count = sum(success_flags)
        logger.debug(
            "Batch publish complete",
            total=len(results),
            published=published_count,
            failed=len(results) - published_count,
        )

        return success_flags

    async def get_batch_cached(
        self,
        granule_ids: list[str],
    ) -> dict[str, Optional[NormalizedResult]]:
        """
        Retrieve cached results for multiple granule IDs in one pipeline round-trip.

        Args:
            granule_ids: List of granule identifier strings.

        Returns:
            Dict mapping granule_id → NormalizedResult (or None on miss/error).
        """
        if not granule_ids:
            return {}

        keys = [f"cipas:normalized:{gid}" for gid in granule_ids]
        output: dict[str, Optional[NormalizedResult]] = {}

        try:
            raw_values: list[Optional[bytes]] = await asyncio.wait_for(
                self._client.mget(keys),
                timeout=_REDIS_OP_TIMEOUT_SECONDS * max(1, len(granule_ids) // 50),
            )
        except (asyncio.TimeoutError, RedisError) as exc:
            logger.warning(
                "Redis MGET failed during batch cache lookup",
                batch_size=len(granule_ids),
                error=str(exc),
                error_type=type(exc).__name__,
            )
            return {gid: None for gid in granule_ids}

        for granule_id, raw in zip(granule_ids, raw_values):
            if raw is None:
                output[granule_id] = None
                continue
            try:
                payload = json.loads(raw.decode("utf-8"))
                output[granule_id] = NormalizedResult.from_redis_payload(payload)
            except (
                json.JSONDecodeError,
                KeyError,
                ValueError,
                UnicodeDecodeError,
            ) as exc:
                logger.warning(
                    "Corrupt Redis payload in batch GET — treating as miss",
                    granule_id=granule_id,
                    error=str(exc),
                )
                output[granule_id] = None

        return output

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def ping(self) -> bool:
        """
        Send a PING to Redis and return True if a PONG is received.

        Used by the service health-check endpoint to verify Redis connectivity.

        Returns:
            True if Redis responds within _REDIS_OP_TIMEOUT_SECONDS, else False.
        """
        try:
            pong = await asyncio.wait_for(
                self._client.ping(),
                timeout=_REDIS_OP_TIMEOUT_SECONDS,
            )
            return bool(pong)
        except (asyncio.TimeoutError, RedisError) as exc:
            logger.warning(
                "Redis PING failed",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            return False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def aclose(self) -> None:
        """
        Close the Redis client and drain the connection pool.

        Must be called during application shutdown.  After calling aclose(),
        all further operations on this publisher will fail.
        """
        try:
            await self._client.aclose()
            logger.debug("RedisPublisher connection pool closed")
        except RedisError as exc:
            logger.warning(
                "Error closing Redis client (non-fatal)",
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "RedisPublisher":
        return self

    async def __aexit__(
        self, exc_type: object, exc_val: object, exc_tb: object
    ) -> None:
        await self.aclose()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _serialize(result: NormalizedResult) -> bytes:
    """
    Serialise a NormalizedResult to compact UTF-8 JSON bytes.

    Uses separators=(",", ":") to produce the minimal JSON representation
    (no spaces after commas or colons).  sort_keys=False preserves the
    canonical insertion order of to_redis_payload() which is already
    deterministic.

    Args:
        result: The validated NormalizedResult to serialise.

    Returns:
        UTF-8 encoded JSON bytes.
    """
    payload_dict = result.to_redis_payload()
    return json.dumps(payload_dict, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )


def _redact_url(url: str) -> str:
    """
    Redact the password from a Redis URL for safe logging.

    Transforms "redis://:secret@host:6379/0" → "redis://:***@host:6379/0".
    URLs without a password are returned unchanged.

    Args:
        url: Redis connection URL string.

    Returns:
        URL with password replaced by "***", or original URL if no password.
    """
    try:
        import urllib.parse

        parsed = urllib.parse.urlparse(url)
        if parsed.password:
            # netloc is user:pass@host:port — rebuild with redacted password.
            netloc = parsed.hostname or ""
            if parsed.port:
                netloc = f"{netloc}:{parsed.port}"
            if parsed.username:
                netloc = f"{parsed.username}:***@{netloc}"
            else:
                netloc = f":***@{netloc}"
            redacted = parsed._replace(netloc=netloc)
            return redacted.geturl()
    except Exception:
        pass
    return url


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    "RedisPublisher",
]
