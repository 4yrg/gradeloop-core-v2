"""
Stylometry Model for AI Code Detection (Stage 1).

This module provides a lightweight machine learning model wrapper
for stylometric classification of code as AI-generated vs human-written.
"""

import os
import logging
import joblib
import numpy as np
from typing import Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

from .stylometry_extractor import StylometryExtractor

logger = logging.getLogger(__name__)


@dataclass
class StylometryPrediction:
    """
    Stylometry prediction result.
    """
    label: str  # 'human' or 'ai'
    confidence: float  # 0.0 to 1.0
    probability_human: float
    probability_ai: float
    features: Dict[str, Any]
    metadata: Dict[str, Any]


class StylometryModel:
    """
    Lightweight stylometry model for Stage 1 AI code detection.
    
    Uses logistic regression on stylometric features for fast inference.
    """
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize the stylometry model.
        
        Args:
            model_path: Path to saved model file (joblib format)
        """
        self.model_path = model_path
        self.model = None
        self.extractor = StylometryExtractor()
        self.is_loaded = False
        
        # Default model if no path provided
        self._create_default_model()
    
    def _create_default_model(self):
        """Create a default logistic regression pipeline."""
        # Create a simple pipeline with scaling and logistic regression
        self.model = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', LogisticRegression(
                random_state=42,
                max_iter=1000,
                solver='liblinear'  # Fast for small datasets
            ))
        ])
        logger.info("Created default stylometry model pipeline")
    
    def load_model(self, model_path: Optional[str] = None) -> bool:
        """
        Load trained model from file.
        
        Args:
            model_path: Path to model file (overrides instance path)
            
        Returns:
            True if model loaded successfully, False otherwise
        """
        path = model_path or self.model_path
        
        if not path or not os.path.exists(path):
            logger.warning(f"Stylometry model not found at {path}, using default untrained model")
            return False
        
        try:
            self.model = joblib.load(path)
            self.is_loaded = True
            logger.info(f"Loaded stylometry model from {path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading stylometry model from {path}: {e}")
            self._create_default_model()
            return False
    
    def save_model(self, model_path: str) -> bool:
        """
        Save trained model to file.
        
        Args:
            model_path: Path where to save the model
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            
            joblib.dump(self.model, model_path)
            self.model_path = model_path
            logger.info(f"Saved stylometry model to {model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving stylometry model to {model_path}: {e}")
            return False
    
    def train(self, code_samples: list, labels: list, test_size: float = 0.2) -> Dict[str, Any]:
        """
        Train the stylometry model on labeled data.
        
        Args:
            code_samples: List of code strings
            labels: List of labels (0 for human, 1 for AI)
            test_size: Fraction of data for testing
            
        Returns:
            Training metrics dictionary
        """
        logger.info(f"Training stylometry model on {len(code_samples)} samples")
        
        try:
            # Extract features for all samples
            X = []
            for code in code_samples:
                features = self.extractor.get_feature_vector(code)
                X.append(features)
            
            X = np.array(X)
            y = np.array(labels)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42, stratify=y
            )
            
            # Train model
            self.model.fit(X_train, y_train)
            self.is_loaded = True
            
            # Evaluate
            train_score = self.model.score(X_train, y_train)
            test_score = self.model.score(X_test, y_test)
            
            y_pred = self.model.predict(X_test)
            
            metrics = {
                'train_samples': len(X_train),
                'test_samples': len(X_test),
                'train_accuracy': train_score,
                'test_accuracy': test_score,
                'classification_report': classification_report(y_test, y_pred),
                'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            }
            
            logger.info(f"Training completed. Test accuracy: {test_score:.3f}")
            return metrics
            
        except Exception as e:
            logger.error(f"Error training stylometry model: {e}")
            return {'error': str(e)}
    
    def predict(self, code: str, language: str = 'python') -> StylometryPrediction:
        """
        Predict whether code is AI-generated or human-written.
        
        Args:
            code: Source code string
            language: Programming language
            
        Returns:
            StylometryPrediction object with results
        """
        try:
            # Extract features
            features = self.extractor.extract_features(code, language)
            feature_vector = self.extractor.get_feature_vector(code, language)
            
            if not self.is_loaded:
                # Return uncertain prediction if model not trained
                logger.warning("Stylometry model not trained, returning uncertain prediction")
                return StylometryPrediction(
                    label='uncertain',
                    confidence=0.5,
                    probability_human=0.5,
                    probability_ai=0.5,
                    features=features,
                    metadata={
                        'model_trained': False,
                        'warning': 'Model not trained, returning default prediction'
                    }
                )
            
            # Make prediction
            X = np.array([feature_vector])
            probabilities = self.model.predict_proba(X)[0]
            prediction = self.model.predict(X)[0]
            
            # Convert to human-readable format
            prob_human = probabilities[0]  # Class 0 = human
            prob_ai = probabilities[1]     # Class 1 = AI
            
            label = 'human' if prediction == 0 else 'ai'
            confidence = max(prob_human, prob_ai)
            
            return StylometryPrediction(
                label=label,
                confidence=confidence,
                probability_human=prob_human,
                probability_ai=prob_ai,
                features=features,
                metadata={
                    'model_trained': True,
                    'feature_count': len(feature_vector),
                    'language': language
                }
            )
            
        except Exception as e:
            logger.error(f"Error in stylometry prediction: {e}")
            # Return safe fallback
            return StylometryPrediction(
                label='uncertain',
                confidence=0.5,
                probability_human=0.5,
                probability_ai=0.5,
                features={},
                metadata={'error': str(e)}
            )
    
    def predict_batch(self, code_samples: list, language: str = 'python') -> list:
        """
        Predict multiple code samples in batch.
        
        Args:
            code_samples: List of source code strings
            language: Programming language
            
        Returns:
            List of StylometryPrediction objects
        """
        return [self.predict(code, language) for code in code_samples]
    
    def get_feature_importance(self, top_n: int = 10) -> Dict[str, float]:
        """
        Get feature importance scores from the trained model.
        
        Args:
            top_n: Number of top features to return
            
        Returns:
            Dictionary of feature names and importance scores
        """
        if not self.is_loaded or not hasattr(self.model.named_steps['classifier'], 'coef_'):
            logger.warning("Model not trained or doesn't support feature importance")
            return {}
        
        try:
            # Get logistic regression coefficients
            coef = self.model.named_steps['classifier'].coef_[0]
            
            # Create feature names (simplified)
            feature_names = [f'feature_{i}' for i in range(len(coef))]
            
            # Sort by absolute coefficient value
            importance_pairs = list(zip(feature_names, np.abs(coef)))
            importance_pairs.sort(key=lambda x: x[1], reverse=True)
            
            return dict(importance_pairs[:top_n])
            
        except Exception as e:
            logger.error(f"Error getting feature importance: {e}")
            return {}
    
    @classmethod
    def create_demo_model(cls, save_path: Optional[str] = None) -> 'StylometryModel':
        """
        Create a demo model with synthetic training data.
        
        This is useful for testing and demonstration purposes.
        
        Args:
            save_path: Optional path to save the trained model
            
        Returns:
            Trained StylometryModel instance
        """
        logger.info("Creating demo stylometry model with synthetic data")
        
        # Generate some synthetic training data
        human_samples = [
            "def calculate_fibonacci(n):\n    if n <= 1:\n        return n\n    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)",
            "class MyProcessor:\n    def __init__(self, data):\n        self.data = data\n        self.results = []\n    \n    def process(self):\n        for item in self.data:\n            processed = self._transform(item)\n            self.results.append(processed)",
            "import os\nimport sys\n\ndef main():\n    if len(sys.argv) != 2:\n        print('Usage: script.py <filename>')\n        return\n    \n    filename = sys.argv[1]\n    if os.path.exists(filename):\n        with open(filename, 'r') as f:\n            content = f.read()\n            print(f'File has {len(content)} characters')",
        ]
        
        ai_samples = [
            "def function_name():\n    # TODO: implement this function\n    pass",
            "# Add your code here\nclass ClassName:\n    pass",
            "def calculate_result(input_data):\n    result = None\n    # Your code goes here\n    return result",
        ]
        
        # Combine samples and labels
        all_samples = human_samples + ai_samples
        all_labels = [0] * len(human_samples) + [1] * len(ai_samples)  # 0=human, 1=ai
        
        # Create and train model
        model = cls()
        metrics = model.train(all_samples, all_labels, test_size=0.3)
        
        if save_path:
            model.save_model(save_path)
        
        logger.info(f"Demo model created with metrics: {metrics.get('test_accuracy', 'N/A')}")
        return model