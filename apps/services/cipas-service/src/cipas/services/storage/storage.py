# gradeloop-core-v2/apps/services/cipas-service/src/cipas/services/storage/storage.py
"""
Async storage wrapper for MinIO (S3-compatible) using an async S3 client (e.g. aioboto3).

This module provides a small, async-first wrapper around an S3 client instance that
exposes convenience methods typically needed by the CIPAS service:
- listing buckets/objects
- checking object existence
- fetching object contents as bytes or text
- streaming download into a file-like object

Notes:
- The wrapper intentionally accepts a generic `client` object so it can work with
  aioboto3 clients or other S3-compatible async clients. Behaviour assumes the client
  supports awaitable methods such as `list_buckets`, `list_objects_v2`, `head_object`,
  and `get_object`. The returned `Body` from `get_object` is expected to be a *file-like*
  object. To remain robust across implementations, reads from the `Body` are performed
  inside a threadpool when necessary.
- All I/O operations are async/await oriented.
"""

from __future__ import annotations

import asyncio
from typing import Any, BinaryIO, Dict, List, Optional

from loguru import logger


class StorageError(RuntimeError):
    """Generic storage error wrapper."""


class AsyncMinioStorage:
    """
    Async wrapper around an S3-compatible client for common storage operations.

    Parameters
    ----------
    client:
        An async-capable S3 client instance (for example from `aioboto3.Session().client("s3")`).
        The wrapper will not attempt to create/close the client automatically unless you
        pass an object that provides those methods externally.
    default_bucket:
        Optional default bucket used by convenience methods when a bucket is not provided.
    """

    def __init__(self, client: Any, default_bucket: Optional[str] = None) -> None:
        self._client = client
        self._default_bucket = default_bucket

    @property
    def client(self) -> Any:
        """Expose the underlying client for advanced operations."""
        return self._client

    async def list_buckets(self) -> List[str]:
        """List bucket names available to the credentials."""
        try:
            resp = await self._client.list_buckets()
            buckets = resp.get("Buckets", []) if isinstance(resp, dict) else []
            return [
                b.get("Name") for b in buckets if isinstance(b, dict) and "Name" in b
            ]
        except Exception as exc:  # pragma: no cover - integration runtime
            logger.exception("list_buckets failed")
            raise StorageError("failed to list buckets") from exc

    async def list_objects(
        self, bucket: Optional[str] = None, prefix: str = "", max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        List objects in a bucket under a prefix.

        Returns a list of object metadata dicts (as returned by the S3 API).
        """
        bucket = bucket or self._default_bucket
        if not bucket:
            raise ValueError("bucket must be provided")

        try:
            paginator_params = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": max_keys}
            resp = await self._client.list_objects_v2(**paginator_params)
            contents = resp.get("Contents", []) if isinstance(resp, dict) else []
            return contents
        except Exception as exc:  # pragma: no cover - integration runtime
            logger.exception(
                "list_objects failed for bucket=%s prefix=%s", bucket, prefix
            )
            raise StorageError("failed to list objects") from exc

    async def exists(self, bucket: Optional[str], key: str) -> bool:
        """Check whether an object exists using head_object."""
        bucket = bucket or self._default_bucket
        if not bucket:
            raise ValueError("bucket must be provided")

        try:
            await self._client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception as exc:  # head_object raises on not found or permission errors
            # We avoid assuming the exception type provided by the underlying client,
            # so we inspect the exception message/status when available.
            logger.debug("head_object for %s/%s raised: %s", bucket, key, exc)
            return False

    async def fetch_object_bytes(self, bucket: Optional[str], key: str) -> bytes:
        """
        Fetch an object and return its bytes.

        This method attempts to handle different S3 client behaviours by reading the
        returned `Body` safely. Reading is performed in a threadpool if the `Body.read`
        method is synchronous.
        """
        bucket = bucket or self._default_bucket
        if not bucket:
            raise ValueError("bucket must be provided")

        try:
            response = await self._client.get_object(Bucket=bucket, Key=key)
            body = (
                response.get("Body")
                if isinstance(response, dict)
                else getattr(response, "Body", None)
            )
            if body is None:
                # Some clients return the data directly under a different key; raise for clarity
                raise StorageError("unexpected get_object response structure")

            # Try to read asynchronously if the body has an async read method
            read_meth = getattr(body, "read", None)
            if read_meth is None:
                raise StorageError("object body has no read() method")

            if asyncio.iscoroutinefunction(read_meth):
                data = await read_meth()
            else:
                # run blocking read() in default threadpool
                loop = asyncio.get_running_loop()
                data = await loop.run_in_executor(None, read_meth)

            if isinstance(data, bytes):
                return data
            # If the body returned a file-like or other object, attempt to coerce to bytes
            if isinstance(data, str):
                return data.encode("utf-8")
            raise StorageError("unexpected body read result type")
        except StorageError:
            raise
        except Exception as exc:  # pragma: no cover - integration runtime
            logger.exception("failed to fetch object %s/%s", bucket, key)
            raise StorageError("failed to fetch object") from exc

    async def fetch_code_file(
        self, bucket: Optional[str], key: str, encoding: str = "utf-8"
    ) -> str:
        """
        Fetch an object and decode it to text using the provided encoding.

        This is a convenience method intended for code/text files (small to medium sized).
        """
        raw = await self.fetch_object_bytes(bucket=bucket, key=key)
        try:
            return raw.decode(encoding)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception(
                "failed to decode object %s/%s as %s", bucket, key, encoding
            )
            raise StorageError("failed to decode object") from exc

    async def download_to_fileobj(
        self,
        bucket: Optional[str],
        key: str,
        fileobj: BinaryIO,
        chunk_size: int = 64 * 1024,
    ) -> None:
        """
        Stream an object into a writable file-like object.

        Reads the body in chunks and writes to `fileobj`. If the S3 client's Body object
        supports async iteration or an async read, those are used. Otherwise reading is
        performed in a threadpool.
        """
        bucket = bucket or self._default_bucket
        if not bucket:
            raise ValueError("bucket must be provided")

        try:
            resp = await self._client.get_object(Bucket=bucket, Key=key)
            body = (
                resp.get("Body")
                if isinstance(resp, dict)
                else getattr(resp, "Body", None)
            )
            if body is None:
                raise StorageError("unexpected get_object response structure")

            # Prefer async iterable if available
            if hasattr(body, "__aiter__"):
                async for chunk in body:  # type: ignore[misc]
                    if not chunk:
                        continue
                    fileobj.write(chunk)
                return

            # Prefer async read if present
            read_meth = getattr(body, "read", None)
            if read_meth is None:
                raise StorageError("object body has no read() method")

            if asyncio.iscoroutinefunction(read_meth):
                # async read in a loop to avoid large memory spikes
                while True:
                    chunk = await read_meth(chunk_size)
                    if not chunk:
                        break
                    fileobj.write(chunk)
            else:
                loop = asyncio.get_running_loop()

                def _blocking_stream_reader() -> None:
                    # runs in threadpool
                    while True:
                        chunk = read_meth(chunk_size)
                        if not chunk:
                            break
                        fileobj.write(chunk)

                await loop.run_in_executor(None, _blocking_stream_reader)
        except StorageError:
            raise
        except Exception as exc:  # pragma: no cover - integration runtime
            logger.exception("download_to_fileobj failed for %s/%s", bucket, key)
            raise StorageError("failed to download object to file-like") from exc

    async def get_object_metadata(
        self, bucket: Optional[str], key: str
    ) -> Dict[str, Any]:
        """
        Retrieve metadata for an object using head_object and return the response dict.
        """
        bucket = bucket or self._default_bucket
        if not bucket:
            raise ValueError("bucket must be provided")

        try:
            resp = await self._client.head_object(Bucket=bucket, Key=key)
            return resp if isinstance(resp, dict) else {}
        except Exception as exc:  # pragma: no cover - integration runtime
            logger.exception("head_object failed for %s/%s", bucket, key)
            raise StorageError("failed to get object metadata") from exc


__all__ = ["AsyncMinioStorage", "StorageError"]
