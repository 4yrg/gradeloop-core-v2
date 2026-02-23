"""
Async skeleton consumer for Redis Streams.

This module provides a minimal, production-minded skeleton for consuming messages
from Redis Streams using the asyncio-capable `redis.asyncio` client.

- Creates consumer group if not present.
- Reads messages in a loop with XREADGROUP.
- Calls `process_message` hook which should be implemented by callers/subclasses.
- Acknowledges messages (XACK) after successful processing.
- Includes graceful shutdown and simple retry/backoff behavior.

Notes:
- This file is intended as a starting point and intentionally keeps the
  business-logic-free. Replace `process_message` with actual analysis/handling logic.
- All operations are async-first.
"""

from __future__ import annotations

import asyncio
import os
import signal
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, Iterable, List, Optional, Tuple

from loguru import logger

try:
    import redis.asyncio as aioredis  # type: ignore
except (
    Exception
):  # pragma: no cover - defensive import for environments without redis installed
    aioredis = None  # type: ignore


class RedisStreamConsumerError(RuntimeError):
    """Base error for RedisStreamConsumer."""


class RedisStreamConsumer:
    """
    High-level Redis Streams consumer.

    Parameters
    ----------
    redis_client:
        An instance of `redis.asyncio.Redis`.
    stream:
        The stream key name (e.g. 'cipas:tasks').
    group:
        Consumer group name (e.g. 'cipas-group').
    consumer_name:
        Unique consumer name within the group (e.g. 'worker-1').
    read_count:
        Maximum number of messages to fetch per XREADGROUP call.
    block_ms:
        Milliseconds to block waiting for messages (0=block forever, None=do not block).
    """

    def __init__(
        self,
        redis_client: Any,
        stream: str,
        group: str,
        consumer_name: str,
        read_count: int = 10,
        block_ms: int = 1000,
    ) -> None:
        if aioredis is None:
            raise RedisStreamConsumerError(
                "redis.asyncio is not available in this environment"
            )

        self.redis = redis_client
        self.stream = stream
        self.group = group
        self.consumer_name = consumer_name
        self.read_count = read_count
        self.block_ms = block_ms
        self._running = False
        self._task: Optional[asyncio.Task[None]] = None
        self._backoff_seconds = 1.0

    async def ensure_group(self) -> None:
        """
        Ensure consumer group exists for the stream. If the stream doesn't exist, create it via MKSTREAM.
        """
        try:
            # XGROUP CREATE <key> <groupname> $ MKSTREAM
            await self.redis.xgroup_create(
                name=self.stream, groupname=self.group, id="$", mkstream=True
            )
            logger.info(
                "Created consumer group '%s' for stream '%s'", self.group, self.stream
            )
        except Exception as exc:  # pragma: no cover - depends on Redis behavior
            # Redis raises a BusyGroupError if group exists
            msg = str(exc)
            if "BUSYGROUP" in msg or "BUSYGROUP" in msg.upper():
                logger.debug(
                    "Consumer group '%s' already exists for stream '%s'",
                    self.group,
                    self.stream,
                )
                return
            # Some Redis clients throw ResponseError with text, catch generically and re-raise if unexpected
            logger.exception("Failed to create/verify consumer group: %s", exc)
            raise

    async def start(self) -> None:
        """
        Start the consumer loop in background.

        The background loop can be stopped using `stop()` which will cancel the task.
        """
        if self._running:
            logger.warning("Consumer already running")
            return

        await self.ensure_group()
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "Started RedisStreamConsumer for stream=%s group=%s consumer=%s",
            self.stream,
            self.group,
            self.consumer_name,
        )

    async def stop(self) -> None:
        """
        Stop the consumer loop gracefully.
        """
        if not self._running:
            return
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                logger.debug("Consumer task cancelled")
        logger.info("Stopped RedisStreamConsumer for stream=%s", self.stream)

    async def _run_loop(self) -> None:
        """
        Internal loop that continuously reads from the stream and processes messages.
        """
        while self._running:
            try:
                # XREADGROUP: block for block_ms milliseconds waiting for new messages.
                # Note: we read from the group with '>' to get new messages delivered to consumers.
                result = await self.redis.xreadgroup(
                    groupname=self.group,
                    consumername=self.consumer_name,
                    streams={self.stream: ">"},
                    count=self.read_count,
                    block=self.block_ms,
                )

                if not result:
                    # no messages; reset backoff and continue
                    self._backoff_seconds = 1.0
                    continue

                # result is list of (stream, [(id, {field: value})])
                for stream_key, messages in result:
                    for msg_id, fields in messages:
                        # Process each message
                        processed_ok = False
                        try:
                            # convert bytes keys/values to str where applicable
                            payload = self._decode_fields(fields)
                            await self.process_message(msg_id=msg_id, payload=payload)
                            processed_ok = True
                        except asyncio.CancelledError:
                            logger.debug("Processing cancelled for message %s", msg_id)
                            raise
                        except Exception as exc:
                            logger.exception(
                                "Failed to process message %s: %s", msg_id, exc
                            )
                            # On failure, decide whether to ack or leave for reprocessing; default = leave
                            processed_ok = False

                        if processed_ok:
                            try:
                                await self.redis.xack(self.stream, self.group, msg_id)
                            except Exception:
                                logger.exception(
                                    "Failed to acknowledge message %s", msg_id
                                )

                # reset backoff after successful processing
                self._backoff_seconds = 1.0

            except asyncio.CancelledError:
                logger.info("Consumer loop cancelled, exiting")
                break
            except Exception as exc:  # pragma: no cover - integration behavior
                logger.exception("Redis consumer encountered an error: %s", exc)
                # exponential backoff on errors to avoid busy loop
                await asyncio.sleep(self._backoff_seconds)
                self._backoff_seconds = min(self._backoff_seconds * 2, 30.0)

    async def process_message(self, msg_id: str, payload: Dict[str, Any]) -> None:
        """
        Process a single message.

        Override this method to implement business logic. It MUST be async.

        Parameters
        ----------
        msg_id:
            Redis Stream message ID.
        payload:
            A dict of message fields (str -> str). Binary data will be decoded as UTF-8.
        """
        # NB: This is a stub. Replace with meaningful logic or subclass and override.
        logger.info("Received message %s: %s", msg_id, payload)
        # Simulate small async work
        await asyncio.sleep(0.01)

    @staticmethod
    def _decode_fields(fields: Dict[bytes, bytes]) -> Dict[str, str]:
        """
        Convert a fields mapping of bytes to bytes into str->str for easier consumption.
        """
        decoded: Dict[str, str] = {}
        for k, v in fields.items():
            key = k.decode("utf-8") if isinstance(k, (bytes, bytearray)) else str(k)
            if isinstance(v, (bytes, bytearray)):
                try:
                    decoded_value = v.decode("utf-8")
                except Exception:
                    # Fallback to repr if binary not UTF-8
                    decoded_value = repr(v)
            else:
                decoded_value = str(v)
            decoded[key] = decoded_value
        return decoded


# Convenience context manager for ephemeral consumers
@asynccontextmanager
async def create_consumer_from_env(
    *,
    stream_env: str = "CIPAS_STREAM",
    group_env: str = "CIPAS_GROUP",
    consumer_env: str = "CIPAS_CONSUMER",
    redis_url_env: str = "CIPAS_REDIS_URL",
    **kwargs: Any,
) -> AsyncIterator[RedisStreamConsumer]:
    """
    Create a RedisStreamConsumer using environment variables.

    Environment variables:
    - CIPAS_STREAM (required)
    - CIPAS_GROUP (defaults to 'cipas-group' if not provided)
    - CIPAS_CONSUMER (defaults to hostname + pid)
    - CIPAS_REDIS_URL (required, e.g. redis://localhost:6379/0)
    """
    stream = os.getenv(stream_env)
    if not stream:
        raise RedisStreamConsumerError(f"{stream_env} is not set")

    redis_url = os.getenv(redis_url_env)
    if not redis_url:
        raise RedisStreamConsumerError(f"{redis_url_env} is not set")

    group = os.getenv(group_env, "cipas-group")
    consumer_name = os.getenv(consumer_env, f"{os.uname().nodename}-{os.getpid()}")

    client = aioredis.from_url(redis_url)

    consumer = RedisStreamConsumer(
        redis_client=client,
        stream=stream,
        group=group,
        consumer_name=consumer_name,
        **kwargs,
    )

    try:
        await consumer.start()
        yield consumer
    finally:
        await consumer.stop()
        try:
            await client.close()
        except Exception:
            logger.exception("Failed to close redis client")


# Example runnable when executed directly (useful for local development)
async def _main() -> None:
    """
    Basic example usage:

    export CIPAS_REDIS_URL=redis://localhost:6379/0
    export CIPAS_STREAM=cipas:tasks
    python -m cipas.services.queue.queue
    """
    # Use environment-based factory
    async with create_consumer_from_env() as consumer:  # type: ignore
        # Install signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()
        stop_event = asyncio.Event()

        def _on_signal(*_: Any) -> None:
            logger.info("Received shutdown signal")
            stop_event.set()

        for s in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(s, _on_signal)
            except NotImplementedError:
                # Some platforms (Windows) don't support add_signal_handler in asyncio loop
                pass

        logger.info("Consumer running. Waiting for shutdown signal.")
        await stop_event.wait()
        logger.info("Shutdown requested. Exiting.")


if __name__ == "__main__":  # pragma: no cover - manual run
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")

__all__ = [
    "RedisStreamConsumer",
    "create_consumer_from_env",
    "RedisStreamConsumerError",
]
