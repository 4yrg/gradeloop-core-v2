"""Real-time voice verification during viva sessions.

Buffers PCM16 audio chunks from the student's mic during each turn,
and verifies against the stored voiceprint when the turn completes.
Verification runs off the main async thread via asyncio.to_thread
so the audio bridge is never blocked.
"""

import asyncio
from dataclasses import dataclass
from uuid import UUID

from app.logging_config import get_logger
from app.services.voice.speaker import (
    classify_confidence,
    cosine_similarity,
    deserialize_embedding,
    extract_embedding,
    pcm16_to_wav,
)

logger = get_logger(__name__)

# Minimum bytes of PCM16 audio for a reliable embedding.
# At 16kHz mono 16-bit: 1 second = 32000 bytes, so 2 seconds = 64000 bytes.
PCM16_BYTES_PER_SECOND = 16000 * 2  # sample_rate * bytes_per_sample


@dataclass
class VoiceVerifyResult:
    """Result of a single voice verification check during a viva turn."""
    similarity_score: float
    is_match: bool
    confidence: str  # "high" | "medium" | "low"
    mismatch_count: int
    total_checks: int


class TurnVerifier:
    """Manages per-session voice verification state.

    Audio chunks are accumulated during each student turn and verified
    when the turn completes (input_transcription.finished).
    """

    def __init__(
        self,
        student_id: str,
        stored_embedding_bytes: bytes,
        db,
        settings,
        session_id: UUID,
        minio_client=None,
    ):
        self.student_id = student_id
        self.stored_embedding = deserialize_embedding(stored_embedding_bytes)
        self.db = db
        self.settings = settings
        self.session_id = session_id
        self.minio_client = minio_client

        self._audio_buffer = bytearray()
        self._mismatch_count = 0
        self._total_checks = 0

    def accumulate_audio(self, pcm16_bytes: bytes) -> None:
        """Buffer a PCM16 audio chunk from the student's mic."""
        self._audio_buffer.extend(pcm16_bytes)

    def _clear_buffer(self) -> None:
        """Reset the audio buffer for the next turn."""
        self._audio_buffer.clear()

    async def on_student_turn_finished(
        self,
        question_instance_id: UUID | None = None,
    ) -> VoiceVerifyResult | None:
        """Verify the buffered audio against the stored voiceprint.

        Called when input_transcription.finished is True.
        Returns None if verification is skipped (short audio, extraction error).
        """
        min_seconds = self.settings.voice_verification_min_audio_seconds
        min_bytes = int(min_seconds * PCM16_BYTES_PER_SECOND)
        audio_bytes = bytes(self._audio_buffer)

        # Always clear the buffer for the next turn
        self._clear_buffer()

        if len(audio_bytes) < min_bytes:
            logger.info(
                "voice_check_skipped_short_audio",
                session_id=str(self.session_id),
                audio_bytes=len(audio_bytes),
                min_bytes=min_bytes,
            )
            return None

        # Convert raw PCM16 to WAV for Resemblyzer
        wav_bytes = pcm16_to_wav(audio_bytes)

        # Extract embedding off the main thread (CPU-bound Resemblyzer)
        try:
            test_embedding = await asyncio.to_thread(extract_embedding, wav_bytes)
        except ValueError as exc:
            logger.warning(
                "voice_embedding_extraction_failed",
                session_id=str(self.session_id),
                error=str(exc),
            )
            return None
        except Exception as exc:
            logger.error(
                "voice_embedding_extraction_error",
                session_id=str(self.session_id),
                error=str(exc),
            )
            return None

        # Compute similarity
        threshold = self.settings.voice_similarity_threshold
        similarity = cosine_similarity(test_embedding, self.stored_embedding)
        is_match = similarity >= threshold
        confidence = classify_confidence(similarity, threshold)

        self._total_checks += 1
        if not is_match:
            self._mismatch_count += 1

        # Upload audio to MinIO (non-blocking degradation)
        # Run in a thread to avoid blocking the event loop during I/O.
        audio_ref = None
        if self.minio_client is not None:
            try:
                from uuid import uuid4 as _uuid4

                event_id = str(_uuid4())
                audio_ref = await asyncio.to_thread(
                    self.minio_client.upload_audio,
                    str(self.session_id),
                    event_id,
                    audio_bytes,
                )
            except Exception as exc:
                logger.warning(
                    "voice_audio_upload_failed",
                    session_id=str(self.session_id),
                    error=str(exc),
                )

        # Persist to voice_auth_events
        try:
            await self.db.save_voice_auth_event(
                session_id=self.session_id,
                question_instance_id=question_instance_id,
                similarity_score=round(similarity, 4),
                is_match=is_match,
                confidence=confidence,
                audio_ref=audio_ref,
            )
        except Exception as exc:
            logger.error(
                "voice_auth_event_save_failed",
                session_id=str(self.session_id),
                error=str(exc),
            )

        logger.info(
            "voice_check_completed",
            session_id=str(self.session_id),
            similarity=round(similarity, 4),
            is_match=is_match,
            confidence=confidence,
            mismatch_count=self._mismatch_count,
            total_checks=self._total_checks,
        )

        return VoiceVerifyResult(
            similarity_score=round(similarity, 4),
            is_match=is_match,
            confidence=confidence,
            mismatch_count=self._mismatch_count,
            total_checks=self._total_checks,
        )

    def should_flag(self) -> bool:
        """True if mismatch count >= max_mismatches threshold.

        Used to flag the session metadata for instructor review.
        Does NOT terminate the session.
        """
        return self._mismatch_count >= self.settings.voice_verification_max_mismatches