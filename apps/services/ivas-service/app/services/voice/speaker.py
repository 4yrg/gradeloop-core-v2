"""Speaker verification using Resemblyzer.

Resemblyzer extracts d-vector embeddings (256-dim) from audio.
Enrollment averages multiple sample embeddings into a single voiceprint.
Verification compares a new audio embedding against the stored voiceprint
using cosine similarity.
"""

import io
from pathlib import Path

import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav

from app.logging_config import get_logger

logger = get_logger(__name__)

# Singleton encoder — loads the pretrained model once (~50MB)
_encoder: VoiceEncoder | None = None


def _get_encoder() -> VoiceEncoder:
    """Lazy-load the VoiceEncoder singleton."""
    global _encoder
    if _encoder is None:
        logger.info("voice_encoder_loading")
        _encoder = VoiceEncoder()
        logger.info("voice_encoder_ready")
    return _encoder


def extract_embedding(audio_bytes: bytes, sample_rate: int = 16000) -> np.ndarray:
    """Extract a 256-dim speaker embedding from raw audio bytes.

    Args:
        audio_bytes: Raw WAV file bytes.
        sample_rate: Expected sample rate (Resemblyzer expects 16kHz).

    Returns:
        256-dimensional numpy array (the d-vector).
    """
    import soundfile as sf

    audio_data, sr = sf.read(io.BytesIO(audio_bytes))

    # Convert stereo to mono if needed
    if audio_data.ndim > 1:
        audio_data = audio_data.mean(axis=1)

    # Resample to 16kHz if needed
    if sr != sample_rate:
        import librosa
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=sample_rate)

    # Resemblyzer preprocessing (VAD, normalization)
    wav = preprocess_wav(audio_data, source_sr=sample_rate)

    if len(wav) < sample_rate:  # Less than 1 second of voice
        raise ValueError("Audio too short — need at least 1 second of speech.")

    encoder = _get_encoder()
    embedding = encoder.embed_utterance(wav)
    return embedding


def average_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
    """Average multiple embeddings into a single voiceprint.

    This is the standard approach for enrollment — averaging
    multiple samples reduces noise and creates a more robust profile.
    """
    stacked = np.stack(embeddings)
    avg = stacked.mean(axis=0)
    # L2-normalize so cosine similarity = dot product
    avg = avg / np.linalg.norm(avg)
    return avg


def cosine_similarity(embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
    """Compute cosine similarity between two embeddings.

    Returns:
        Float between -1 and 1 (typically 0.5–1.0 for same speaker).
    """
    dot = np.dot(embedding_a, embedding_b)
    norm_a = np.linalg.norm(embedding_a)
    norm_b = np.linalg.norm(embedding_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def serialize_embedding(embedding: np.ndarray) -> bytes:
    """Serialize numpy embedding to bytes for DB storage (BYTEA)."""
    buf = io.BytesIO()
    np.save(buf, embedding)
    return buf.getvalue()


def deserialize_embedding(data: bytes) -> np.ndarray:
    """Deserialize bytes back to numpy embedding."""
    buf = io.BytesIO(data)
    return np.load(buf)


def classify_confidence(similarity: float, threshold: float) -> str:
    """Classify match confidence based on similarity score.

    Args:
        similarity: Cosine similarity score.
        threshold: The configured match threshold.

    Returns:
        'high', 'medium', or 'low'.
    """
    if similarity >= threshold + 0.10:
        return "high"
    elif similarity >= threshold:
        return "medium"
    else:
        return "low"


def pcm16_to_wav(pcm16_bytes: bytes, sample_rate: int = 16000, num_channels: int = 1) -> bytes:
    """Wrap raw PCM16 bytes in a WAV file header.

    The live viva WebSocket streams raw PCM16 16kHz mono audio.
    extract_embedding expects WAV file bytes (uses soundfile.read),
    so we need this conversion for real-time verification.
    """
    import struct

    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm16_bytes)

    header = struct.pack(
        "<4sI4s",
        b"RIFF",
        36 + data_size,
        b"WAVE",
    )
    fmt_chunk = struct.pack(
        "<4sIHHIIHH",
        b"fmt ",
        16,  # chunk size
        1,  # PCM format
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
    )
    data_chunk = struct.pack("<4sI", b"data", data_size)

    return header + fmt_chunk + data_chunk + pcm16_bytes
