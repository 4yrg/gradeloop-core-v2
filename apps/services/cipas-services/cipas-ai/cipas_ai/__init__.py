"""
CIPAS-AI: Code Intelligence and Plagiarism Assessment System - AI Detection
A modern FastAPI-based service for AI-generated code detection using 2-stage pipeline.
"""

__version__ = "2.0.0"
__author__ = "SLIIT Team"
__email__ = "team@sliit.lk"

from .config.settings import get_settings

# Package exports
__all__ = ["get_settings", "__version__"]