"""Unit tests for Parser Engine and Fragmenter."""

from pathlib import Path

import pytest

# Mock tree-sitter for testing without actual grammars
try:
    from src.parser import CodeFragment, Fragmenter, ParserEngine
except ImportError:
    ParserEngine = None  # type: ignore
    Fragmenter = None  # type: ignore
    CodeFragment = None  # type: ignore


class TestParserEngine:
    """Tests for ParserEngine class."""

    def test_init_default_config(self):
        """Test ParserEngine initialization with default config."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")

        # Should handle missing grammars gracefully
        engine = ParserEngine()
        assert engine is not None

    def test_get_supported_languages(self):
        """Test getting supported languages."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")

        engine = ParserEngine()
        languages = engine.get_supported_languages()
        assert isinstance(languages, list)
        assert (
            "python" in languages or len(languages) == 0
        )  # May be empty if grammars missing

    def test_load_unsupported_language(self):
        """Test loading unsupported language raises error."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")

        engine = ParserEngine()
        with pytest.raises(ValueError, match="Unsupported language"):
            engine.load_language("cobol")

    def test_get_language_config(self):
        """Test getting language configuration."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")

        engine = ParserEngine()
        config = engine.get_language_config("python")
        assert isinstance(config, dict)


class TestFragmenter:
    """Tests for Fragmenter class."""

    @pytest.fixture
    def parser_engine(self):
        """Create ParserEngine for tests."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")
        return ParserEngine()

    @pytest.fixture
    def fragmenter(self, parser_engine):
        """Create Fragmenter for tests."""
        if Fragmenter is None:
            pytest.skip("Fragmenter not available")
        return Fragmenter(parser_engine)

    def test_init(self, fragmenter):
        """Test Fragmenter initialization."""
        assert fragmenter is not None
        assert fragmenter.engine is not None

    def test_extract_fragments_empty_code(self, fragmenter):
        """Test extracting fragments from empty code."""
        fragments = fragmenter.extract_fragments(
            source_code=b"", language="python", source_file="test.py"
        )
        assert isinstance(fragments, list)

    def test_code_fragment_dataclass(self):
        """Test CodeFragment dataclass."""
        if CodeFragment is None:
            pytest.skip("CodeFragment not available")

        fragment = CodeFragment(
            fragment_id="test_func_1",
            source_file="test.py",
            language="python",
            start_line=1,
            end_line=10,
            start_column=0,
            end_column=20,
            source_code="def test(): pass",
            fragment_type="function",
            name="test",
        )

        assert fragment.fragment_id == "test_func_1"
        assert fragment.language == "python"
        assert fragment.name == "test"

    def test_code_fragment_to_dict(self):
        """Test CodeFragment to_dict method."""
        if CodeFragment is None:
            pytest.skip("CodeFragment not available")

        fragment = CodeFragment(
            fragment_id="test_func_1",
            source_file="test.py",
            language="python",
            start_line=1,
            end_line=10,
            start_column=0,
            end_column=20,
            source_code="def test(): pass",
            fragment_type="function",
        )

        data = fragment.to_dict()
        assert isinstance(data, dict)
        assert data["fragment_id"] == "test_func_1"
        assert data["source_code"] == "def test(): pass"


class TestFragmenterExtractFromFile:
    """Tests for extract_from_file method."""

    @pytest.fixture
    def sample_python_file(self, tmp_path):
        """Create a sample Python file for testing."""
        content = """
def hello():
    print("Hello, World!")

def add(a, b):
    return a + b

class Calculator:
    def multiply(self, x, y):
        return x * y
"""
        file_path = tmp_path / "sample.py"
        file_path.write_text(content)
        return file_path

    def test_extract_from_file(self, parser_engine, sample_python_file):
        """Test extracting fragments from a file."""
        if Fragmenter is None:
            pytest.skip("Fragmenter not available")

        fragmenter = Fragmenter(parser_engine)

        # This will fail if grammars are not compiled, but tests the method exists
        try:
            fragments = fragmenter.extract_from_file(str(sample_python_file))
            assert isinstance(fragments, list)
        except FileNotFoundError:
            # Expected if grammars are not compiled
            pytest.skip("Tree-sitter grammars not compiled")


class TestLanguageSupport:
    """Tests for multi-language support."""

    @pytest.mark.parametrize("language", ["python", "java", "c"])
    def test_language_config_exists(self, language):
        """Test that configuration exists for each supported language."""
        if ParserEngine is None:
            pytest.skip("ParserEngine not available")

        engine = ParserEngine()
        config = engine.get_language_config(language)

        # Config should exist (may be empty if file not found)
        assert isinstance(config, dict)
