"""Unit tests for ML components."""

import pytest

try:
    from src.ml import FAISSIndex, InvertedIndex, RandomForestClassifier
except ImportError:
    InvertedIndex = None  # type: ignore
    FAISSIndex = None  # type: ignore
    RandomForestClassifier = None  # type: ignore


class TestInvertedIndex:
    """Tests for InvertedIndex class."""

    def test_init(self):
        """Test InvertedIndex initialization."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        assert len(index.index) == 0
        assert len(index.fragment_tokens) == 0

    def test_add_fragment(self):
        """Test adding a fragment to the index."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType", "QlfType"])

        assert "frag_1" in index.index["IfType"]
        assert "frag_1" in index.index["CallType"]
        assert "frag_1" in index.index["QlfType"]

    def test_add_fragments(self):
        """Test adding multiple fragments."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        fragments = [
            ("frag_1", ["IfType", "CallType"]),
            ("frag_2", ["ForType", "WhileType"]),
            ("frag_3", ["IfType", "ForType"]),
        ]
        index.add_fragments(fragments)

        assert len(index.fragment_tokens) == 3
        assert "frag_1" in index.index["IfType"]
        assert "frag_3" in index.index["IfType"]

    def test_get_candidates(self):
        """Test getting candidate fragments."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType", "QlfType"])
        index.add_fragment("frag_2", ["ForType", "WhileType"])
        index.add_fragment("frag_3", ["IfType", "ForType"])

        # Query with single token
        candidates = index.get_candidates(["IfType"])
        assert "frag_1" in candidates
        assert "frag_3" in candidates
        assert "frag_2" not in candidates

        # Query with multiple tokens, min_overlap=2
        candidates = index.get_candidates(["IfType", "ForType"], min_overlap=2)
        assert "frag_3" in candidates
        assert "frag_1" not in candidates

    def test_get_candidates_with_scores(self):
        """Test getting candidates with overlap scores."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType", "QlfType"])
        index.add_fragment("frag_2", ["IfType", "ForType"])

        scores = index.get_candidates_with_scores(["IfType", "CallType"])

        assert scores["frag_1"] == 2  # Matches both IfType and CallType
        assert scores["frag_2"] == 1  # Matches only IfType

    def test_get_index_stats(self):
        """Test getting index statistics."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType"])
        index.add_fragment("frag_2", ["ForType", "WhileType"])

        stats = index.get_index_stats()

        assert stats["total_tokens"] == 4
        assert stats["total_fragments"] == 2
        assert stats["avg_posting_length"] == 1.0

    def test_get_token_frequency(self):
        """Test getting token frequency."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType"])
        index.add_fragment("frag_2", ["IfType", "ForType"])
        index.add_fragment("frag_3", ["ForType"])

        assert index.get_token_frequency("IfType") == 2
        assert index.get_token_frequency("ForType") == 2
        assert index.get_token_frequency("CallType") == 1
        assert index.get_token_frequency("NonExistent") == 0

    def test_clear(self):
        """Test clearing the index."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType"])

        index.clear()

        assert len(index.index) == 0
        assert len(index.fragment_tokens) == 0

    def test_save_and_load(self, tmp_path):
        """Test saving and loading the index."""
        if InvertedIndex is None:
            pytest.skip("InvertedIndex not available")

        index = InvertedIndex()
        index.add_fragment("frag_1", ["IfType", "CallType"])

        filepath = tmp_path / "index.pkl"
        index.save(filepath)

        # Load into new index
        new_index = InvertedIndex()
        new_index.load(filepath)

        assert "frag_1" in new_index.index["IfType"]
        assert len(new_index.fragment_tokens) == 1


class TestRandomForestClassifier:
    """Tests for RandomForestClassifier class."""

    def test_init(self):
        """Test RandomForestClassifier initialization."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available (requires scikit-learn)")

        clf = RandomForestClassifier()
        assert clf.n_estimators == 100
        assert clf.max_depth == 10
        assert clf.is_trained is False

    def test_init_custom_params(self):
        """Test initialization with custom parameters."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        clf = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=123)
        assert clf.n_estimators == 50
        assert clf.max_depth == 5
        assert clf.random_state == 123

    def test_train(self):
        """Test training the classifier."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        try:
            import numpy as np
        except ImportError:
            pytest.skip("numpy not available")

        clf = RandomForestClassifier(n_estimators=10)

        # Create simple training data
        X = np.array(
            [
                [0.0, 1.0, 1.0, 1.0, 1.0, 1.0],  # Similar
                [0.0, 0.9, 0.9, 0.95, 0.8, 0.9],  # Similar
                [10.0, 0.3, 0.4, 0.4, 0.2, 0.3],  # Different
                [15.0, 0.2, 0.3, 0.3, 0.1, 0.2],  # Different
            ]
        )
        y = np.array([1, 1, 0, 0])  # Clone, Clone, Non-clone, Non-clone

        metrics = clf.train(X, y, test_size=0.25, use_cross_validation=False)

        assert clf.is_trained is True
        assert "accuracy" in metrics
        assert "precision" in metrics
        assert "f1_score" in metrics

    def test_predict(self):
        """Test prediction."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        try:
            import numpy as np
        except ImportError:
            pytest.skip("numpy not available")

        clf = RandomForestClassifier(n_estimators=10)

        X_train = np.array(
            [
                [0.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                [10.0, 0.3, 0.4, 0.4, 0.2, 0.3],
            ]
        )
        y_train = np.array([1, 0])

        clf.train(X_train, y_train, test_size=0.5, use_cross_validation=False)

        X_test = np.array([[0.0, 1.0, 1.0, 1.0, 1.0, 1.0]])
        predictions = clf.predict(X_test)

        assert len(predictions) == 1
        assert predictions[0] in [0, 1]

    def test_predict_proba(self):
        """Test probability prediction."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        try:
            import numpy as np
        except ImportError:
            pytest.skip("numpy not available")

        clf = RandomForestClassifier(n_estimators=10)

        X_train = np.array(
            [
                [0.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                [10.0, 0.3, 0.4, 0.4, 0.2, 0.3],
            ]
        )
        y_train = np.array([1, 0])

        clf.train(X_train, y_train, test_size=0.5, use_cross_validation=False)

        X_test = np.array([[0.0, 1.0, 1.0, 1.0, 1.0, 1.0]])
        proba = clf.predict_proba(X_test)

        assert proba.shape == (1, 2)
        assert abs(sum(proba[0]) - 1.0) < 0.001  # Probabilities sum to 1

    def test_get_feature_importances(self):
        """Test getting feature importances."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        try:
            import numpy as np
        except ImportError:
            pytest.skip("numpy not available")

        clf = RandomForestClassifier(n_estimators=10)

        X_train = np.array(
            [
                [0.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                [10.0, 0.3, 0.4, 0.4, 0.2, 0.3],
            ]
        )
        y_train = np.array([1, 0])

        clf.train(X_train, y_train, test_size=0.5, use_cross_validation=False)

        importances = clf.get_feature_importances()

        assert isinstance(importances, dict)
        assert len(importances) == 6
        assert "levenshtein_distance" in importances
        assert "jaccard_similarity" in importances

    def test_predict_without_training(self):
        """Test prediction without training raises error."""
        if RandomForestClassifier is None:
            pytest.skip("RandomForestClassifier not available")

        clf = RandomForestClassifier()

        with pytest.raises(RuntimeError, match="must be trained"):
            clf.predict([[0.0, 1.0, 1.0, 1.0, 1.0, 1.0]])
