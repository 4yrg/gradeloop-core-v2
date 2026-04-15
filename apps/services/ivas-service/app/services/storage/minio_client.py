"""MinIO client for storing voice verification audio clips.

Stores PCM16 audio chunks from viva sessions so instructors can
review voice verification events. Non-blocking: if MinIO is
unavailable, verification proceeds without audio storage.
"""

from app.logging_config import get_logger

logger = get_logger(__name__)


class MinioClient:
    """Async MinIO client for IVAS audio storage."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        use_ssl: bool = False,
    ):
        self._endpoint = endpoint
        self._access_key = access_key
        self._secret_key = secret_key
        self._bucket = bucket
        self._use_ssl = use_ssl
        self._client = None

    async def connect(self) -> None:
        """Initialize the MinIO client and ensure the bucket exists."""
        from minio import Minio as SyncMinio

        self._client = SyncMinio(
            self._endpoint,
            access_key=self._access_key,
            secret_key=self._secret_key,
            secure=self._use_ssl,
        )

        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)
            logger.info("ivas_minio_bucket_created", bucket=self._bucket)

        logger.info(
            "ivas_minio_ready",
            endpoint=self._endpoint,
            bucket=self._bucket,
        )

    def upload_audio(
        self,
        session_id: str,
        event_id: str,
        pcm16_bytes: bytes,
        content_type: str = "audio/pcm",
    ) -> str:
        """Upload PCM16 audio bytes to MinIO synchronously.

        Returns the object key for storage in voice_auth_events.audio_ref.
        """
        from io import BytesIO

        object_key = f"sessions/{session_id}/voice/{event_id}.pcm"
        data = BytesIO(pcm16_bytes)
        data_length = len(pcm16_bytes)

        self._client.put_object(
            self._bucket,
            object_key,
            data,
            data_length,
            content_type=content_type,
        )
        logger.info(
            "ivas_audio_uploaded",
            object_key=object_key,
            size=data_length,
        )
        return object_key

    def get_presigned_url(self, object_key: str, expiry_seconds: int = 3600) -> str:
        """Get a presigned URL for audio playback."""
        from datetime import timedelta

        return self._client.presigned_get_object(
            self._bucket,
            object_key,
            expires=timedelta(seconds=expiry_seconds),
        )