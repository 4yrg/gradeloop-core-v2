"""
Random Forest Classifier: Train and predict clone pairs.

This module provides a scikit-learn based Random Forest classifier
for distinguishing clone pairs from non-clone pairs using 6D feature vectors.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np

try:
    import joblib
    from sklearn.ensemble import RandomForestClassifier as SKLearnRandomForest
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )
    from sklearn.model_selection import cross_val_score, train_test_split
except ImportError:
    SKLearnRandomForest = None  # type: ignore
    train_test_split = None  # type: ignore
    cross_val_score = None  # type: ignore
    classification_report = None  # type: ignore
    confusion_matrix = None  # type: ignore
    precision_score = None  # type: ignore
    recall_score = None  # type: ignore
    f1_score = None  # type: ignore
    accuracy_score = None  # type: ignore
    joblib = None  # type: ignore


class RandomForestClassifier:
    """
    Random Forest classifier for clone detection.

    Trained on 6D feature vectors (Lev, LevRatio, Jaro, JW, Jaccard, Dice)
    to classify code fragment pairs as clones or non-clones.

    Example:
        >>> clf = RandomForestClassifier(n_estimators=100, max_depth=10)
        >>> metrics = clf.train(X_train, y_train)
        >>> predictions = clf.predict(X_test)
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 10,
        min_samples_split: int = 2,
        min_samples_leaf: int = 1,
        random_state: int = 42,
        n_jobs: int = -1,
    ):
        """
        Initialize Random Forest classifier.

        Args:
            n_estimators: Number of trees in the forest
            max_depth: Maximum depth of each tree
            min_samples_split: Minimum samples required to split a node
            min_samples_leaf: Minimum samples required at leaf node
            random_state: Random seed for reproducibility
            n_jobs: Number of parallel jobs (-1 for all CPUs)
        """
        if SKLearnRandomForest is None:
            raise ImportError(
                "scikit-learn is not installed. Install with: pip install scikit-learn"
            )

        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state
        self.n_jobs = n_jobs

        self.model = SKLearnRandomForest(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            random_state=random_state,
            n_jobs=n_jobs,
            class_weight="balanced",  # Handle imbalanced datasets
        )
        self.is_trained = False
        self.feature_names = [
            "levenshtein_distance",
            "levenshtein_ratio",
            "jaro_similarity",
            "jaro_winkler_similarity",
            "jaccard_similarity",
            "dice_coefficient",
        ]

    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        test_size: float = 0.2,
        use_cross_validation: bool = True,
        cv_folds: int = 5,
    ) -> Dict:
        """
        Train the classifier.

        Args:
            X: Feature matrix (N x 6)
            y: Labels (0 = non-clone, 1 = clone)
            test_size: Fraction of data for validation
            use_cross_validation: Whether to use cross-validation
            cv_folds: Number of cross-validation folds

        Returns:
            Dictionary with training metrics
        """
        # Split into train/validation
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=test_size, random_state=self.random_state, stratify=y
        )

        # Train
        self.model.fit(X_train, y_train)
        self.is_trained = True

        # Evaluate on validation set
        y_pred = self.model.predict(X_val)
        y_pred_proba = self.model.predict_proba(X_val)[:, 1]

        # Calculate metrics
        metrics = {
            "accuracy": float(accuracy_score(y_val, y_pred)),
            "precision": float(precision_score(y_val, y_pred)),
            "recall": float(recall_score(y_val, y_pred)),
            "f1_score": float(f1_score(y_val, y_pred)),
            "classification_report": classification_report(
                y_val, y_pred, target_names=["non-clone", "clone"]
            ),
            "confusion_matrix": confusion_matrix(y_val, y_pred).tolist(),
            "feature_importances": dict(
                zip(self.feature_names, self.model.feature_importances_.tolist())
            ),
        }

        # Cross-validation (optional)
        if use_cross_validation:
            cv_scores = cross_val_score(
                self.model, X, y, cv=cv_folds, scoring="f1", n_jobs=self.n_jobs
            )
            metrics["cv_mean_f1"] = float(cv_scores.mean())
            metrics["cv_std_f1"] = float(cv_scores.std())

        return metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Predict clone labels for feature vectors.

        Args:
            X: Feature matrix (N x 6)

        Returns:
            Predicted labels (0 or 1)
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before prediction")

        return self.model.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict clone probabilities.

        Args:
            X: Feature matrix (N x 6)

        Returns:
            Probability matrix (N x 2) - [P(non-clone), P(clone)]
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before prediction")

        return self.model.predict_proba(X)

    def predict_clone_probability(self, X: np.ndarray) -> np.ndarray:
        """
        Predict probability of being a clone.

        Args:
            X: Feature matrix (N x 6)

        Returns:
            Array of clone probabilities (P(clone))
        """
        proba = self.predict_proba(X)
        return proba[:, 1]

    def get_feature_importances(self) -> Dict[str, float]:
        """
        Get feature importances from the trained model.

        Returns:
            Dictionary mapping feature names to importances
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained to get feature importances")

        return dict(zip(self.feature_names, self.model.feature_importances_.tolist()))

    def save(self, path: str):
        """
        Save trained model to disk.

        Args:
            path: Path to save the model
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before saving")

        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path)

    def load(self, path: str):
        """
        Load trained model from disk.

        Args:
            path: Path to load the model from
        """
        if joblib is None:
            raise ImportError("joblib is not installed")

        self.model = joblib.load(path)
        self.is_trained = True

    def evaluate(
        self, X_test: np.ndarray, y_test: np.ndarray, threshold: float = 0.5
    ) -> Dict:
        """
        Evaluate the model on test data.

        Args:
            X_test: Test feature matrix
            y_test: Test labels
            threshold: Classification threshold

        Returns:
            Dictionary with evaluation metrics
        """
        y_pred_proba = self.predict_proba(X_test)[:, 1]
        y_pred = (y_pred_proba >= threshold).astype(int)

        return {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred)),
            "recall": float(recall_score(y_test, y_pred)),
            "f1_score": float(f1_score(y_test, y_pred)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        }
