"""Core utilities for CIPAS-AI"""

from .feature_extractor import StructuralFeatures, extract_features, get_extractor
from .stylometry_extractor import StylometryExtractor

__all__ = [
    "StructuralFeatures",
    "extract_features", 
    "get_extractor",
    "StylometryExtractor"
]