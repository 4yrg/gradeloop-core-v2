"""Unit tests for ToMA IR and Feature Extraction."""

import pytest

try:
    from src.toma import (
        FeatureExtractor,
        TokenType,
        ToMAMapper,
        ToMAPipeline,
        ToMAResult,
    )
except ImportError:
    ToMAMapper = None  # type: ignore
    TokenType = None  # type: ignore
    FeatureExtractor = None  # type: ignore
    ToMAPipeline = None  # type: ignore
    ToMAResult = None  # type: ignore


class TestTokenType:
    """Tests for TokenType enum."""

    def test_token_types_exist(self):
        """Test that all 15 token types exist."""
        if TokenType is None:
            pytest.skip("TokenType not available")

        expected_types = [
            "IfType",
            "ElseType",
            "SwitchType",
            "CaseType",
            "ForType",
            "WhileType",
            "DoType",
            "BreakType",
            "ContinueType",
            "ReturnType",
            "VarDeclType",
            "FuncDeclType",
            "ParamType",
            "CallType",
            "QlfType",
        ]

        for type_name in expected_types:
            assert hasattr(
                TokenType,
                type_name.replace("Type", "").upper()
                if type_name != "QlfType"
                else "QLF",
            )

    def test_token_type_values(self):
        """Test token type string values."""
        if TokenType is None:
            pytest.skip("TokenType not available")

        assert TokenType.IF.value == "IfType"
        assert TokenType.CALL.value == "CallType"
        assert TokenType.QLF.value == "QlfType"


class TestToMAMapper:
    """Tests for ToMAMapper class."""

    def test_init_python(self):
        """Test ToMAMapper initialization for Python."""
        if ToMAMapper is None:
            pytest.skip("ToMAMapper not available")

        mapper = ToMAMapper("python")
        assert mapper.language == "python"

    def test_init_java(self):
        """Test ToMAMapper initialization for Java."""
        if ToMAMapper is None:
            pytest.skip("ToMAMapper not available")

        mapper = ToMAMapper("java")
        assert mapper.language == "java"

    def test_init_unknown_language(self):
        """Test ToMAMapper with unknown language."""
        if ToMAMapper is None:
            pytest.skip("ToMAMapper not available")

        mapper = ToMAMapper("unknown")
        assert mapper.language == "unknown"
        assert len(mapper.mapping) == 0  # Empty mapping for unknown language

    def test_get_all_token_types(self):
        """Test getting all token types."""
        if ToMAMapper is None:
            pytest.skip("ToMAMapper not available")

        all_types = ToMAMapper.get_all_token_types()
        assert isinstance(all_types, list)
        assert len(all_types) == 15  # 15 token types


class TestFeatureExtractor:
    """Tests for FeatureExtractor class."""

    def test_init(self):
        """Test FeatureExtractor initialization."""
        if FeatureExtractor is None:
            pytest.skip("FeatureExtractor not available (requires python-Levenshtein)")

        extractor = FeatureExtractor()
        assert extractor is not None

    def test_extract_features_identical(self):
        """Test feature extraction for identical sequences."""
        if FeatureExtractor is None:
            pytest.skip("FeatureExtractor not available")

        extractor = FeatureExtractor()
        tokens = ["IfType", "CallType", "QlfType"]

        features = extractor.extract_features(tokens, tokens)

        # Identical sequences should have:
        # - Levenshtein distance = 0
        # - Levenshtein ratio = 1.0
        # - Jaro = 1.0
        # - Jaro-Winkler = 1.0
        # - Jaccard = 1.0
        # - Dice = 1.0
        assert features[0] == 0.0  # Levenshtein distance
        assert features[1] == 1.0  # Levenshtein ratio
        assert features[4] == 1.0  # Jaccard
        assert features[5] == 1.0  # Dice

    def test_extract_features_different(self):
        """Test feature extraction for different sequences."""
        if FeatureExtractor is None:
            pytest.skip("FeatureExtractor not available")

        extractor = FeatureExtractor()
        tokens_a = ["IfType", "CallType", "QlfType"]
        tokens_b = ["ForType", "WhileType", "ReturnType"]

        features = extractor.extract_features(tokens_a, tokens_b)

        # Different sequences should have lower similarity scores
        assert features[0] > 0  # Levenshtein distance > 0
        assert features[1] < 1.0  # Levenshtein ratio < 1.0

    def test_extract_features_dict(self):
        """Test feature extraction as dictionary."""
        if FeatureExtractor is None:
            pytest.skip("FeatureExtractor not available")

        extractor = FeatureExtractor()
        tokens_a = ["IfType", "CallType"]
        tokens_b = ["IfType", "ForType"]

        features_dict = extractor.extract_features_dict(tokens_a, tokens_b)

        assert isinstance(features_dict, dict)
        assert "levenshtein_distance" in features_dict
        assert "jaccard_similarity" in features_dict
        assert "dice_coefficient" in features_dict

    def test_normalize_features(self):
        """Test feature normalization."""
        if FeatureExtractor is None:
            pytest.skip("FeatureExtractor not available")

        # Levenshtein distance should be transformed to 0-1 range
        features = (10.0, 0.8, 0.85, 0.9, 0.7, 0.8)
        normalized = FeatureExtractor.normalize_features(features)

        assert len(normalized) == 6
        assert all(0 <= n <= 1 for n in normalized)
        # First element (Levenshtein) should be transformed
        assert normalized[0] == 1.0 / (1.0 + 10.0)


class TestToMAResult:
    """Tests for ToMAResult dataclass."""

    def test_create_result(self):
        """Test ToMAResult creation."""
        if ToMAResult is None:
            pytest.skip("ToMAResult not available")

        result = ToMAResult(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            tokens_a=["IfType", "CallType"],
            tokens_b=["IfType", "ForType"],
            feature_vector=(5.0, 0.7, 0.75, 0.8, 0.5, 0.6),
            normalized_features=[0.167, 0.7, 0.75, 0.8, 0.5, 0.6],
        )

        assert result.fragment_a_id == "frag_1"
        assert len(result.tokens_a) == 2
        assert len(result.feature_vector) == 6

    def test_to_dict(self):
        """Test ToMAResult to_dict method."""
        if ToMAResult is None:
            pytest.skip("ToMAResult not available")

        result = ToMAResult(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            tokens_a=["IfType"],
            tokens_b=["IfType"],
            feature_vector=(0.0, 1.0, 1.0, 1.0, 1.0, 1.0),
            normalized_features=[1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        )

        data = result.to_dict()
        assert isinstance(data, dict)
        assert data["fragment_a_id"] == "frag_1"
        assert "feature_vector" in data


class TestToMAPipeline:
    """Tests for ToMAPipeline class."""

    def test_init(self):
        """Test ToMAPipeline initialization."""
        if ToMAPipeline is None:
            pytest.skip("ToMAPipeline not available")

        pipeline = ToMAPipeline("python")
        assert pipeline.language == "python"
        assert pipeline.mapper is not None
        assert pipeline.extractor is not None

    def test_init_java(self):
        """Test ToMAPipeline initialization for Java."""
        if ToMAPipeline is None:
            pytest.skip("ToMAPipeline not available")

        pipeline = ToMAPipeline("java")
        assert pipeline.language == "java"
