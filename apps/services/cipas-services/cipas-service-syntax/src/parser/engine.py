"""
Tree-sitter Parser Engine for language-agnostic code parsing.

This module provides a wrapper class to load Tree-sitter grammar libraries
and parse source code into Concrete Syntax Trees (CST).
"""

from pathlib import Path
from typing import Dict, Optional

import yaml

try:
    from tree_sitter import Language, Parser
except ImportError:
    # Graceful handling if tree-sitter is not installed
    Language = None  # type: ignore
    Parser = None  # type: ignore


class ParserEngine:
    """
    Wrapper class to load Tree-sitter grammar libraries and parse source code.
    Supports multiple languages via dynamic grammar loading.

    Example:
        >>> engine = ParserEngine("config/languages.yaml")
        >>> tree = engine.parse(b"def hello(): pass", "python")
        >>> print(tree.root_node)
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the Parser Engine.

        Args:
            config_path: Path to languages.yaml configuration file.
                        Defaults to "config/languages.yaml" relative to module.
        """
        if config_path is None:
            config_path = str(
                Path(__file__).parent.parent / "config" / "languages.yaml"
            )

        self.config = self._load_config(config_path)
        self.languages: Dict[str, "Language"] = {}
        self.parsers: Dict[str, "Parser"] = {}
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
            except FileNotFoundError:
                # Gracefully handle missing grammars during development
                pass

    def load_language(self, language: str) -> "Language":
        """
        Load a Tree-sitter grammar library for the specified language.

        Args:
            language: Language name (e.g., 'python', 'java', 'c')

        Returns:
            Loaded Tree-sitter Language object

        Raises:
            ValueError: If language is not supported
            FileNotFoundError: If grammar library is not found
        """
        if language not in self.config.get("languages", {}):
            raise ValueError(f"Unsupported language: {language}")

        if language in self.languages:
            return self.languages[language]

        lang_config = self.config["languages"][language]
        grammar_path = Path(lang_config["grammar_path"])
        library_file = grammar_path / lang_config["library_file"]

        if not library_file.exists():
            raise FileNotFoundError(f"Grammar library not found: {library_file}")

        if Language is None:
            raise ImportError(
                "tree-sitter is not installed. Install with: pip install tree-sitter"
            )

        self.languages[language] = Language(library_file, language)
        self.parsers[language] = Parser()
        self.parsers[language].set_language(self.languages[language])

        return self.languages[language]

    def parse(self, source_code: bytes, language: str) -> "Tree":
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
