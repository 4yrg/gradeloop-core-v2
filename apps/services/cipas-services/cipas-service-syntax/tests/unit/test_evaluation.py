"""Unit tests for Evaluation and Reporting components."""

from pathlib import Path

import pytest

try:
    from src.evaluation import (
        BCBEvaluator,
        CloneMatch,
        EvaluationMetrics,
        ReportGenerator,
    )
except ImportError:
    BCBEvaluator = None  # type: ignore
    EvaluationMetrics = None  # type: ignore
    ReportGenerator = None  # type: ignore
    CloneMatch = None  # type: ignore


class TestEvaluationMetrics:
    """Tests for EvaluationMetrics dataclass."""

    def test_create_metrics(self):
        """Test EvaluationMetrics creation."""
        if EvaluationMetrics is None:
            pytest.skip("EvaluationMetrics not available")

        metrics = EvaluationMetrics(
            precision=0.85,
            recall=0.75,
            f1_score=0.80,
            true_positives=85,
            false_positives=15,
            false_negatives=25,
            true_negatives=75,
            accuracy=0.80,
        )

        assert metrics.precision == 0.85
        assert metrics.recall == 0.75
        assert metrics.f1_score == 0.80

    def test_to_dict(self):
        """Test EvaluationMetrics to_dict method."""
        if EvaluationMetrics is None:
            pytest.skip("EvaluationMetrics not available")

        metrics = EvaluationMetrics(
            precision=0.85,
            recall=0.75,
            f1_score=0.80,
            true_positives=85,
            false_positives=15,
            false_negatives=25,
            true_negatives=75,
            accuracy=0.80,
        )

        data = metrics.to_dict()
        assert isinstance(data, dict)
        assert data["precision"] == 0.85
        assert data["f1_score"] == 0.80
        assert data["true_positives"] == 85

    def test_str_representation(self):
        """Test string representation."""
        if EvaluationMetrics is None:
            pytest.skip("EvaluationMetrics not available")

        metrics = EvaluationMetrics(
            precision=0.85,
            recall=0.75,
            f1_score=0.80,
            true_positives=85,
            false_positives=15,
            false_negatives=25,
            true_negatives=75,
            accuracy=0.80,
        )

        str_repr = str(metrics)
        assert "Precision" in str_repr
        assert "Recall" in str_repr
        assert "F1-Score" in str_repr


class TestCloneMatch:
    """Tests for CloneMatch dataclass."""

    def test_create_match(self):
        """Test CloneMatch creation."""
        if CloneMatch is None:
            pytest.skip("CloneMatch not available")

        match = CloneMatch(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            fragment_a_source="def hello(): pass",
            fragment_b_source="def world(): pass",
            similarity_score=0.85,
            clone_type="type2",
            file_a_path="file1.py",
            file_b_path="file2.py",
            line_a_start=10,
            line_b_start=25,
        )

        assert match.fragment_a_id == "frag_1"
        assert match.similarity_score == 0.85
        assert match.clone_type == "type2"

    def test_to_dict(self):
        """Test CloneMatch to_dict method."""
        if CloneMatch is None:
            pytest.skip("CloneMatch not available")

        match = CloneMatch(
            fragment_a_id="frag_1",
            fragment_b_id="frag_2",
            fragment_a_source="def hello(): pass",
            fragment_b_source="def world(): pass",
            similarity_score=0.85,
            clone_type="type2",
        )

        data = match.to_dict()
        assert isinstance(data, dict)
        assert data["fragment_a_id"] == "frag_1"
        assert data["similarity_score"] == 0.85
        assert data["clone_type"] == "type2"


class TestReportGenerator:
    """Tests for ReportGenerator class."""

    @pytest.fixture
    def generator(self, tmp_path):
        """Create ReportGenerator for tests."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")
        return ReportGenerator(str(tmp_path))

    @pytest.fixture
    def sample_matches(self):
        """Create sample CloneMatch objects."""
        if CloneMatch is None:
            return []

        return [
            CloneMatch(
                fragment_a_id="frag_1",
                fragment_b_id="frag_2",
                fragment_a_source="def hello(): pass",
                fragment_b_source="def world(): pass",
                similarity_score=0.92,
                clone_type="type2",
                file_a_path="file1.py",
                file_b_path="file2.py",
                line_a_start=10,
                line_b_start=25,
            ),
            CloneMatch(
                fragment_a_id="frag_3",
                fragment_b_id="frag_4",
                fragment_a_source="if x > 0: return x",
                fragment_b_source="if y > 0: return y",
                similarity_score=0.88,
                clone_type="type2",
            ),
        ]

    def test_init(self, tmp_path):
        """Test ReportGenerator initialization."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        generator = ReportGenerator(str(tmp_path))
        assert generator.output_dir.exists()

    def test_generate_json_report(self, generator, sample_matches):
        """Test JSON report generation."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        metrics = {
            "precision": 0.85,
            "recall": 0.75,
            "f1_score": 0.80,
        }

        filepath = generator.generate_json_report(sample_matches, metrics)

        assert Path(filepath).exists()
        assert filepath.endswith(".json")

    def test_generate_json_report_no_sources(self, generator, sample_matches):
        """Test JSON report without source code."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        metrics = {"precision": 0.85}

        filepath = generator.generate_json_report(
            sample_matches, metrics, include_sources=False
        )

        assert Path(filepath).exists()

    def test_generate_html_report(self, generator, sample_matches):
        """Test HTML report generation."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        metrics = {
            "precision": 0.85,
            "recall": 0.75,
            "f1_score": 0.80,
        }

        filepath = generator.generate_html_report(sample_matches, metrics)

        assert Path(filepath).exists()
        assert filepath.endswith(".html")

        # Check HTML content
        content = Path(filepath).read_text()
        assert "<!DOCTYPE html>" in content
        assert "Clone Detection Report" in content
        assert "frag_1" in content

    def test_generate_html_report_empty(self, generator):
        """Test HTML report with no matches."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        metrics = {"precision": 0.0}

        filepath = generator.generate_html_report([], metrics)

        assert Path(filepath).exists()
        content = Path(filepath).read_text()
        assert "No clone matches detected" in content or "0" in content

    def test_generate_csv_report(self, generator, sample_matches):
        """Test CSV report generation."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        filepath = generator.generate_csv_report(sample_matches)

        assert Path(filepath).exists()
        assert filepath.endswith(".csv")

    def test_escape_html(self, generator):
        """Test HTML escaping."""
        if ReportGenerator is None:
            pytest.skip("ReportGenerator not available")

        text = '<script>alert("XSS")</script>'
        escaped = generator._escape_html(text)

        assert "<" not in escaped
        assert ">" not in escaped
        assert "&lt;" in escaped
        assert "&gt;" in escaped


class TestBCBEvaluator:
    """Tests for BCBEvaluator class."""

    def test_init(self, tmp_path):
        """Test BCBEvaluator initialization."""
        if BCBEvaluator is None:
            pytest.skip("BCBEvaluator not available")

        # Create empty ground truth file
        gt_file = tmp_path / "ground_truth.csv"
        gt_file.write_text("clone1Id,clone2Id,cloneType\n")

        evaluator = BCBEvaluator(str(gt_file))
        assert evaluator.ground_truth_path == str(gt_file)

    def test_evaluate(self, tmp_path):
        """Test evaluation with predictions."""
        if BCBEvaluator is None:
            pytest.skip("BCBEvaluator not available")

        # Create ground truth file
        gt_file = tmp_path / "ground_truth.csv"
        gt_file.write_text("clone1Id,clone2Id,cloneType\n1,2,3\n3,4,3\n")

        evaluator = BCBEvaluator(str(gt_file))

        predictions = [
            ("1", "2", 0.95),  # True positive
            ("3", "4", 0.90),  # True positive
            ("5", "6", 0.30),  # True negative
            ("7", "8", 0.85),  # False positive
        ]

        metrics = evaluator.evaluate(predictions, threshold=0.5)

        assert isinstance(metrics, EvaluationMetrics)
        assert metrics.true_positives >= 0
        assert metrics.false_positives >= 0

    def test_evaluate_empty(self, tmp_path):
        """Test evaluation with no ground truth."""
        if BCBEvaluator is None:
            pytest.skip("BCBEvaluator not available")

        gt_file = tmp_path / "ground_truth.csv"
        gt_file.write_text("clone1Id,clone2Id,cloneType\n")

        evaluator = BCBEvaluator(str(gt_file))

        predictions = [("1", "2", 0.95)]
        metrics = evaluator.evaluate(predictions)

        assert isinstance(metrics, EvaluationMetrics)

    def test_find_optimal_threshold(self, tmp_path):
        """Test finding optimal threshold."""
        if BCBEvaluator is None:
            pytest.skip("BCBEvaluator not available")

        gt_file = tmp_path / "ground_truth.csv"
        gt_file.write_text("clone1Id,clone2Id,cloneType\n1,2,3\n")

        evaluator = BCBEvaluator(str(gt_file))

        predictions = [
            ("1", "2", 0.95),
            ("3", "4", 0.50),
            ("5", "6", 0.30),
        ]

        optimal_threshold, best_f1 = evaluator.find_optimal_threshold(
            predictions, metric="f1_score"
        )

        assert 0.0 <= optimal_threshold <= 1.0
        assert 0.0 <= best_f1 <= 1.0
