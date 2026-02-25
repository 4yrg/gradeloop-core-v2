"""
Service layer for code comparison operations.
"""

import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np
from loguru import logger


class CodeComparisonService:
    """Service for comparing code samples."""

    def __init__(self, model_path: str, language: str = "java"):
        """
        Initialize the comparison service.

        Args:
            model_path: Path to the trained ML model
            language: Default programming language
        """
        self.model_path = model_path
        self.language = language
        self._model = None
        self._parser_engine = None
        self._mapper = None
        self._extractor = None

    def _load_model(self):
        """Load the ML model if not already loaded."""
        if self._model is None:
            from ..ml import RandomForestClassifier

            self._model = RandomForestClassifier()
            self._model.load(self.model_path)
            logger.info(f"Loaded model from {self.model_path}")

    def _load_components(self):
        """Load parser and feature extraction components."""
        if self._parser_engine is None:
            from ..parser import ParserEngine
            from ..toma import FeatureExtractor, ToMAMapper

            self._parser_engine = ParserEngine()
            self._mapper = ToMAMapper(self.language)
            self._extractor = FeatureExtractor()
            logger.info(f"Loaded parser components for {self.language}")

    def extract_features(
        self, code1: str, code2: str, language: Optional[str] = None
    ) -> Tuple[np.ndarray, Dict]:
        """
        Extract ToMA features from two code samples.

        Args:
            code1: First code sample
            code2: Second code sample
            language: Programming language (overrides default)

        Returns:
            Tuple of (feature_vector, feature_details)
        """
        lang = language or self.language

        # Reload components if language changed
        if language and language != self.language:
            self._parser_engine = None
            self._mapper = None
            self._extractor = None

        self._load_components()

        if not code1.strip() or not code2.strip():
            return np.array([0.0] * 6), {
                "tokens1": [],
                "tokens2": [],
                "tokens1_count": 0,
                "tokens2_count": 0,
            }

        try:
            # Parse code
            tree1 = self._parser_engine.parse(code1.encode(), lang)
            tree2 = self._parser_engine.parse(code2.encode(), lang)

            # Map to tokens
            tokens1 = self._mapper.map_fragment(tree1.root_node, code1.encode())
            tokens2 = self._mapper.map_fragment(tree2.root_node, code2.encode())

            if len(tokens1) == 0 or len(tokens2) == 0:
                return np.array([0.0] * 6), {
                    "tokens1": [],
                    "tokens2": [],
                    "tokens1_count": 0,
                    "tokens2_count": 0,
                }

            # Extract features
            feature_tuple = self._extractor.extract_features(tokens1, tokens2)
            feature_vector = np.array(feature_tuple)

            # Get normalized features
            normalized = self._extractor.normalize_features(feature_tuple)

            feature_details = {
                "tokens1": tokens1[:20],
                "tokens2": tokens2[:20],
                "tokens1_count": len(tokens1),
                "tokens2_count": len(tokens2),
                "normalized_features": normalized,
            }

            return feature_vector, feature_details

        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            raise

    def predict_clone(self, feature_vector: np.ndarray, threshold: float = 0.5) -> Dict:
        """
        Predict if two code samples are clones.

        Args:
            feature_vector: 6D feature vector
            threshold: Classification threshold

        Returns:
            Prediction results dictionary
        """
        self._load_model()

        # Reshape for prediction
        X = feature_vector.reshape(1, -1)

        # Predict
        prediction = self._model.predict(X)[0]
        probability = self._model.predict_clone_probability(X)[0]

        # Get feature importances
        importances = self._model.get_feature_importances()

        return {
            "is_clone": bool(prediction == 1),
            "clone_probability": float(probability),
            "threshold": threshold,
            "feature_importances": importances,
        }

    def calculate_similarity_metrics(self, feature_vector: np.ndarray) -> Dict:
        """
        Calculate similarity metrics from feature vector.

        Args:
            feature_vector: 6D feature vector

        Returns:
            Dictionary with similarity metrics
        """
        lev_dist, lev_ratio, jaro, jw, jaccard, dice = feature_vector

        return {
            "levenshtein_distance": float(lev_dist),
            "levenshtein_similarity": float(lev_ratio),
            "jaro_similarity": float(jaro),
            "jaro_winkler_similarity": float(jw),
            "jaccard_similarity": float(jaccard),
            "dice_coefficient": float(dice),
            "average_similarity": float((lev_ratio + jaro + jw + jaccard + dice) / 5),
        }

    def compare(
        self,
        code1: str,
        code2: str,
        language: Optional[str] = None,
        threshold: float = 0.5,
    ) -> Dict:
        """
        Compare two code samples for clone detection.

        Args:
            code1: First code sample
            code2: Second code sample
            language: Programming language
            threshold: Classification threshold

        Returns:
            Complete comparison results dictionary
        """
        # Extract features
        feature_vector, feature_details = self.extract_features(code1, code2, language)

        # Predict
        prediction = self.predict_clone(feature_vector, threshold)

        # Calculate similarity metrics
        similarity = self.calculate_similarity_metrics(feature_vector)

        # Compile results
        results = {
            "sample1": {
                "name": "Sample 1",
                "characters": len(code1),
                "tokens": feature_details.get("tokens1_count", 0),
            },
            "sample2": {
                "name": "Sample 2",
                "characters": len(code2),
                "tokens": feature_details.get("tokens2_count", 0),
            },
            "similarity_metrics": similarity,
            "prediction": prediction,
            "feature_importances": prediction["feature_importances"],
            "language": language or self.language,
        }

        # Add message based on result
        if prediction["is_clone"]:
            confidence = prediction["clone_probability"]
            if confidence >= 0.9:
                results["message"] = "Clone detected with high confidence"
            elif confidence >= 0.7:
                results["message"] = "Clone detected with moderate confidence"
            else:
                results["message"] = "Clone detected with low confidence"
        else:
            results["message"] = "Not classified as a clone"

        return results


# Global service instance (lazy loaded)
_service: Optional[CodeComparisonService] = None


def get_service(
    model_path: str = "data/models/clone_classifier.joblib",
    language: str = "java",
) -> CodeComparisonService:
    """
    Get or create the comparison service instance.

    Args:
        model_path: Path to the trained model
        language: Default programming language

    Returns:
        CodeComparisonService instance
    """
    global _service

    if _service is None:
        from ..config import settings

        _service = CodeComparisonService(
            model_path=model_path or settings.MODEL_PATH,
            language=language or settings.DEFAULT_LANGUAGE,
        )

    return _service
