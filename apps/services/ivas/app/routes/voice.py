"""Voice enrollment and verification routes."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.config import get_settings
from app.schemas.voice import (
    VoiceEnrollmentOut,
    VoiceProfileStatus,
    VoiceVerifyOut,
)
from app.services.voice.speaker import (
    average_embeddings,
    classify_confidence,
    cosine_similarity,
    deserialize_embedding,
    extract_embedding,
    serialize_embedding,
)

router = APIRouter(prefix="/voice", tags=["voice"])

# In-memory staging for enrollment samples before they're averaged and stored.
# Maps student_id -> list of numpy embeddings collected so far.
_enrollment_staging: dict[str, list] = {}


def _get_db():
    """Get postgres client — injected at app startup."""
    from app.main import postgres_client

    if postgres_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready.",
        )
    return postgres_client


# =============================================================================
# Enrollment
# =============================================================================


@router.post("/enroll", response_model=VoiceEnrollmentOut, status_code=status.HTTP_200_OK)
async def enroll_sample(
    student_id: str = Form(...),
    sample_index: int = Form(..., ge=1, le=5),
    audio: UploadFile = File(..., description="WAV audio file (~10s speech sample)"),
) -> VoiceEnrollmentOut:
    """Submit a single enrollment audio sample.

    Students must submit the required number of samples (default 3).
    Each sample's embedding is extracted and staged in memory.
    Once all samples are collected, they are averaged into a single
    voiceprint and stored in the database.
    """
    settings = get_settings()
    required = settings.voice_enrollment_samples

    # Read and validate audio
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file too small — ensure recording is at least 3 seconds.",
        )

    # Extract embedding from this sample
    try:
        embedding = extract_embedding(audio_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process audio: {e}",
        )

    # Stage the embedding
    if student_id not in _enrollment_staging:
        _enrollment_staging[student_id] = []

    samples = _enrollment_staging[student_id]

    # Replace if re-submitting the same index, otherwise append
    idx = sample_index - 1
    if idx < len(samples):
        samples[idx] = embedding
    else:
        # Fill gaps if needed
        while len(samples) < idx:
            samples.append(None)
        samples.append(embedding)

    # Count valid (non-None) samples
    valid_samples = [s for s in samples if s is not None]
    current_count = len(valid_samples)
    is_complete = current_count >= required

    # If enrollment is complete, average and persist
    if is_complete:
        avg_embedding = average_embeddings(valid_samples[:required])
        embedding_bytes = serialize_embedding(avg_embedding)

        db = _get_db()
        await db.upsert_voice_profile(
            student_id=student_id,
            embedding=embedding_bytes,
            samples_count=required,
        )

        # Clear staging
        _enrollment_staging.pop(student_id, None)

        return VoiceEnrollmentOut(
            student_id=student_id,
            samples_count=required,
            required_samples=required,
            is_complete=True,
            message="Voice enrollment complete. Voiceprint stored.",
        )

    return VoiceEnrollmentOut(
        student_id=student_id,
        samples_count=current_count,
        required_samples=required,
        is_complete=False,
        message=f"Sample {sample_index} received. {required - current_count} more needed.",
    )


@router.get("/profile/{student_id}", response_model=VoiceProfileStatus)
async def get_enrollment_status(student_id: str) -> VoiceProfileStatus:
    """Check a student's voice enrollment status."""
    settings = get_settings()
    required = settings.voice_enrollment_samples
    db = _get_db()

    profile = await db.get_voice_profile(student_id)
    if profile:
        return VoiceProfileStatus(
            student_id=student_id,
            enrolled=True,
            samples_count=profile["samples_count"],
            required_samples=required,
            is_complete=profile["samples_count"] >= required,
        )

    # Check staging
    staged = _enrollment_staging.get(student_id, [])
    valid_count = len([s for s in staged if s is not None])

    return VoiceProfileStatus(
        student_id=student_id,
        enrolled=False,
        samples_count=valid_count,
        required_samples=required,
        is_complete=False,
    )


@router.delete("/profile/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_profile(student_id: str) -> None:
    """Delete a student's voice profile (re-enrollment required)."""
    db = _get_db()
    deleted = await db.delete_voice_profile(student_id)
    _enrollment_staging.pop(student_id, None)
    if not deleted:
        raise HTTPException(status_code=404, detail="Voice profile not found.")


# =============================================================================
# Verification (standalone test — viva uses this internally)
# =============================================================================


@router.post("/verify", response_model=VoiceVerifyOut)
async def verify_voice(
    student_id: str = Form(...),
    audio: UploadFile = File(..., description="WAV audio to verify against stored voiceprint"),
) -> VoiceVerifyOut:
    """Verify a voice sample against a student's stored voiceprint.

    Used for testing enrollment quality. During viva sessions,
    verification happens automatically per-answer.
    """
    settings = get_settings()
    threshold = settings.voice_similarity_threshold
    db = _get_db()

    # Get stored profile
    profile = await db.get_voice_profile(student_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No voice profile found. Student must enroll first.",
        )

    # Extract embedding from test audio
    audio_bytes = await audio.read()
    try:
        test_embedding = extract_embedding(audio_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process audio: {e}",
        )

    # Compare against stored voiceprint
    stored_embedding = deserialize_embedding(profile["embedding"])
    similarity = cosine_similarity(test_embedding, stored_embedding)
    is_match = similarity >= threshold
    confidence = classify_confidence(similarity, threshold)

    return VoiceVerifyOut(
        student_id=student_id,
        similarity_score=round(similarity, 4),
        is_match=is_match,
        confidence=confidence,
        threshold=threshold,
    )
