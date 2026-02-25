"""
Tree-sitter Parser Engine for language-agnostic code parsing.

This module provides a wrapper class to load Tree-sitter grammar libraries
and parse source code into Concrete Syntax Trees (CST).

Supports tree-sitter 0.22.x+ (new API with language modules).
"""

from pathlib import Path
from typing import Dict, Optional

import yaml


class ParserEngine:
    """
    Wrapper class to load Tree-sitter grammar libraries and parse source code.
    Supports multiple languages via dynamic grammar loading.

    Example:
        >>> engine = ParserEngine("config/languages.yaml")
        >>> tree = engine.parse(b"def hello(): pass", "python")
        >>> print(tree.root_node)
    """

    # Language module mappings for tree-sitter 0.22+
    LANGUAGE_MODULES = {
        "python": "tree_sitter_python",
        "java": "tree_sitter_java",
        "c": "tree_sitter_c",
    }

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the Parser Engine.

        Args:
            config_path: Path to languages.yaml configuration file.
                        Defaults to "config/languages.yaml" relative to project root.
        """
        if config_path is None:
            # Go up from src/parser/ to project root, then into config/
            project_root = Path(__file__).parent.parent.parent
            config_path = str(project_root / "config" / "languages.yaml")

        self.config = self._load_config(config_path)
        self.languages = {}
        self.parsers = {}
        self._warmup()

    def _load_config(self, config_path: str) -> dict:
        """Load language configuration from YAML file."""
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")

        with open(config_file, "r") as f:
            return yaml.safe_load(f)

    def _warmup(self):
        """Pre-load all configured grammar libraries."""
        for lang_name in self.config.get("languages", {}).keys():
            try:
                self.load_language(lang_name)
            except (FileNotFoundError, ImportError):
                # Gracefully handle missing grammars during development
                pass

    def load_language(self, language: str):
        """
        Load a Tree-sitter grammar library for the specified language.

        Args:
            language: Language name (e.g., 'python', 'java', 'c')

        Returns:
            Loaded Tree-sitter Language object

        Raises:
            ValueError: If language is not supported
            ImportError: If language module is not installed
        """
        if language not in self.config.get("languages", {}):
            raise ValueError(f"Unsupported language: {language}")

        if language in self.languages:
            return self.languages[language]

        # Try to import the language module
        module_name = self.LANGUAGE_MODULES.get(language)
        if module_name is None:
            raise ValueError(f"No language module configured for: {language}")

        try:
            lang_module = __import__(module_name, fromlist=["language"])
            lang = lang_module.language()
        except ImportError as e:
            raise ImportError(
                f"Language module '{module_name}' not installed. "
                f"Install with: pip install {module_name.replace('_', '-')}"
            ) from e

        self.languages[language] = lang
        self.parsers[language] = ParserWrapper(lang)

        return self.languages[language]

    def parse(self, source_code: bytes, language: str):
        """
        Parse source code and return the Concrete Syntax Tree (CST).

        Args:
            source_code: Source code as bytes
            language: Language name

        Returns:
            Tree-sitter Tree object containing the CST

        Raises:
            ValueError: If language is not supported
        """
        if language not in self.parsers:
            self.load_language(language)

        parser = self.parsers[language]
        return parser.parse(source_code)

    def get_language_config(self, language: str) -> dict:
        """
        Get configuration for a specific language.

        Args:
            language: Language name

        Returns:
            Language configuration dictionary
        """
        return self.config.get("languages", {}).get(language, {})

    def get_supported_languages(self) -> list:
        """
        Get list of supported languages.

        Returns:
            List of language names
        """
        return list(self.config.get("languages", {}).keys())


class ParserWrapper:
    """Wrapper for tree-sitter Parser with consistent API."""

    def __init__(self, language_capsule):
        import tree_sitter

        self.parser = tree_sitter.Parser()
        # Convert PyCapsule to tree_sitter.Language object
        self.parser.language = tree_sitter.Language(language_capsule)

    def parse(self, source_code: bytes):
        """Parse source code and return the tree."""
        return self.parser.parse(source_code)
