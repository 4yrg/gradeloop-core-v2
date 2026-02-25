"""Machine Learning module for scalable clone detection."""

from .bcb_training import BCBTrainingGenerator
from .classifier import RandomForestClassifier
from .faiss_index import FAISSIndex
from .inverted_index import InvertedIndex

__all__ = [
    "InvertedIndex",
    "FAISSIndex",
    "RandomForestClassifier",
    "BCBTrainingGenerator",
]
