"""Voice enrollment and verification routes."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.config import get_settings
from app.dependencies import get_db
from app.schemas.voice import (
    VoiceEnrollmentOut,
    VoiceProfileOut,
    VoiceProfileStatus,
    VoiceVerifyOut,
)
from app.services.storage.postgres_client import PostgresClient
from app.services.voice.enrollment_staging import EnrollmentStaging
from app.services.voice.speaker import (
    average_embeddings,
    classify_confidence,
    cosine_similarity,
    deserialize_embedding,
    extract_embedding,
    serialize_embedding,
)

router = APIRouter(prefix="/voice", tags=["voice"])

# Enrollment staging backend — initialized in main.py lifespan.
# InMemoryEnrollmentStaging for dev, RedisEnrollmentStaging for production.
enrollment_staging: EnrollmentStaging | None = None


def _get_staging() -> EnrollmentStaging:
    """Get the enrollment staging backend."""
    if enrollment_staging is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Enrollment staging not initialized.",
        )
    return enrollment_staging


# =============================================================================
# Enrollment
# =============================================================================


@router.post("/enroll", response_model=VoiceEnrollmentOut, status_code=status.HTTP_200_OK)
async def enroll_sample(
    student_id: str = Form(...),
    sample_index: int = Form(..., ge=1, le=5),
    audio: UploadFile = File(..., description="WAV audio file (~10s speech sample)"),
    db: PostgresClient = Depends(get_db),
) -> VoiceEnrollmentOut:
    """Submit a single enrollment audio sample.

    Students must submit the required number of samples (default 3).
    Each sample's embedding is extracted and staged.
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
    staging = _get_staging()
    await staging.store_sample(student_id, sample_index, embedding)

    # Count valid samples up to the required count
    current_count = await staging.get_valid_count(student_id, required)
    is_complete = current_count >= required

    # If enrollment is complete, average and persist
    if is_complete:
        ordered_embeddings = await staging.get_ordered_embeddings(student_id, required)
        avg_embedding = average_embeddings(ordered_embeddings)
        embedding_bytes = serialize_embedding(avg_embedding)

        await db.upsert_voice_profile(
            student_id=student_id,
            embedding=embedding_bytes,
            samples_count=required,
        )

        # Clear staging
        await staging.clear(student_id)

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
async def get_enrollment_status(student_id: str, db: PostgresClient = Depends(get_db)) -> VoiceProfileStatus:
    """Check a student's voice enrollment status."""
    settings = get_settings()
    required = settings.voice_enrollment_samples

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
    staging = _get_staging()
    valid_count = await staging.get_valid_count(student_id, required)

    return VoiceProfileStatus(
        student_id=student_id,
        enrolled=False,
        samples_count=valid_count,
        required_samples=required,
        is_complete=False,
    )


@router.delete("/profile/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice_profile(student_id: str, db: PostgresClient = Depends(get_db)) -> None:
    """Delete a student's voice profile (re-enrollment required)."""
    deleted = await db.delete_voice_profile(student_id)
    staging = _get_staging()
    await staging.clear(student_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Voice profile not found.")


# =============================================================================
# Verification (standalone test — viva uses this internally)
# =============================================================================


@router.post("/verify", response_model=VoiceVerifyOut)
async def verify_voice(
    student_id: str = Form(...),
    audio: UploadFile = File(..., description="WAV audio to verify against stored voiceprint"),
    db: PostgresClient = Depends(get_db),
) -> VoiceVerifyOut:
    """Verify a voice sample against a student's stored voiceprint.

    Used for testing enrollment quality. During viva sessions,
    verification happens automatically per-answer.
    """
    settings = get_settings()
    threshold = settings.voice_similarity_threshold

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