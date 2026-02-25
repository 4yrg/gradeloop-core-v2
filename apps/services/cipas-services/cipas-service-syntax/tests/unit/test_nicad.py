"""Unit tests for NiCAD normalization pipeline."""

import pytest

try:
    from src.nicad import (
        BlindRenamer,
        LCSMatcher,
        NiCADPipeline,
        NiCADResult,
        NoiseRemover,
        PrettyPrinter,
    )
except ImportError:
    NoiseRemover = None  # type: ignore
    PrettyPrinter = None  # type: ignore
    BlindRenamer = None  # type: ignore
    LCSMatcher = None  # type: ignore
    NiCADPipeline = None  # type: ignore
    NiCADResult = None  # type: ignore


class TestNoiseRemover:
    """Tests for NoiseRemover class."""

    def test_init_python(self):
        """Test NoiseRemover initialization for Python."""
        if NoiseRemover is None:
            pytest.skip("NoiseRemover not available")

        remover = NoiseRemover("python")
        assert remover.language == "python"
        assert "comment" in remover.comment_types

    def test_init_java(self):
        """Test NoiseRemover initialization for Java."""
        if NoiseRemover is None:
            pytest.skip("NoiseRemover not available")

        remover = NoiseRemover("java")
        assert remover.language == "java"
        assert "line_comment" in remover.comment_types
        assert "block_comment" in remover.comment_types

    def test_init_unknown_language(self):
        """Test NoiseRemover with unknown language."""
        if NoiseRemover is None:
            pytest.skip("NoiseRemover not available")

        remover = NoiseRemover("unknown")
        assert remover.language == "unknown"
        assert "comment" in remover.comment_types  # Default


class TestPrettyPrinter:
    """Tests for PrettyPrinter class."""

    def test_init(self):
        """Test PrettyPrinter initialization."""
        if PrettyPrinter is None:
            pytest.skip("PrettyPrinter not available")

        printer = PrettyPrinter("java")
        assert printer.language == "java"

    def test_pretty_print_minimal(self):
        """Test minimal pretty printing."""
        if PrettyPrinter is None:
            pytest.skip("PrettyPrinter not available")

        printer = PrettyPrinter("python")
        tokens = ["def", "hello", "(", ")", ":"]
        result = printer.pretty_print_minimal(tokens)
        assert result == "def hello ( ) :"


class TestBlindRenamer:
    """Tests for BlindRenamer class."""

    def test_init(self):
        """Test BlindRenamer initialization."""
        if BlindRenamer is None:
            pytest.skip("BlindRenamer not available")

        renamer = BlindRenamer("python")
        assert renamer.language == "python"
        assert renamer.identifier_counter == 1
        assert renamer.literal_counter == 1

    def test_reset(self):
        """Test BlindRenamer reset."""
        if BlindRenamer is None:
            pytest.skip("BlindRenamer not available")

        renamer = BlindRenamer("python")
        renamer.identifier_counter = 100
        renamer.literal_counter = 50
        renamer.identifier_map["test"] = "var1"

        renamer.reset()

        assert renamer.identifier_counter == 1
        assert renamer.literal_counter == 1
        assert len(renamer.identifier_map) == 0

    def test_get_or_create_identifier(self):
        """Test identifier creation."""
        if BlindRenamer is None:
            pytest.skip("BlindRenamer not available")

        renamer = BlindRenamer("python")

        # First creation
        result1 = renamer._get_or_create_identifier("myVar")
        assert result1 == "var1"

        # Same identifier should return same result
        result2 = renamer._get_or_create_identifier("myVar")
        assert result2 == "var1"

        # Different identifier should get new name
        result3 = renamer._get_or_create_identifier("otherVar")
        assert result3 == "var2"

    def test_get_or_create_literal(self):
        """Test literal creation."""
        if BlindRenamer is None:
            pytest.skip("BlindRenamer not available")

        renamer = BlindRenamer("python")

        result1 = renamer._get_or_create_literal("42")
        assert result1 == "lit1"

        result2 = renamer._get_or_create_literal("42")
        assert result2 == "lit1"

        result3 = renamer._get_or_create_literal('"hello"')
        assert result3 == "lit2"

    def test_get_renaming_map(self):
        """Test getting renaming map."""
        if BlindRenamer is None:
            pytest.skip("BlindRenamer not available")

        renamer = BlindRenamer("python")
        renamer._get_or_create_identifier("x")
        renamer._get_or_create_literal("100")

        rename_map = renamer.get_renaming_map()
        assert "x" in rename_map
        assert "100" in rename_map


class TestLCSMatcher:
    """Tests for LCSMatcher class."""

    def test_init(self):
        """Test LCSMatcher initialization."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher()
        assert matcher.similarity_threshold == 0.85

    def test_init_custom_threshold(self):
        """Test LCSMatcher with custom threshold."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher(similarity_threshold=0.75)
        assert matcher.similarity_threshold == 0.75

    def test_compute_upi_identical(self):
        """Test UPI computation for identical code."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher()
        code = "line1\nline2\nline3"

        similarity, lcs_length = matcher.compute_upi(code, code)

        assert similarity == 1.0
        assert lcs_length == 3

    def test_compute_upi_different(self):
        """Test UPI computation for different code."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher()
        code_a = "line1\nline2\nline3"
        code_b = "line1\nline2\nline4"

        similarity, lcs_length = matcher.compute_upi(code_a, code_b)

        assert similarity == 2 / 3  # 2 matching lines out of 3
        assert lcs_length == 2

    def test_compute_upi_empty(self):
        """Test UPI computation for empty code."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher()

        similarity, lcs_length = matcher.compute_upi("", "")

        assert similarity == 0.0
        assert lcs_length == 0

    def test_is_clone(self):
        """Test clone detection threshold."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher(similarity_threshold=0.85)

        assert matcher.is_clone(0.90) is True
        assert matcher.is_clone(0.85) is True
        assert matcher.is_clone(0.84) is False
        assert matcher.is_clone(0.50) is False

    def test_lcs_length_basic(self):
        """Test LCS length computation."""
        if LCSMatcher is None:
            pytest.skip("LCSMatcher not available")

        matcher = LCSMatcher()

        seq_a = ["a", "b", "c", "d"]
        seq_b = ["a", "c", "d"]

        lcs_len = matcher._lcs_length(seq_a, seq_b)
        assert lcs_len == 3  # "a", "c", "d"


class TestNiCADResult:
    """Tests for NiCADResult dataclass."""

    def test_create_result(self):
        """Test NiCADResult creation."""
        if NiCADResult is None:
            pytest.skip("NiCADResult not available")

        result = NiCADResult(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            similarity_score=0.92,
            lcs_length=10,
            clone_type="type1",
            is_clone=True,
        )

        assert result.fragment_a_id == "frag_1"
        assert result.similarity_score == 0.92
        assert result.is_clone is True

    def test_to_dict(self):
        """Test NiCADResult to_dict method."""
        if NiCADResult is None:
            pytest.skip("NiCADResult not available")

        result = NiCADResult(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            similarity_score=0.92,
            lcs_length=10,
            clone_type="type1",
            is_clone=True,
        )

        data = result.to_dict()
        assert isinstance(data, dict)
        assert data["fragment_a_id"] == "frag_1"
        assert data["similarity_score"] == 0.92
        assert data["clone_type"] == "type1"


class TestNiCADPipeline:
    """Tests for NiCADPipeline class."""

    def test_init(self):
        """Test NiCADPipeline initialization."""
        if NiCADPipeline is None:
            pytest.skip("NiCADPipeline not available")

        pipeline = NiCADPipeline("python")
        assert pipeline.language == "python"
        assert pipeline.lcs_matcher.similarity_threshold == 0.85

    def test_init_custom_threshold(self):
        """Test NiCADPipeline with custom threshold."""
        if NiCADPipeline is None:
            pytest.skip("NiCADPipeline not available")

        pipeline = NiCADPipeline("java", similarity_threshold=0.75)
        assert pipeline.language == "java"
        assert pipeline.lcs_matcher.similarity_threshold == 0.75
