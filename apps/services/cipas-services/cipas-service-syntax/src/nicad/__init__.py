"""NiCAD normalization pipeline for Type-1 and Type-2 clone detection."""

from .blind_renamer import BlindRenamer
from .lcs_matcher import LCSMatcher
from .noise_removal import NoiseRemover
from .pipeline import NiCADPipeline, NiCADResult
from .pretty_printer import PrettyPrinter

__all__ = [
    "NoiseRemover",
    "PrettyPrinter",
    "BlindRenamer",
    "LCSMatcher",
    "NiCADPipeline",
    "NiCADResult",
]
