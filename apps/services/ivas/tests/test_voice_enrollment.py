"""Tests for voice enrollment and verification."""

from app.routes.voice import _enrollment_staging


class TestVoiceEnrollmentStaging:
    """Test voice enrollment staging logic."""

    def setup_method(self):
        """Clear staging before each test."""
        _enrollment_staging.clear()

    def teardown_method(self):
        """Clear staging after each test."""
        _enrollment_staging.clear()

    def test_enroll_samples_in_order(self):
        """Test enrolling samples 1, 2, 3 in order."""
        from app.routes.voice import _enrollment_staging

        # Simulate sample submission
        student_id = "test_student"
        _enrollment_staging[student_id] = {
            1: b"embedding_1",
            2: b"embedding_2",
            3: b"embedding_3",
        }

        valid_samples = [
            _enrollment_staging[student_id][i]
            for i in range(1, 4)
            if i in _enrollment_staging[student_id]
        ]
        assert len(valid_samples) == 3
        assert valid_samples[0] == b"embedding_1"
        assert valid_samples[1] == b"embedding_2"
        assert valid_samples[2] == b"embedding_3"

    def test_enroll_samples_out_of_order(self):
        """Test enrolling samples out of order (3, 1, 2)."""
        student_id = "test_student"
        _enrollment_staging[student_id] = {}

        # Submit in wrong order
        _enrollment_staging[student_id][3] = b"embedding_3"
        _enrollment_staging[student_id][1] = b"embedding_1"
        _enrollment_staging[student_id][2] = b"embedding_2"

        valid_samples = [
            _enrollment_staging[student_id][i]
            for i in range(1, 4)
            if i in _enrollment_staging[student_id]
        ]
        assert len(valid_samples) == 3
        # Order should be preserved when retrieving
        assert valid_samples[0] == b"embedding_1"
        assert valid_samples[1] == b"embedding_2"
        assert valid_samples[2] == b"embedding_3"

    def test_resubmit_same_index(self):
        """Test resubmitting the same sample index replaces previous."""
        student_id = "test_student"
        _enrollment_staging[student_id] = {1: b"old_embedding"}

        # Resubmit sample 1
        _enrollment_staging[student_id][1] = b"new_embedding"

        assert len(_enrollment_staging[student_id]) == 1
        assert _enrollment_staging[student_id][1] == b"new_embedding"

    def test_partial_enrollment_status(self):
        """Test enrollment status with partial samples."""
        student_id = "test_student"
        required = 3

        # Submit 2 of 3 samples
        _enrollment_staging[student_id] = {1: b"emb_1", 2: b"emb_2"}
        valid_count = len(_enrollment_staging[student_id])
        is_complete = valid_count >= required

        assert valid_count == 2
        assert is_complete is False

    def test_complete_enrollment_status(self):
        """Test enrollment completion detection."""
        student_id = "test_student"
        required = 3

        _enrollment_staging[student_id] = {1: b"emb_1", 2: b"emb_2", 3: b"emb_3"}
        valid_count = len(_enrollment_staging[student_id])
        is_complete = valid_count >= required

        assert valid_count == 3
        assert is_complete is True


class TestVoiceVerification:
    """Test voice verification logic."""

    def test_verification_threshold(self):
        """Test similarity threshold classification."""
        from app.services.voice.speaker import classify_confidence

        threshold = 0.75

        # High confidence match
        assert classify_confidence(0.90, threshold) == "high"
        # Medium confidence match
        assert classify_confidence(0.80, threshold) == "high"
        # Just above threshold
        assert classify_confidence(0.76, threshold) == "high"
        # At threshold
        assert classify_confidence(0.75, threshold) == "high"
        # Just below threshold
        assert classify_confidence(0.70, threshold) == "medium"
        # Well below threshold
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
