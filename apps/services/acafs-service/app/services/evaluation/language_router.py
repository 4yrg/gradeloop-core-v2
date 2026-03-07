"""Language router for mapping languages to tree-sitter parsers."""

from enum import Enum
from typing import Optional

from tree_sitter import Language, Parser

from app.logging_config import get_logger

logger = get_logger(__name__)


class SupportedLanguage(str, Enum):
    """Supported programming languages."""
    C = "c"
    CPP = "cpp"
    JAVA = "java"
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    CSHARP = "csharp"


# Language ID mappings from Judge0 to ACAFS
# Full list: https://judge0.com/ce (public instance language IDs)
JUDGE0_LANGUAGE_MAP = {
    # C / C++
    50: SupportedLanguage.C,           # C (GCC 9.2.0)
    51: SupportedLanguage.CSHARP,      # C# (Mono 6.6.0)
    54: SupportedLanguage.CPP,         # C++ (GCC 9.2.0)
    76: SupportedLanguage.CPP,         # C++ (Clang 7.0.1)
    75: SupportedLanguage.C,           # C (Clang 7.0.1)
    # Java
    62: SupportedLanguage.JAVA,        # Java (OpenJDK 13.0.1)
    91: SupportedLanguage.JAVA,        # Java (OpenJDK 17.0.6)
    # Python
    71: SupportedLanguage.PYTHON,      # Python (3.8.1)
    92: SupportedLanguage.PYTHON,      # Python (3.11.2)
    # JavaScript / TypeScript
    63: SupportedLanguage.JAVASCRIPT,  # JavaScript (Node.js 12.14.0)
    74: SupportedLanguage.JAVASCRIPT,  # TypeScript (3.7.4) — use JS AST
    93: SupportedLanguage.JAVASCRIPT,  # JavaScript (Node.js 18.15.0)
    94: SupportedLanguage.JAVASCRIPT,  # TypeScript (5.0.3)
    # Go — no dedicated parser; C parser gives basic structure
    60: SupportedLanguage.C,           # Go (1.13.5)
    95: SupportedLanguage.C,           # Go (1.18.5)
}


class LanguageRouter:
    """Routes languages to appropriate tree-sitter parsers."""

    def __init__(self):
        """Initialize language router with tree-sitter languages."""
        self._parsers: dict[SupportedLanguage, Parser] = {}
        self._init_parsers()

    def _init_parsers(self) -> None:
        """Initialize tree-sitter parsers for supported languages."""
        try:
            import tree_sitter_c as ts_c
            self._parsers[SupportedLanguage.C] = Parser(Language(ts_c.language()))
            logger.debug("parser_initialized", language="c")
        except ImportError:
            logger.warning("parser_not_available", language="c")

        try:
            import tree_sitter_cpp as ts_cpp
            self._parsers[SupportedLanguage.CPP] = Parser(Language(ts_cpp.language()))
            logger.debug("parser_initialized", language="cpp")
        except ImportError:
            logger.warning("parser_not_available", language="cpp")

        try:
            import tree_sitter_java as ts_java
            self._parsers[SupportedLanguage.JAVA] = Parser(Language(ts_java.language()))
            logger.debug("parser_initialized", language="java")
        except ImportError:
            logger.warning("parser_not_available", language="java")

        try:
            import tree_sitter_python as ts_python
            self._parsers[SupportedLanguage.PYTHON] = Parser(Language(ts_python.language()))
            logger.debug("parser_initialized", language="python")
        except ImportError:
            logger.warning("parser_not_available", language="python")

        try:
            import tree_sitter_javascript as ts_js
            self._parsers[SupportedLanguage.JAVASCRIPT] = Parser(Language(ts_js.language()))
            logger.debug("parser_initialized", language="javascript")
        except ImportError:
            logger.warning("parser_not_available", language="javascript")

        try:
            import tree_sitter_c_sharp as ts_csharp
            self._parsers[SupportedLanguage.CSHARP] = Parser(Language(ts_csharp.language()))
            logger.debug("parser_initialized", language="csharp")
        except ImportError:
            logger.warning("parser_not_available", language="csharp")

    def get_parser(self, language: str) -> Optional[Parser]:
        """Get parser for a language.
        
        Args:
            language: Language string (e.g., "python", "cpp")
            
        Returns:
            Tree-sitter Parser if available, None otherwise
        """
        try:
            lang = SupportedLanguage(language.lower())
            return self._parsers.get(lang)
        except ValueError:
            logger.warning("unsupported_language", language=language)
            return None

    def get_parser_by_judge0_id(self, language_id: int) -> Optional[Parser]:
        """Get parser by Judge0 language ID.
        
        Args:
            language_id: Judge0 language identifier
            
        Returns:
            Tree-sitter Parser if available, None otherwise
        """
        lang = JUDGE0_LANGUAGE_MAP.get(language_id)
        if lang:
            return self._parsers.get(lang)
        logger.warning("unsupported_judge0_language_id", language_id=language_id)
        return None

    def is_supported(self, language: str) -> bool:
        """Check if a language is supported.
        
        Args:
            language: Language string
            
        Returns:
            True if supported, False otherwise
        """
        try:
            lang = SupportedLanguage(language.lower())
            return lang in self._parsers
        except ValueError:
            return False

    def get_supported_languages(self) -> list[str]:
        """Get list of supported language names."""
        return [lang.value for lang in self._parsers.keys()]
