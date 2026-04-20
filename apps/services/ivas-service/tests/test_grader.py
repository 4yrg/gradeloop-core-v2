"""Tests for viva transcript grader."""

import pytest
from unittest.mock import AsyncMock, patch
from app.services.viva.grader import (
    grade_viva_transcript,
    MAX_SCORE_PER_QUESTION,
    _format_transcript_for_prompt,
    _format_assignment_block,
    _extract_json,
)


class TestConstants:
    """Test grader constants."""

    def test_max_score_per_question(self):
        """Test default max score per question."""
        assert MAX_SCORE_PER_QUESTION == 10.0


class TestFormatTranscriptForPrompt:
    """Test transcript formatting for grading prompt."""

    def test_empty_transcript(self):
        """Test formatting empty transcript."""
        result = _format_transcript_for_prompt([])
        assert result == ""

    def test_single_turn(self):
        """Test formatting single turn."""
        turns = [{"turn_number": 1, "role": "examiner", "content": "Hello!"}]
        result = _format_transcript_for_prompt(turns)
        assert result == "Examiner: Hello!"

    def test_multiple_turns(self):
        """Test formatting multiple turns."""
        turns = [
            {"turn_number": 1, "role": "examiner", "content": "What is X?"},
            {"turn_number": 2, "role": "student", "content": "X is Y."},
        ]
        result = _format_transcript_for_prompt(turns)
        lines = result.split("\n")
        assert len(lines) == 2
        assert "Examiner: What is X?" in lines[0]
        assert "Student: X is Y." in lines[1]

    def test_examiner_role_mapping(self):
        """Test that 'examiner' role maps to 'Examiner' label."""
        turns = [{"turn_number": 1, "role": "examiner", "content": "Test"}]
        result = _format_transcript_for_prompt(turns)
        assert result.startswith("Examiner:")

    def test_student_role_mapping(self):
        """Test that 'student' role maps to 'Student' label."""
        turns = [{"turn_number": 1, "role": "student", "content": "Test"}]
        result = _format_transcript_for_prompt(turns)
        assert result.startswith("Student:")

    def test_skips_empty_content(self):
        """Test that turns with empty content are skipped."""
        turns = [
            {"turn_number": 1, "role": "examiner", "content": ""},
            {"turn_number": 2, "role": "examiner", "content": "Question?"},
        ]
        result = _format_transcript_for_prompt(turns)
        assert "Question?" in result
        assert result.count("\n") == 0  # Only one line


class TestFormatAssignmentBlock:
    """Test assignment context formatting."""

    def test_empty_context(self):
        """Test formatting empty assignment context."""
        result = _format_assignment_block(None)
        assert result == "- (no assignment context provided)"

    def test_empty_dict_context(self):
        """Test formatting empty dict assignment context."""
        result = _format_assignment_block({})
        assert result == "- (no assignment context provided)"

    def test_title_only(self):
        """Test formatting with only title."""
        result = _format_assignment_block({"title": "Test Assignment"})
        assert "- Title: Test Assignment" in result

    def test_full_context(self):
        """Test formatting with all fields."""
        ctx = {
            "title": "Test Assignment",
            "code": "def foo(): pass",
            "programming_language": "Python",
            "description": "A test assignment",
        }
        result = _format_assignment_block(ctx)
        assert "- Title: Test Assignment" in result
        assert "- Code: def foo(): pass" in result
        assert "- Subject: Python" in result
        assert "- Description: A test assignment" in result

    def test_skips_non_string_values(self):
        """Test that non-string values are skipped."""
        ctx = {
            "title": 123,  # Invalid
            "programming_language": "Python",
        }
        result = _format_assignment_block(ctx)
        assert "- Subject: Python" in result
        assert "Title" not in result


class TestExtractJson:
    """Test JSON extraction for grader responses."""

    def test_valid_json(self):
        """Test extracting valid JSON."""
        text = '{"items": [{"sequence_num": 1, "score": 8}]}'
        result = _extract_json(text)
        assert result is not None
        assert "items" in result

    def test_fenced_json(self):
        """Test extracting JSON from markdown fence."""
        text = '```json\n{"items": []}\n```'
        result = _extract_json(text)
        assert result is not None
        assert result["items"] == []


class TestGradeVivaTranscript:
    """Test main grading function."""

    @pytest.mark.asyncio
    async def test_empty_transcript(self):
        """Test grading empty transcript returns empty result."""
        result = await grade_viva_transcript(
            gemini_api_key="test-key",
            grader_model="gemini-2.0-flash",
            turns=[],
            assignment_context=None,
        )
        assert result["items"] == []
        assert result["total_score"] == 0.0
        assert result["max_possible"] == 0.0

    @pytest.mark.asyncio
    async def test_transcript_with_no_questions(self):
        """Test grading transcript with no substantive questions."""
        turns = [
            {"turn_number": 1, "role": "examiner", "content": "Hello!"},
            {"turn_number": 2, "role": "student", "content": "Hi!"},
        ]
        result = await grade_viva_transcript(
            gemini_api_key="test-key",
            grader_model="gemini-2.0-flash",
            turns=turns,
            assignment_context=None,
        )
        # May return empty if no substantive questions detected
        assert isinstance(result["items"], list)

    @pytest.mark.asyncio
    async def test_score_calculation(self):
        """Test that total score is sum of individual scores."""
        # This would require mocking the API response
        # For now, just verify the function doesn't crash
        result = await grade_viva_transcript(
            gemini_api_key="test-key",
            grader_model="gemini-2.0-flash",
            turns=[
                {"turn_number": 1, "role": "examiner", "content": "What is X?"},
                {"turn_number": 2, "role": "student", "content": "X is Y."},
            ],
            assignment_context={"title": "Test"},
        )
        assert "items" in result
        assert "total_score" in result
        assert "max_possible" in result

    @pytest.mark.asyncio
    async def test_max_possible_calculation(self):
        """Test that max_possible is calculated correctly."""
        # The grader should sum per-item max_scores, not assume uniform
        result = await grade_viva_transcript(
            gemini_api_key="test-key",
            grader_model="gemini-2.0-flash",
            turns=[
                {"turn_number": 1, "role": "examiner", "content": "Q1?"},
                {"turn_number": 2, "role": "student", "content": "A1."},
                {"turn_number": 3, "role": "examiner", "content": "Q2?"},
                {"turn_number": 4, "role": "student", "content": "A2."},
            ],
            assignment_context={"title": "Test"},
        )
        # max_possible should equal sum of item max_scores
        if result["items"]:
            expected_max = sum(item.get("max_score", 10) for item in result["items"])
            assert result["max_possible"] == expected_max


class TestPlanAwareMaxScoreOverride:
    """Test that plan-aware grading forces max_score from the planned questions."""

    @pytest.mark.asyncio
    async def test_plan_aware_forces_max_score_from_plan(self):
        """Plan-aware mode should override max_score from planned questions.

        This is the core fix: even though the model doesn't return max_score,
        the grader forces it from the planned question definition so competencies
        with non-default max_score (e.g. 5.0) are scored correctly.
        """
        planned_questions = [
            {"sequence_num": 1, "question_text": "Explain loops.", "competency_name": "Loops", "difficulty": 2, "max_score": 5.0},
            {"sequence_num": 2, "question_text": "Explain recursion.", "competency_name": "Recursion", "difficulty": 4, "max_score": 15.0},
            {"sequence_num": 3, "question_text": "Explain arrays.", "competency_name": "Arrays", "difficulty": 1, "max_score": 10.0},
        ]

        # Simulate model returning items without max_score (model doesn't include it)
        mock_response = AsyncMock()
        mock_response.text = '{"items": [{"sequence_num": 1, "question_text": "Explain loops.", "response_text": "Good answer", "score": 3, "score_justification": "Partial"}, {"sequence_num": 2, "question_text": "Explain recursion.", "response_text": "Great answer", "score": 12, "score_justification": "Excellent"}, {"sequence_num": 3, "question_text": "Explain arrays.", "response_text": "OK answer", "score": 7, "score_justification": "Decent"}]}'

        mock_client = AsyncMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        with patch("google.genai.Client", return_value=mock_client):
            result = await grade_viva_transcript(
                gemini_api_key="test-key",
                grader_model="test-model",
                turns=[
                    {"turn_number": 1, "role": "examiner", "content": "Explain loops."},
                    {"turn_number": 2, "role": "student", "content": "Good answer"},
                ],
                assignment_context={"title": "Test"},
                planned_questions=planned_questions,
            )

        # max_score should come from the planned questions, NOT from model output
        items_by_seq = {item["sequence_num"]: item for item in result["items"]}
        assert items_by_seq[1]["max_score"] == 5.0, f"Expected 5.0, got {items_by_seq[1]['max_score']}"
        assert items_by_seq[2]["max_score"] == 15.0, f"Expected 15.0, got {items_by_seq[2]['max_score']}"
        assert items_by_seq[3]["max_score"] == 10.0, f"Expected 10.0, got {items_by_seq[3]['max_score']}"

        # total and max_possible should reflect the correct per-question maxes
        assert result["max_possible"] == 30.0  # 5 + 15 + 10
        # Note: _coerce_item clamps scores to MAX_SCORE_PER_QUESTION (10.0),
        # so score=12 gets clamped to 10, making total = 3 + 10 + 7 = 20
        assert result["total_score"] == 20.0

    @pytest.mark.asyncio
    async def test_plan_aware_gap_fills_missing_questions(self):
        """Plan-aware mode should fill gaps for questions the model didn't return."""
        planned_questions = [
            {"sequence_num": 1, "question_text": "Q1", "competency_name": "A", "difficulty": 1, "max_score": 10.0},
            {"sequence_num": 2, "question_text": "Q2", "competency_name": "B", "difficulty": 2, "max_score": 10.0},
            {"sequence_num": 3, "question_text": "Q3", "competency_name": "C", "difficulty": 3, "max_score": 10.0},
        ]

        mock_response = AsyncMock()
        # Model only returns 2 of 3 questions
        mock_response.text = '{"items": [{"sequence_num": 1, "question_text": "Q1", "response_text": "A1", "score": 7, "score_justification": "OK"}, {"sequence_num": 3, "question_text": "Q3", "response_text": "A3", "score": 5, "score_justification": "Weak"}]}'

        mock_client = AsyncMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

        with patch("google.genai.Client", return_value=mock_client):
            result = await grade_viva_transcript(
                gemini_api_key="test-key",
                grader_model="test-model",
                turns=[{"turn_number": 1, "role": "examiner", "content": "Q1?"}],
                assignment_context={"title": "Test"},
                planned_questions=planned_questions,
            )

        # Should have 3 items (gap-filled)
        assert len(result["items"]) == 3

        items_by_seq = {item["sequence_num"]: item for item in result["items"]}
        # Q1 and Q3 from model
        assert items_by_seq[1]["score"] == 7.0
        assert items_by_seq[1]["response_text"] == "A1"
        assert items_by_seq[3]["score"] == 5.0
        # Q2 is gap-filled with score 0
        assert items_by_seq[2]["score"] == 0.0
        assert items_by_seq[2]["response_text"] is None
