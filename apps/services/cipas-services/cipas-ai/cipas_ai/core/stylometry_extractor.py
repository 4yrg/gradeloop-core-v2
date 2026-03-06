"""
Stylometric Feature Extractor for AI Code Detection (Stage 1).

This module implements lightweight stylometric analysis to quickly identify
patterns indicative of AI-generated code vs human-written code.
"""

import re
import string
import hashlib
from typing import Dict, Any, List, Optional
from collections import Counter
import math
import logging

logger = logging.getLogger(__name__)


class StylometryExtractor:
    """
    Lightweight stylometric feature extractor for code analysis.
    
    Extracts fast-to-compute features that can distinguish AI-generated
    code from human-written code based on stylistic patterns.
    """

    def __init__(self):
        """Initialize the stylometry extractor."""
        # Common AI code patterns (can be extended based on training data)
        self.ai_patterns = [
            r'^\s*#.*TODO.*implement',
            r'^\s*#.*Add your code here',
            r'^\s*#.*Your code goes here',
            r'def\s+\w+\(\s*\):\s*pass',
            r'class\s+\w+:\s*pass',
        ]
        
        # Programming language keywords (Python focus, extensible)
        self.keywords = {
            'python': {
                'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except',
                'import', 'from', 'return', 'yield', 'lambda', 'with', 'as', 'pass',
                'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False'
            }
        }

    def extract_features(self, code: str, language: str = 'python') -> Dict[str, Any]:
        """
        Extract stylometric features from code text.
        
        Args:
            code: Source code as string
            language: Programming language (default: python)
            
        Returns:
            Dictionary of extracted features
        """
        try:
            features = {}
            
            # Basic text statistics
            features.update(self._extract_text_stats(code))
            
            # Character and token patterns
            features.update(self._extract_character_patterns(code))
            
            # Code structure patterns
            features.update(self._extract_structure_patterns(code, language))
            
            # Identifier patterns
            features.update(self._extract_identifier_patterns(code))
            
            # AI-specific patterns
            features.update(self._extract_ai_patterns(code))
            
            # N-gram patterns
            features.update(self._extract_ngram_patterns(code))
            
            # Entropy features
            features.update(self._extract_entropy_features(code))
            
            return features
            
        except Exception as e:
            logger.warning(f"Error extracting stylometric features: {e}")
            return self._get_default_features()

    def _extract_text_stats(self, code: str) -> Dict[str, float]:
        """Extract basic text statistics."""
        lines = code.split('\n')
        non_empty_lines = [line for line in lines if line.strip()]
        
        return {
            'total_chars': len(code),
            'total_lines': len(lines),
            'non_empty_lines': len(non_empty_lines),
            'avg_line_length': sum(len(line) for line in lines) / max(1, len(lines)),
            'avg_non_empty_line_length': sum(len(line) for line in non_empty_lines) / max(1, len(non_empty_lines)),
            'empty_line_ratio': (len(lines) - len(non_empty_lines)) / max(1, len(lines)),
        }

    def _extract_character_patterns(self, code: str) -> Dict[str, float]:
        """Extract character-level patterns."""
        total_chars = len(code)
        if total_chars == 0:
            return {'whitespace_ratio': 0, 'punct_ratio': 0, 'alpha_ratio': 0, 'digit_ratio': 0}
        
        whitespace_count = sum(1 for c in code if c.isspace())
        punct_count = sum(1 for c in code if c in string.punctuation)
        alpha_count = sum(1 for c in code if c.isalpha())
        digit_count = sum(1 for c in code if c.isdigit())
        
        return {
            'whitespace_ratio': whitespace_count / total_chars,
            'punct_ratio': punct_count / total_chars,
            'alpha_ratio': alpha_count / total_chars,
            'digit_ratio': digit_count / total_chars,
            'tab_count': code.count('\t'),
            'space_count': code.count(' '),
            'newline_count': code.count('\n'),
        }

    def _extract_structure_patterns(self, code: str, language: str) -> Dict[str, float]:
        """Extract code structure patterns."""
        features = {}
        
        # Comment patterns
        comment_lines = len(re.findall(r'^\s*#.*$', code, re.MULTILINE))
        total_lines = len(code.split('\n'))
        features['comment_line_ratio'] = comment_lines / max(1, total_lines)
        
        # Docstring patterns (Python-specific)
        if language == 'python':
            docstring_count = len(re.findall(r'"""[\s\S]*?"""', code)) + len(re.findall(r"'''[\s\S]*?'''", code))
            features['docstring_count'] = docstring_count
        
        # Indentation patterns
        indented_lines = len(re.findall(r'^\s+', code, re.MULTILINE))
        features['indented_line_ratio'] = indented_lines / max(1, total_lines)
        
        # Function and class counts
        features['function_count'] = len(re.findall(r'\bdef\s+\w+', code))
        features['class_count'] = len(re.findall(r'\bclass\s+\w+', code))
        
        # Import statements
        features['import_count'] = len(re.findall(r'^\s*(import|from)\s+', code, re.MULTILINE))
        
        return features

    def _extract_identifier_patterns(self, code: str) -> Dict[str, float]:
        """Extract identifier naming patterns."""
        # Find all identifiers (simplified approach)
        identifiers = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', code)
        
        if not identifiers:
            return {
                'avg_identifier_length': 0,
                'camelcase_ratio': 0,
                'snake_case_ratio': 0,
                'single_char_var_ratio': 0,
            }
        
        camelcase_count = sum(1 for ident in identifiers if re.match(r'^[a-z]+([A-Z][a-z]*)*$', ident))
        snake_case_count = sum(1 for ident in identifiers if '_' in ident)
        single_char_count = sum(1 for ident in identifiers if len(ident) == 1)
        
        return {
            'avg_identifier_length': sum(len(ident) for ident in identifiers) / len(identifiers),
            'camelcase_ratio': camelcase_count / len(identifiers),
            'snake_case_ratio': snake_case_count / len(identifiers),
            'single_char_var_ratio': single_char_count / len(identifiers),
            'unique_identifier_ratio': len(set(identifiers)) / len(identifiers),
        }

    def _extract_ai_patterns(self, code: str) -> Dict[str, float]:
        """Extract patterns commonly found in AI-generated code."""
        features = {}
        
        # Count matches for AI-specific patterns
        for i, pattern in enumerate(self.ai_patterns):
            matches = len(re.findall(pattern, code, re.MULTILINE | re.IGNORECASE))
            features[f'ai_pattern_{i}'] = matches
        
        # Generic placeholder patterns
        placeholder_patterns = [
            r'#.*TODO',
            r'#.*FIXME',
            r'pass\s*$',
            r'placeholder',
            r'your.*code.*here',
        ]
        
        placeholder_count = 0
        for pattern in placeholder_patterns:
            placeholder_count += len(re.findall(pattern, code, re.IGNORECASE))
        
        features['placeholder_count'] = placeholder_count
        
        # Very generic variable names (often AI-generated)
        generic_vars = ['temp', 'tmp', 'var', 'val', 'data', 'result', 'output', 'input']
        generic_count = 0
        for var in generic_vars:
            generic_count += len(re.findall(rf'\b{var}\d*\b', code, re.IGNORECASE))
        
        features['generic_var_count'] = generic_count
        
        return features

    def _extract_ngram_patterns(self, code: str, n: int = 3) -> Dict[str, float]:
        """Extract character n-gram patterns."""
        # Normalize whitespace for n-gram analysis
        normalized = re.sub(r'\s+', ' ', code.strip())
        
        if len(normalized) < n:
            return {f'top_ngram_{i}_freq': 0 for i in range(5)}
        
        # Create n-grams
        ngrams = [normalized[i:i+n] for i in range(len(normalized) - n + 1)]
        ngram_counts = Counter(ngrams)
        
        # Get top n-gram frequencies
        total_ngrams = len(ngrams)
        top_ngrams = ngram_counts.most_common(5)
        
        features = {}
        for i, (ngram, count) in enumerate(top_ngrams):
            features[f'top_ngram_{i}_freq'] = count / total_ngrams
        
        # Fill remaining features with 0 if we have fewer than 5 unique n-grams
        for i in range(len(top_ngrams), 5):
            features[f'top_ngram_{i}_freq'] = 0.0
        
        return features

    def _extract_entropy_features(self, code: str) -> Dict[str, float]:
        """Extract entropy-based features."""
        if not code:
            return {'char_entropy': 0, 'token_entropy': 0}
        
        # Character entropy
        char_counts = Counter(code)
        char_entropy = self._calculate_entropy(list(char_counts.values()))
        
        # Token entropy (simplified tokenization)
        tokens = re.findall(r'\b\w+\b', code)
        if tokens:
            token_counts = Counter(tokens)
            token_entropy = self._calculate_entropy(list(token_counts.values()))
        else:
            token_entropy = 0
        
        return {
            'char_entropy': char_entropy,
            'token_entropy': token_entropy,
        }

    def _calculate_entropy(self, counts: List[int]) -> float:
        """Calculate Shannon entropy from counts."""
        if not counts:
            return 0.0
        
        total = sum(counts)
        if total == 0:
            return 0.0
        
        entropy = 0.0
        for count in counts:
            if count > 0:
                prob = count / total
                entropy -= prob * math.log2(prob)
        
        return entropy

    def _get_default_features(self) -> Dict[str, float]:
        """Return default features when extraction fails."""
        return {
            'total_chars': 0,
            'total_lines': 0,
            'non_empty_lines': 0,
            'avg_line_length': 0,
            'avg_non_empty_line_length': 0,
            'empty_line_ratio': 0,
            'whitespace_ratio': 0,
            'punct_ratio': 0,
            'alpha_ratio': 0,
            'digit_ratio': 0,
            'comment_line_ratio': 0,
            'function_count': 0,
            'class_count': 0,
            'avg_identifier_length': 0,
            'camelcase_ratio': 0,
            'snake_case_ratio': 0,
            'single_char_var_ratio': 0,
            'placeholder_count': 0,
            'generic_var_count': 0,
            'char_entropy': 0,
            'token_entropy': 0,
        }

    def get_feature_vector(self, code: str, language: str = 'python') -> List[float]:
        """
        Extract features and return as a vector for ML model input.
        
        Args:
            code: Source code as string
            language: Programming language
            
        Returns:
            Feature vector as list of floats
        """
        features = self.extract_features(code, language)
        
        # Define feature order for consistent vector representation
        feature_keys = [
            'total_chars', 'total_lines', 'non_empty_lines', 'avg_line_length',
            'avg_non_empty_line_length', 'empty_line_ratio', 'whitespace_ratio',
            'punct_ratio', 'alpha_ratio', 'digit_ratio', 'comment_line_ratio',
            'function_count', 'class_count', 'avg_identifier_length', 'camelcase_ratio',
            'snake_case_ratio', 'single_char_var_ratio', 'placeholder_count',
            'generic_var_count', 'char_entropy', 'token_entropy',
        ]
        
        # Add top n-gram features
        feature_keys.extend([f'top_ngram_{i}_freq' for i in range(5)])
        
        # Add AI pattern features
        feature_keys.extend([f'ai_pattern_{i}' for i in range(len(self.ai_patterns))])
        
        return [features.get(key, 0.0) for key in feature_keys]