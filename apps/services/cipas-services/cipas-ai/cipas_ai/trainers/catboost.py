"""CatBoost model trainer"""

import logging
from typing import Dict, Any, Optional, Callable, Tuple
import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.feature_extraction.text import TfidfVectorizer

from ..config.settings import Settings

logger = logging.getLogger(__name__)

class CatBoostTrainer:
    """CatBoost model trainer for code classification"""
    
    def __init__(self, settings: Settings, config_overrides: Optional[Dict[str, Any]] = None):
        self.settings = settings
        self.config = self._merge_config(config_overrides)
        self.vectorizer = None
        
    def _merge_config(self, overrides: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge base config with overrides"""
        cb = self.settings.models.catboost
        use_gpu = cb.task_type.upper() == "GPU"
        base_config = {
            "iterations": cb.iterations,
            "depth": cb.depth,
            "learning_rate": cb.learning_rate,
            "l2_leaf_reg": cb.l2_leaf_reg,
            "border_count": cb.border_count,
            "random_seed": cb.random_seed,
            "verbose": cb.verbose,
            "early_stopping_rounds": cb.early_stopping_rounds,
            "task_type": "GPU" if use_gpu else "CPU",
        }
        # 'devices' is a GPU-only parameter; omit it entirely when using CPU
        if use_gpu:
            base_config["devices"] = cb.devices
        
        if overrides:
            base_config.update(overrides)
            
        return base_config
    
    def get_config(self) -> Dict[str, Any]:
        """Get current training configuration"""
        return self.config.copy()
    
    async def train(
        self,
        train_data: pd.DataFrame,
        test_data: Optional[pd.DataFrame] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Tuple[Any, Dict[str, Any]]:
        """Train CatBoost model"""
        
        if progress_callback:
            progress_callback(5.0, "Preparing training data")
        
        # Prepare features and targets
        X_train, y_train = self._prepare_data(train_data)
        
        X_test, y_test = None, None
        if test_data is not None:
            X_test, y_test = self._prepare_data(test_data)
        
        if progress_callback:
            progress_callback(15.0, "Initializing CatBoost model")
        
        # Initialize model
        model = CatBoostClassifier(
            **self.config,
            loss_function='Logloss' if len(np.unique(y_train)) == 2 else 'MultiClass'
        )
        
        if progress_callback:
            progress_callback(20.0, "Starting CatBoost training")
        
        # Prepare evaluation set
        eval_set = None
        if X_test is not None and y_test is not None:
            eval_set = (X_test, y_test)
        
        # Train model with progress tracking
        training_history = {}
        
        # Custom progress callback for CatBoost
        def catboost_progress(info):
            if hasattr(info, 'iteration') and progress_callback:
                iteration = info.iteration
                total_iterations = self.config.get('iterations', 1000)
                progress = 20 + (iteration / total_iterations) * 60
                progress_callback(
                    progress, 
                    f"CatBoost training: iteration {iteration}/{total_iterations}"
                )
        
        # Fit model
        fit_params = {
            'X': X_train,
            'y': y_train,
            'verbose': self.config.get('verbose', False)
        }
        
        if eval_set:
            fit_params['eval_set'] = eval_set
            fit_params['use_best_model'] = True
        
        model.fit(**fit_params)
        
        if progress_callback:
            progress_callback(85.0, "Training completed, evaluating model")
        
        # Get training history
        training_history = {
            "iterations_trained": model.tree_count_,
            "best_iteration": getattr(model, 'best_iteration_', model.tree_count_),
            "feature_importances": model.feature_importances_.tolist() if hasattr(model, 'feature_importances_') else []
        }
        
        # Add evaluation metrics
        if eval_set:
            train_pred = model.predict(X_train)
            test_pred = model.predict(X_test)
            
            training_history.update({
                "train_accuracy": float(accuracy_score(y_train, train_pred)),
                "test_accuracy": float(accuracy_score(y_test, test_pred)),
                "train_samples": len(y_train),
                "test_samples": len(y_test)
            })
        
        if progress_callback:
            progress_callback(100.0, "CatBoost training completed successfully")
        
        # Create combined model with vectorizer
        combined_model = CatBoostModelWrapper(model, self.vectorizer)
        
        return combined_model, training_history
    
    async def evaluate(self, model: Any, test_data: pd.DataFrame) -> Dict[str, Any]:
        """Evaluate trained model"""
        
        X_test, y_test = self._prepare_data(test_data, fit_vectorizer=False)
        
        # Get predictions
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)
        
        # Compute metrics
        accuracy = accuracy_score(y_test, y_pred)
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        
        return {
            "accuracy": float(accuracy),
            "classification_report": report,
            "predictions": y_pred.tolist(),
            "probabilities": y_pred_proba.tolist(),
            "test_samples": len(y_test)
        }
    
    def _prepare_data(self, data: pd.DataFrame, fit_vectorizer: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for training/evaluation.
        Expects data already normalized to (code: str, label: int) by the orchestrator.
        """
        # Extract code and labels
        codes = data["code"].astype(str).tolist()
        labels = data["label"].values
        
        # Initialize or use existing vectorizer
        if self.vectorizer is None:
            self.vectorizer = TfidfVectorizer(
                max_features=10000,
                ngram_range=(1, 3),
                stop_words='english',
                lowercase=True,
                strip_accents='ascii'
            )
            X = self.vectorizer.fit_transform(codes)
        else:
            X = self.vectorizer.transform(codes)
        
        # Convert to dense array for CatBoost
        X = X.toarray()
        
        return X, labels


class CatBoostModelWrapper:
    """Wrapper to combine CatBoost model with vectorizer for seamless prediction"""
    
    def __init__(self, model, vectorizer):
        self.model = model
        self.vectorizer = vectorizer
    
    def predict(self, X):
        """Predict labels for raw text input"""
        if isinstance(X, (list, pd.Series)):
            # Raw text input - vectorize first
            X_vectorized = self.vectorizer.transform(X).toarray()
            return self.model.predict(X_vectorized)
        else:
            # Already vectorized
            return self.model.predict(X)
    
    def predict_proba(self, X):
        """Predict probabilities for raw text input"""
        if isinstance(X, (list, pd.Series)):
            # Raw text input - vectorize first
            X_vectorized = self.vectorizer.transform(X).toarray()
            return self.model.predict_proba(X_vectorized)
        else:
            # Already vectorized
            return self.model.predict_proba(X)
    
    def __getattr__(self, name):
        """Delegate other method calls to the underlying model"""
        return getattr(self.model, name)