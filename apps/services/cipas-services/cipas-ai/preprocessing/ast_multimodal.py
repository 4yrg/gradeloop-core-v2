#!/usr/bin/env python3
"""
ast_multimodal.py
─────────────────
AST processing utilities for multi-modal UniXcoder input.

Supports parsing and flattening ASTs for:
- C
- C#
- Python
- Java

Extracts docstrings and formats multi-modal input for UniXcoder.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional, Tuple

try:
    import tree_sitter
    from tree_sitter import Language, Parser
    
    HAS_TREE_SITTER = True
except ImportError:
    HAS_TREE_SITTER = False
    tree_sitter = None
    Language = None
    Parser = None

logger = logging.getLogger(__name__)


class ASTProcessor:
    """Multi-language AST processor using tree-sitter."""
    
    LANGUAGE_EXTENSIONS = {
        "c": [".c", ".h"],
        "c#": [".cs"],
        "csharp": [".cs"],
        "python": [".py"],
        "java": [".java"],
    }
    
    # Mapping of language names to tree-sitter language objects
    _parsers = {}
    _languages = {}
    
    def __init__(self, languages: list[str] = None):
        """Initialize AST processor.
        
        Args:
            languages: List of languages to support (default: all)
        """
        if not HAS_TREE_SITTER:
            raise ImportError(
                "tree-sitter is not installed. "
                "Install with: pip install tree-sitter tree-sitter-languages"
            )
        
        self.supported_languages = languages or ["c", "c#", "python", "java"]
        self._initialize_parsers()
    
    def _initialize_parsers(self):
        """Initialize tree-sitter parsers for supported languages."""
        try:
            # Try to import tree-sitter language bindings
            from tree_sitter_languages import get_language, get_parser
            
            for lang in self.supported_languages:
                lang_normalized = self._normalize_language(lang)
                try:
                    language = get_language(lang_normalized)
                    parser = get_parser(lang_normalized)
                    self._languages[lang] = language
                    self._parsers[lang] = parser
                    logger.info(f"Initialized tree-sitter parser for {lang}")
                except Exception as e:
                    logger.warning(f"Could not initialize parser for {lang}: {e}")
        
        except ImportError:
            logger.warning(
                "tree-sitter-languages not installed. "
                "Install with: pip install tree-sitter-languages"
            )
    
    def _normalize_language(self, language: str) -> str:
        """Normalize language name for tree-sitter."""
        lang_lower = language.lower()
        if lang_lower in ["c#", "csharp"]:
            return "c_sharp"
        elif lang_lower in ["c++", "cpp"]:
            return "cpp"
        return lang_lower
    
    def parse(self, code: str, language: str) -> Optional[tree_sitter.Tree]:
        """Parse code into AST.
        
        Args:
            code: Source code string
            language: Programming language
        
        Returns:
            tree-sitter Tree object or None if parsing failed
        """
        if language not in self._parsers:
            logger.debug(f"No parser available for language: {language}")
            return None
        
        try:
            parser = self._parsers[language]
            tree = parser.parse(bytes(code, "utf-8"))
            return tree
        except Exception as e:
            logger.debug(f"Error parsing code: {e}")
            return None
    
    def flatten_ast(
        self,
        tree: tree_sitter.Tree,
        max_nodes: int = 200,
    ) -> str:
        """Flatten AST into linear token sequence.
        
        Args:
            tree: tree-sitter Tree object
            max_nodes: Maximum number of nodes to include
        
        Returns:
            Flattened AST string (space-separated node types)
        """
        if tree is None:
            return ""
        
        nodes = []
        
        def traverse(node, depth=0):
            if len(nodes) >= max_nodes:
                return
            
            # Add node type
            nodes.append(node.type)
            
            # Traverse children (pre-order)
            for child in node.children:
                traverse(child, depth + 1)
        
        traverse(tree.root_node)
        
        return " ".join(nodes)
    
    def extract_docstring(self, code: str, language: str) -> Optional[str]:
        """Extract docstring/comment from code.
        
        Args:
            code: Source code string
            language: Programming language
        
        Returns:
            Extracted docstring or None
        """
        lang_lower = language.lower()
        
        if lang_lower == "python":
            return self._extract_python_docstring(code)
        elif lang_lower == "java":
            return self._extract_java_javadoc(code)
        elif lang_lower in ["c", "c#", "csharp"]:
            return self._extract_c_style_comment(code)
        
        return None
    
    def _extract_python_docstring(self, code: str) -> Optional[str]:
        """Extract Python docstring from code."""
        # Match triple-quoted strings at the start
        pattern = r'^\s*(?:def\s+\w+\([^)]*\):)?\s*["\']{{3}}(.*?)["\']{{3}}'
        match = re.search(pattern, code, re.DOTALL | re.MULTILINE)
        if match:
            return match.group(1).strip()
        
        # Try single-line docstring
        pattern = r'^\s*#\s*(.+?)$'
        match = re.search(pattern, code, re.MULTILINE)
        if match:
            return match.group(1).strip()
        
        return None
    
    def _extract_java_javadoc(self, code: str) -> Optional[str]:
        """Extract JavaDoc comment from Java code."""
        pattern = r'/\*\*(.*?)\*/'
        match = re.search(pattern, code, re.DOTALL)
        if match:
            javadoc = match.group(1)
            # Clean up JavaDoc formatting
            lines = []
            for line in javadoc.split('\n'):
                line = line.strip()
                if line.startswith('*'):
                    line = line[1:].strip()
                if line and not line.startswith('@'):
                    lines.append(line)
            return ' '.join(lines)
        
        return None
    
    def _extract_c_style_comment(self, code: str) -> Optional[str]:
        """Extract C-style comment (/* */ or //)."""
        # Try multi-line comment
        pattern = r'/\*(.*?)\*/'
        match = re.search(pattern, code, re.DOTALL)
        if match:
            return match.group(1).strip()
        
        # Try single-line comment
        pattern = r'^\s*//\s*(.+?)$'
        match = re.search(pattern, code, re.MULTILINE)
        if match:
            return match.group(1).strip()
        
        return None
    
    def process_code(
        self,
        code: str,
        language: str,
        max_ast_nodes: int = 200,
    ) -> Tuple[str, Optional[str], Optional[str]]:
        """Process code and extract all components for UniXcoder input.
        
        Args:
            code: Source code string
            language: Programming language
            max_ast_nodes: Maximum AST nodes to include
        
        Returns:
            Tuple of (code, docstring, flattened_ast)
        """
        # Extract docstring
        docstring = self.extract_docstring(code, language)
        
        # Parse AST
        tree = self.parse(code, language)
        
        # Flatten AST
        if tree:
            flattened_ast = self.flatten_ast(tree, max_nodes=max_ast_nodes)
        else:
            flattened_ast = None
        
        return code, docstring, flattened_ast


# Global instance
_ast_processor = None


def get_ast_processor(languages: list[str] = None) -> ASTProcessor:
    """Get global AST processor instance.
    
    Args:
        languages: List of languages to support
    
    Returns:
        ASTProcessor instance
    """
    global _ast_processor
    
    if _ast_processor is None:
        _ast_processor = ASTProcessor(languages=languages)
    
    return _ast_processor


def process_code_for_unixcoder(
    code: str,
    language: str,
    max_ast_nodes: int = 200,
) -> dict:
    """Convenience function to process code for UniXcoder.
    
    Args:
        code: Source code
        language: Programming language
        max_ast_nodes: Max AST nodes
    
    Returns:
        Dictionary with 'code', 'docstring', 'ast_sequence'
    """
    processor = get_ast_processor()
    code, docstring, ast_sequence = processor.process_code(
        code, language, max_ast_nodes
    )
    
    return {
        "code": code,
        "docstring": docstring,
        "ast_sequence": ast_sequence,
    }


if __name__ == "__main__":
    # Test AST processing
    logging.basicConfig(level=logging.INFO)
    
    # Test Python code
    python_code = '''
def fibonacci(n):
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
'''
    
    print("Testing Python code:")
    result = process_code_for_unixcoder(python_code, "python")
    print(f"  Code length: {len(result['code'])}")
    print(f"  Docstring: {result['docstring']}")
    print(f"  AST: {result['ast_sequence'][:100]}...")
    
    # Test Java code
    java_code = '''
/**
 * Calculates factorial of a number
 */
public class Factorial {
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}
'''
    
    print("\nTesting Java code:")
    result = process_code_for_unixcoder(java_code, "java")
    print(f"  Code length: {len(result['code'])}")
    print(f"  Docstring: {result['docstring']}")
    print(f"  AST: {result['ast_sequence'][:100] if result['ast_sequence'] else 'None'}...")
    
    # Test C code
    c_code = '''
/* Calculate sum of array elements */
int sum_array(int arr[], int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    return sum;
}
'''
    
    print("\nTesting C code:")
    result = process_code_for_unixcoder(c_code, "c")
    print(f"  Code length: {len(result['code'])}")
    print(f"  Docstring: {result['docstring']}")
    print(f"  AST: {result['ast_sequence'][:100] if result['ast_sequence'] else 'None'}...")
