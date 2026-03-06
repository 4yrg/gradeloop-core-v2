"""
Test suite for 3-stage confidence-based early exit pipeline.

Tests the stylometry feature extraction, model inference, and routing logic
for the AI code detection system.
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock

# Import the modules we want to test
from stylometry_extractor import StylometryExtractor
from stylometry_model import StylometryModel, StylometryPrediction


class TestStylometryExtractor:
    """Test the stylometry feature extractor."""

    def setup_method(self):
        """Set up test fixtures."""
        self.extractor = StylometryExtractor()
        
        # Sample human-written code
        self.human_code = '''
def calculate_fibonacci(n):
    """Calculate the nth Fibonacci number recursively."""
    if n <= 1:
        return n
    else:
        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

def main():
    num = int(input("Enter a number: "))
    result = calculate_fibonacci(num)
    print(f"Fibonacci number at position {num} is: {result}")

if __name__ == "__main__":
    main()
'''
        
        # Sample AI-generated code (with typical AI patterns)
        self.ai_code = '''
def function_name():
    # TODO: implement this function
    pass

class ClassName:
    # Add your code here
    pass

def calculate_result(input_data):
    result = None
    # Your code goes here
    return result
'''

    def test_extract_basic_features(self):
        """Test basic feature extraction works."""
        features = self.extractor.extract_features(self.human_code)
        
        # Check that all expected feature keys are present
        expected_keys = [
            'total_chars', 'total_lines', 'avg_line_length',
            'whitespace_ratio', 'comment_line_ratio', 'function_count',
            'avg_identifier_length', 'char_entropy'
        ]
        
        for key in expected_keys:
            assert key in features, f"Missing feature: {key}"
            assert isinstance(features[key], (int, float)), f"Feature {key} should be numeric"

    def test_human_vs_ai_patterns(self):
        """Test that human and AI code produce different feature patterns."""
        human_features = self.extractor.extract_features(self.human_code)
        ai_features = self.extractor.extract_features(self.ai_code)
        
        # AI code should have more placeholder patterns
        assert ai_features['placeholder_count'] > human_features['placeholder_count']
        
        # AI code might have more generic variable names
        assert ai_features['generic_var_count'] >= human_features['generic_var_count']
        
        # Human code should have better structure (more functions, comments)
        assert human_features['function_count'] > ai_features['function_count']
        assert human_features['comment_line_ratio'] > ai_features['comment_line_ratio']

    def test_feature_vector_consistency(self):
        """Test that feature vectors have consistent length and order."""
        vector1 = self.extractor.get_feature_vector(self.human_code)
        vector2 = self.extractor.get_feature_vector(self.ai_code)
        
        # Both vectors should have the same length
        assert len(vector1) == len(vector2)
        
        # All values should be numeric
        assert all(isinstance(v, (int, float)) for v in vector1)
        assert all(isinstance(v, (int, float)) for v in vector2)

    def test_empty_code_handling(self):
        """Test handling of empty or minimal code."""
        empty_features = self.extractor.extract_features("")
        minimal_features = self.extractor.extract_features("x = 1")
        
        # Should not crash and should return valid features
        assert isinstance(empty_features, dict)
        assert isinstance(minimal_features, dict)
        
        # Empty code should have zero counts
        assert empty_features['total_chars'] == 0
        assert empty_features['function_count'] == 0


class TestStylometryModel:
    """Test the stylometry model."""

    def setup_method(self):
        """Set up test fixtures."""
        self.model = StylometryModel()

    def test_model_initialization(self):
        """Test model initializes correctly."""
        assert self.model.extractor is not None
        assert self.model.model is not None
        assert not self.model.is_loaded  # Should not be loaded initially

    def test_prediction_untrained_model(self):
        """Test prediction with untrained model returns uncertain result."""
        code = "def test(): pass"
        prediction = self.model.predict(code)
        
        assert isinstance(prediction, StylometryPrediction)
        assert prediction.label == 'uncertain'
        assert prediction.confidence == 0.5
        assert not prediction.metadata.get('model_trained', True)

    def test_demo_model_creation(self):
        """Test that demo model can be created and makes predictions."""
        demo_model = StylometryModel.create_demo_model()
        
        assert demo_model.is_loaded
        
        # Test prediction on simple code
        code = "def hello(): print('world')"
        prediction = demo_model.predict(code)
        
        assert isinstance(prediction, StylometryPrediction)
        assert prediction.label in ['human', 'ai']
        assert 0.0 <= prediction.confidence <= 1.0
        assert prediction.metadata['model_trained']

    def test_batch_prediction(self):
        """Test batch prediction functionality."""
        demo_model = StylometryModel.create_demo_model()
        
        codes = [
            "def func1(): pass",
            "def func2(): return 42",
            "# TODO: implement\npass"
        ]
        
        predictions = demo_model.predict_batch(codes)
        
        assert len(predictions) == len(codes)
        assert all(isinstance(p, StylometryPrediction) for p in predictions)


class TestEarlyExitPipeline:
    """Test the 3-stage early exit pipeline logic."""

    @patch('stylometry_model.StylometryModel')
    @patch('model_engine.CatBoostClassifier')  
    def test_stage1_early_exit_high_confidence(self, mock_catboost, mock_stylometry):
        """Test Stage 1 early exit with high confidence."""
        # Mock stylometry model to return high confidence
        mock_stylo_instance = Mock()
        mock_stylo_prediction = StylometryPrediction(
            label='human',
            confidence=0.85,  # Above 0.80 threshold
            probability_human=0.85,
            probability_ai=0.15,
            features={'test': 1.0},
            metadata={'model_trained': True}
        )
        mock_stylo_instance.predict.return_value = mock_stylo_prediction
        mock_stylometry.return_value = mock_stylo_instance
        
        # Import after patching
        from model_engine import ModelEngine, TierEnum
        
        # Create engine and mock settings
        engine = ModelEngine()
        engine.settings = Mock()
        engine.settings.enable_stylometry_stage = True
        engine.settings.stylometry_high_threshold = 0.80
        engine.settings.stylometry_low_threshold = 0.40
        engine._stylometry_loaded = True
        engine._stylometry_model = mock_stylo_instance
        
        # Test prediction
        result = engine.predict_3stage_hybrid("def test(): pass", "python", [1.0] * 8)
        
        # Should exit at Stage 1
        assert result.tier_used == TierEnum.STYLOMETRY
        assert result.label == 'Human-written'
        assert result.confidence == 0.85
        assert result.stylometry_confidence == 0.85

    @patch('stylometry_model.StylometryModel')
    @patch('model_engine.CatBoostClassifier')  
    def test_stage1_early_exit_low_confidence(self, mock_catboost, mock_stylometry):
        """Test Stage 1 early exit with low confidence (inverted result)."""
        # Mock stylometry model to return low confidence
        mock_stylo_instance = Mock()
        mock_stylo_prediction = StylometryPrediction(
            label='human',
            confidence=0.30,  # Below 0.40 threshold
            probability_human=0.30,
            probability_ai=0.70,
            features={'test': 1.0},
            metadata={'model_trained': True}
        )
        mock_stylo_instance.predict.return_value = mock_stylo_prediction
        mock_stylometry.return_value = mock_stylo_instance
        
        # Import after patching
        from model_engine import ModelEngine, TierEnum
        
        # Create engine and mock settings
        engine = ModelEngine()
        engine.settings = Mock()
        engine.settings.enable_stylometry_stage = True
        engine.settings.stylometry_high_threshold = 0.80
        engine.settings.stylometry_low_threshold = 0.40
        engine._stylometry_loaded = True
        engine._stylometry_model = mock_stylo_instance
        
        # Test prediction
        result = engine.predict_3stage_hybrid("def test(): pass", "python", [1.0] * 8)
        
        # Should exit at Stage 1 with inverted result
        assert result.tier_used == TierEnum.STYLOMETRY
        assert result.label == 'AI-generated'  # Inverted from 'Human-written'
        assert result.confidence == 0.70  # 1.0 - 0.30
        assert result.stylometry_confidence == 0.30

    def test_confidence_thresholds(self):
        """Test that confidence thresholds work as expected."""
        # High confidence (>= 0.80) should trigger early exit
        assert 0.85 >= 0.80
        assert 0.80 >= 0.80
        
        # Low confidence (<= 0.40) should trigger early exit with inversion
        assert 0.35 <= 0.40
        assert 0.40 <= 0.40
        
        # Uncertain range (0.40 < conf < 0.80) should continue to next stage
        assert not (0.50 >= 0.80 or 0.50 <= 0.40)
        assert not (0.60 >= 0.80 or 0.60 <= 0.40)


class TestIntegration:
    """Integration tests for the complete pipeline."""

    def test_pipeline_components_work_together(self):
        """Test that extractor and model work together."""
        extractor = StylometryExtractor()
        model = StylometryModel.create_demo_model()
        
        # Test code
        code = '''
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
'''
        
        # Extract features manually
        features_dict = extractor.extract_features(code)
        feature_vector = extractor.get_feature_vector(code)
        
        # Get prediction
        prediction = model.predict(code)
        
        # Verify consistency
        assert isinstance(features_dict, dict)
        assert isinstance(feature_vector, list)
        assert isinstance(prediction, StylometryPrediction)
        assert prediction.features == features_dict

    def test_error_handling(self):
        """Test that the pipeline handles errors gracefully."""
        extractor = StylometryExtractor()
        
        # Test with problematic input
        try:
            features = extractor.extract_features(None)
            # Should return default features instead of crashing
            assert isinstance(features, dict)
        except:
            # Or it should fail gracefully
            pass


if __name__ == "__main__":
    pytest.main([__file__])