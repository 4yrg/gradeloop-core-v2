"""Voice enrollment staging backends.

Provides an abstraction for staging voice enrollment samples
before they are averaged and persisted to the database.

Two implementations:
- InMemoryEnrollmentStaging: for development/testing (single-process)
- RedisEnrollmentStaging: for production (multi-worker safe, survives restarts)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Sample keys expire after 30 minutes to prevent stale data
_STAGING_TTL_SECONDS = 1800


class EnrollmentStaging(ABC):
    """Abstract base class for enrollment sample staging."""

    @abstractmethod
    async def store_sample(
        self, student_id: str, sample_index: int, embedding: np.ndarray
    ) -> None:
        """Store a single enrollment sample embedding."""

    @abstractmethod
    async def get_samples(self, student_id: str) -> dict[int, np.ndarray]:
        """Return all staged samples for a student as {index: embedding}."""

    @abstractmethod
    async def get_valid_count(self, student_id: str, required: int) -> int:
        """Count samples with indices in 1..required."""

    @abstractmethod
    async def get_ordered_embeddings(
        self, student_id: str, required: int
    ) -> list[np.ndarray]:
        """Return embeddings for indices 1..required in order."""

    @abstractmethod
    async def clear(self, student_id: str) -> None:
        """Remove all staged samples for a student."""


class InMemoryEnrollmentStaging(EnrollmentStaging):
    """In-process dict staging. Only safe for single-worker development."""

    def __init__(self) -> None:
        self._store: dict[str, dict[int, np.ndarray]] = {}

    async def store_sample(
        self, student_id: str, sample_index: int, embedding: np.ndarray
    ) -> None:
        if student_id not in self._store:
            self._store[student_id] = {}
        self._store[student_id][sample_index] = embedding

    async def get_samples(self, student_id: str) -> dict[int, np.ndarray]:
        return dict(self._store.get(student_id, {}))

    async def get_valid_count(self, student_id: str, required: int) -> int:
        samples = self._store.get(student_id, {})
        return sum(1 for i in range(1, required + 1) if i in samples)

    async def get_ordered_embeddings(
        self, student_id: str, required: int
    ) -> list[np.ndarray]:
        samples = self._store.get(student_id, {})
        return [samples[i] for i in range(1, required + 1) if i in samples]

    async def clear(self, student_id: str) -> None:
        self._store.pop(student_id, None)

    def clear_all(self) -> None:
        """Clear all staged data (for testing)."""
        self._store.clear()


class RedisEnrollmentStaging(EnrollmentStaging):
    """Redis-backed staging. Safe for multi-worker deployments."""

    KEY_PREFIX = "ivas:enrollment"

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _key(self, student_id: str, sample_index: int) -> str:
        return f"{self.KEY_PREFIX}:{student_id}:{sample_index}"

    async def store_sample(
        self, student_id: str, sample_index: int, embedding: np.ndarray
    ) -> None:
        import io

        buf = io.BytesIO()
        np.save(buf, embedding)
        data = buf.getvalue()
        key = self._key(student_id, sample_index)
        await self._redis.set(key, data, ex=_STAGING_TTL_SECONDS)

    async def get_samples(self, student_id: str) -> dict[int, np.ndarray]:
        import io

        pattern = f"{self.KEY_PREFIX}:{student_id}:*"
        keys = []
        async for key in self._redis.scan_iter(match=pattern):
            keys.append(key)

        result: dict[int, np.ndarray] = {}
        for key in keys:
            key_str = key if isinstance(key, str) else key.decode()
            idx_str = key_str.rsplit(":", 1)[-1]
            try:
                idx = int(idx_str)
            except ValueError:
                continue
            data = await self._redis.get(key)
            if data:
                result[idx] = np.load(io.BytesIO(data))
        return result

    async def get_valid_count(self, student_id: str, required: int) -> int:
        samples = await self.get_samples(student_id)
        return sum(1 for i in range(1, required + 1) if i in samples)

    async def get_ordered_embeddings(
        self, student_id: str, required: int
    ) -> list[np.ndarray]:
        samples = await self.get_samples(student_id)
        return [samples[i] for i in range(1, required + 1) if i in samples]

    async def clear(self, student_id: str) -> None:
        pattern = f"{self.KEY_PREFIX}:{student_id}:*"
        async for key in self._redis.scan_iter(match=pattern):
            await self._redis.delete(key)