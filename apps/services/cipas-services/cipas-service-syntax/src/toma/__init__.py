"""ToMA IR transformation and feature extraction for Type-3 clone detection."""

from .features import FeatureExtractor
from .mapper import TokenType, ToMAMapper
from .pipeline import ToMAPipeline, ToMAResult

__all__ = [
    "ToMAMapper",
    "TokenType",
    "FeatureExtractor",
    "ToMAPipeline",
    "ToMAResult",
]
