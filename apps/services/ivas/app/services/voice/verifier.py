"""Real-time voice verification manager for viva sessions.

Buffers incoming PCM16 audio chunks from the WebSocket stream and
dispatches periodic async verification checks against the student's
enrolled voiceprint.  Results are persisted to voice_auth_events and
optionally pushed to the frontend via WebSocket messages.
"""

import asyncio
import struct
from contextlib import suppress
from uuid import UUID

from app.logging_config import get_logger
from app.services.voice.speaker import (
    classify_confidence,
    cosine_similarity,
    deserialize_embedding,
    extract_embedding,
)

logger = get_logger(__name__)

# PCM16 mono 16kHz = 2 bytes per sample
_SAMPLE_RATE = 16000
_BYTES_PER_SAMPLE = 2


def _pcm16_to_wav(pcm16_data: bytes, sample_rate: int = _SAMPLE_RATE) -> bytes:
    """Wrap raw PCM16 mono audio bytes in a WAV header."""
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm16_data)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,  # chunk size
        1,  # PCM format
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + pcm16_data


class VoiceVerificationManager:
    """Buffers student audio and runs periodic voice verification checks.

    One instance per viva session.  The ``accumulate_chunk`` method is
    called from the WebSocket audio-bridge task for every inbound audio
    chunk.  When enough audio has been buffered (controlled by
    ``voice_verify_interval_seconds``), the buffer is extracted and an
    async verification task is dispatched — the audio bridge is *never*
    blocked.

    Results are written to ``voice_auth_events`` and optionally sent
    to the browser via a WebSocket ``voice_warning`` / ``voice_status``
    message.
    """

    def __init__(self, db, settings) -> None:
        self._db = db
        self._settings = settings
        self._threshold = settings.voice_similarity_threshold
        self._interval_bytes = int(
            settings.voice_verify_interval_seconds * _SAMPLE_RATE * _BYTES_PER_SAMPLE
        )
        # session_id -> bytearray of PCM16 chunks
        self._buffers: dict[str, bytearray] = {}
        # Prevent concurrent buffer extraction for the same session
        self._locks: dict[str, asyncio.Lock] = {}
        # Track whether we've already sent a "no profile" warning
        self._no_profile_warned: set[str] = set()
        # Cache voice profile per session so we don't hit the DB every 3s
        # for a profile that never changes during a session.
        self._profile_cache: dict[str, dict | None] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def accumulate_chunk(
        self,
        session_id: str,
        student_id: str,
        pcm16_chunk: bytes,
        websocket,
    ) -> None:
        """Called for every inbound audio chunk from the WS handler.

        Appends the chunk to the per-session buffer and, if the buffer
        exceeds the configured duration, fires a background verification
        task.
        """
        if session_id not in self._buffers:
            self._buffers[session_id] = bytearray()
            self._locks[session_id] = asyncio.Lock()

        buf = self._buffers[session_id]
        buf.extend(pcm16_chunk)

        if len(buf) >= self._interval_bytes:
            lock = self._locks[session_id]
            if lock.locked():
                # A verification is already in-flight for this session;
                # skip this cycle to avoid queueing up.
                return
            # Extract the buffer contents under lock so the next cycle
            # starts with a fresh buffer.
            async with lock:
                audio_data = bytes(self._buffers[session_id])
                self._buffers[session_id] = bytearray()

            asyncio.create_task(
                self._verify(session_id, student_id, audio_data, websocket)
            )

    def flush(self, session_id: str) -> None:
        """Clear the buffer for a session.  Called on session end."""
        self._buffers.pop(session_id, None)
        self._locks.pop(session_id, None)
        self._no_profile_warned.discard(session_id)
        self._profile_cache.pop(session_id, None)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _verify(
        self,
        session_id: str,
        student_id: str,
        pcm16_data: bytes,
        websocket,
    ) -> None:
        """Extract embedding, compare with stored voiceprint, persist, notify."""
        try:
            wav_bytes = _pcm16_to_wav(pcm16_data)
            # extract_embedding runs a neural network (~50-200ms). Run it in
            # the default thread executor so it doesn't block the asyncio event
            # loop (which would stall audio forwarding and cause choppy audio).
            loop = asyncio.get_running_loop()
            test_embedding = await loop.run_in_executor(None, extract_embedding, wav_bytes)
        except Exception as exc:
            logger.warning(
                "voice_verify_embedding_failed",
                session_id=session_id,
                error=str(exc),
            )
            return

        # Fetch the student's stored voiceprint (cached per session)
        if session_id in self._profile_cache:
            profile = self._profile_cache[session_id]
        else:
            profile = await self._db.get_voice_profile(student_id)
            self._profile_cache[session_id] = profile
        if profile is None:
            if session_id not in self._no_profile_warned:
                self._no_profile_warned.add(session_id)
                with suppress(Exception):
                    await websocket.send_json({
                        "type": "voice_warning",
                        "confidence": "none",
                        "message": "No voice profile enrolled",
                    })
            logger.warning(
                "voice_verify_skip_no_profile",
                session_id=session_id,
                student_id=student_id,
            )
            return

        stored_embedding = deserialize_embedding(profile["embedding"])
        similarity = cosine_similarity(test_embedding, stored_embedding)
        is_match = similarity >= self._threshold
        confidence = classify_confidence(similarity, self._threshold)

        logger.info(
            "voice_verify_result",
            session_id=session_id,
            similarity=round(similarity, 4),
            is_match=is_match,
            confidence=confidence,
        )

        # Persist to DB
        try:
            await self._db.insert_voice_auth_event(
                session_id=UUID(session_id),
                similarity_score=round(similarity, 4),
                is_match=is_match,
                confidence=confidence,
            )
        except Exception as exc:
            logger.error(
                "voice_verify_db_write_failed",
                session_id=session_id,
                error=str(exc),
            )

        # Notify the browser
        msg_type = "voice_warning" if confidence == "low" else "voice_status"
        with suppress(Exception):
            await websocket.send_json({
                "type": msg_type,
                "similarity": round(similarity, 4),
                "confidence": confidence,
                "is_match": is_match,
            })