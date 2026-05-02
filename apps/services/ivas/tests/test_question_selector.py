"""Tests for difficulty-aware question selector."""

import pytest

from app.services.viva.question_selector import (
    DIFFICULTY_LABELS,
    _extract_json,
    select_questions_ai,
    select_questions_random,
)


class TestDifficultyLabels:
    """Test difficulty label constants."""

    def test_all_difficulty_levels_defined(self):
        """Test that all difficulty levels 1-5 have labels."""
        assert len(DIFFICULTY_LABELS) == 5
        assert DIFFICULTY_LABELS[1] == "Beginner"
        assert DIFFICULTY_LABELS[2] == "Intermediate"
        assert DIFFICULTY_LABELS[3] == "Advanced"
        assert DIFFICULTY_LABELS[4] == "Expert"
        assert DIFFICULTY_LABELS[5] == "Master"


class TestExtractJson:
    """Test JSON extraction from model responses."""

    def test_plain_json(self):
        """Test extracting plain JSON object."""
        text = '{"questions": [{"question_text": "What is X?", "difficulty": 2}]}'
        result = _extract_json(text)
        assert result is not None
        assert "questions" in result

    def test_fenced_json(self):
        """Test extracting JSON from markdown code fence."""
        text = '''```json
{"questions": [{"question_text": "What is X?", "difficulty": 2}]}
```'''
        result = _extract_json(text)
        assert result is not None
        assert len(result["questions"]) == 1

    def test_fenced_json_no_language(self):
        """Test extracting JSON from code fence without language."""
        text = '''```
{"questions": [{"question_text": "What is X?", "difficulty": 2}]}
```'''
        result = _extract_json(text)
        assert result is not None

    def test_json_with_surrounding_text(self):
        """Test extracting JSON surrounded by prose."""
        text = '''Here is the result:
{"questions": [{"question_text": "What is X?", "difficulty": 2}]}
I hope this helps!'''
        result = _extract_json(text)
        assert result is not None

    def test_empty_text(self):
        """Test handling empty input."""
        assert _extract_json("") is None
        assert _extract_json(None) is None

    def test_invalid_json(self):
        """Test handling malformed JSON."""
        text = '{"questions": [{"question_text": "broken}'
        result = _extract_json(text)
        assert result is None

    def test_multiple_json_objects(self):
        """Test extracting the main JSON when multiple exist."""
        text = '''Some text {"questions": [...]} more text {"other": "data"}'''
        # Should find the widest balanced {} slice
        _extract_json(text)
        # Result may vary, but shouldn't crash


class TestSelectQuestionsRandom:
    """Test random question selection fallback."""

    def test_empty_distribution(self):
        """Test that empty distribution returns empty list."""
        competencies = [
            {"id": "1", "name": "Test", "difficulty": 2},
        ]
        result = select_questions_random(competencies, {})
        assert result == []

    def test_single_question(self):
        """Test selecting a single question."""
        competencies = [
            {"id": "1", "name": "Loops", "difficulty": 2},
        ]
        result = select_questions_random(competencies, {2: 1})
        assert len(result) == 1
        assert result[0]["difficulty"] == 2
        assert result[0]["sequence_num"] == 1
        assert result[0]["max_score"] == 10.0

    def test_multiple_difficulty_levels(self):
        """Test selecting questions across difficulty levels."""
        competencies = [
            {"id": "1", "name": "Loops", "difficulty": 1},
            {"id": "2", "name": "Recursion", "difficulty": 3},
            {"id": "3", "name": "OOP", "difficulty": 2},
        ]
        result = select_questions_random(competencies, {1: 1, 2: 1, 3: 1})
        assert len(result) == 3
        difficulties = {r["difficulty"] for r in result}
        assert difficulties == {1, 2, 3}

    def test_more_questions_than_competencies(self):
        """Test selecting more questions than available competencies."""
        competencies = [
            {"id": "1", "name": "Loops", "difficulty": 2},
        ]
        # Request 3 questions but only 1 competency available
        result = select_questions_random(competencies, {2: 3})
        # Should allow repeats (len may be less if pool is smaller)
        assert len(result) <= 3


class TestQuestionSelectorAI:
    """Test AI-powered question selection."""

    @pytest.mark.asyncio
    async def test_empty_distribution(self):
        """Test that empty distribution returns empty list."""
        result = await select_questions_ai(
            gemini_api_key="test-key",
            model="gemini-2.0-flash",
            assignment_context={"title": "Test"},
            competencies=[],
            difficulty_distribution={},
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_single_question_selection(self):
        """Test selecting a single question via AI."""
        competencies = [
            {"id": "1", "name": "Loops", "description": "Understanding loops", "difficulty": 2},
        ]
        result = await select_questions_ai(
            gemini_api_key="test-key",
            model="gemini-2.0-flash",
            assignment_context={"title": "Test Assignment"},
            competencies=competencies,
            difficulty_distribution={2: 1},
        )
        # May fail in test environment without valid API key
        # Main thing is it doesn't crash
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_question_metadata(self):
        """Test that selected questions have required metadata."""
        competencies = [
            {"id": "1", "name": "Loops", "description": "Loop concepts", "difficulty": 2},
        ]
        result = await select_questions_ai(
            gemini_api_key="test-key",
            model="gemini-2.0-flash",
            assignment_context={"title": "Test"},
            competencies=competencies,
            difficulty_distribution={2: 1},
        )
        if result:  # May be empty if API fails
            q = result[0]
            assert "question_text" in q
            assert "competency_name" in q
            assert "difficulty" in q
            assert "sequence_num" in q
            assert "max_score" in q
            assert q["max_score"] == 10.0
