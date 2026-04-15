"""Tests for voice enrollment and verification."""

import pytest


class TestVoiceEnrollmentStaging:
    """Test voice enrollment staging logic using InMemoryEnrollmentStaging."""

    def setup_method(self):
        """Create a fresh staging instance before each test."""
        from app.services.voice.enrollment_staging import InMemoryEnrollmentStaging

        self.staging = InMemoryEnrollmentStaging()

    @pytest.mark.asyncio
    async def test_enroll_samples_in_order(self):
        """Test enrolling samples 1, 2, 3 in order."""
        import numpy as np

        student_id = "test_student"
        await self.staging.store_sample(student_id, 1, np.array([1.0]))
        await self.staging.store_sample(student_id, 2, np.array([2.0]))
        await self.staging.store_sample(student_id, 3, np.array([3.0]))

        count = await self.staging.get_valid_count(student_id, 3)
        assert count == 3

        embeddings = await self.staging.get_ordered_embeddings(student_id, 3)
        assert len(embeddings) == 3

    @pytest.mark.asyncio
    async def test_enroll_samples_out_of_order(self):
        """Test enrolling samples out of order (3, 1, 2)."""
        import numpy as np

        student_id = "test_student"
        await self.staging.store_sample(student_id, 3, np.array([3.0]))
        await self.staging.store_sample(student_id, 1, np.array([1.0]))
        await self.staging.store_sample(student_id, 2, np.array([2.0]))

        embeddings = await self.staging.get_ordered_embeddings(student_id, 3)
        assert len(embeddings) == 3

    @pytest.mark.asyncio
    async def test_resubmit_same_index(self):
        """Test resubmitting the same sample index replaces previous."""
        import numpy as np

        student_id = "test_student"
        await self.staging.store_sample(student_id, 1, np.array([1.0]))
        await self.staging.store_sample(student_id, 1, np.array([99.0]))

        samples = await self.staging.get_samples(student_id)
        assert len(samples) == 1
        assert samples[1][0] == 99.0

    @pytest.mark.asyncio
    async def test_partial_enrollment_status(self):
        """Test enrollment status with partial samples."""
        import numpy as np

        student_id = "test_student"
        await self.staging.store_sample(student_id, 1, np.array([1.0]))
        await self.staging.store_sample(student_id, 2, np.array([2.0]))

        count = await self.staging.get_valid_count(student_id, 3)
        assert count == 2
        assert count < 3

    @pytest.mark.asyncio
    async def test_complete_enrollment_status(self):
        """Test enrollment completion detection."""
        import numpy as np

        student_id = "test_student"
        await self.staging.store_sample(student_id, 1, np.array([1.0]))
        await self.staging.store_sample(student_id, 2, np.array([2.0]))
        await self.staging.store_sample(student_id, 3, np.array([3.0]))

        count = await self.staging.get_valid_count(student_id, 3)
        assert count == 3


class TestVoiceVerification:
    """Test voice verification logic."""

    def test_verification_threshold(self):
        """Test similarity threshold classification."""
        from app.services.voice.speaker import classify_confidence

        threshold = 0.75

        # High confidence: well above threshold (>= threshold + 0.10)
        assert classify_confidence(0.90, threshold) == "high"
        # High confidence: exactly at threshold + 0.10
        assert classify_confidence(0.85, threshold) == "high"
        # Medium confidence: above threshold but below high
        assert classify_confidence(0.80, threshold) == "medium"
        # Medium confidence: just above threshold
        assert classify_confidence(0.76, threshold) == "medium"
        # Medium confidence: exactly at threshold
        assert classify_confidence(0.75, threshold) == "medium"
        # Low confidence: below threshold
        assert classify_confidence(0.70, threshold) == "low"
        # Low confidence: well below threshold
        assert classify_confidence(0.50, threshold) == "low"

    def test_cosine_similarity_identical(self):
        """Test cosine similarity of identical vectors."""
        import numpy as np
        from app.services.voice.speaker import cosine_similarity

        vec = np.array([1.0, 0.0, 0.0])
        similarity = cosine_similarity(vec, vec)
        assert abs(similarity - 1.0) < 0.0001

    def test_cosine_similarity_orthogonal(self):
        """Test cosine similarity of orthogonal vectors."""
        import numpy as np
        from app.services.voice.speaker import cosine_similarity

        vec1 = np.array([1.0, 0.0, 0.0])
        vec2 = np.array([0.0, 1.0, 0.0])
        similarity = cosine_similarity(vec1, vec2)
        assert abs(similarity) < 0.0001
