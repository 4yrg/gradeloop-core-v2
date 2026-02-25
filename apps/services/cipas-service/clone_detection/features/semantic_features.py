"""
Pipeline B: Semantic Feature Fusion (XGBoost-based).

This module extracts and fuses 100 features from three categories:
1. Traditional Features: LOC, keyword counts
2. Syntactic (CST) Features: Frequencies of non-leaf nodes from Tree-sitter CST
3. Semantic (PDG-like) Features: Frequencies of dependency relationships

Features are fused using Linear Combination (concatenation) for XGBoost classification.
This pipeline is designed for detecting Type-4 (semantic) clones.
"""

import re
from typing import Optional

import numpy as np

from ..tokenizers.tree_sitter_tokenizer import TreeSitterTokenizer


class SemanticFeatureExtractor:
    """
    Extract semantic features for Type-4 clone detection.

    Implements feature fusion from traditional, syntactic, and semantic
    feature categories using linear combination (concatenation).
    """

    # Traditional keyword categories for feature extraction
    KEYWORD_CATEGORIES = {
        "control_keywords": {
            "if",
            "else",
            "switch",
            "case",
            "for",
            "while",
            "do",
            "break",
            "continue",
            "return",
            "goto",
            "try",
            "catch",
            "finally",
            "throw",
        },
        "declaration_keywords": {
            "int",
            "float",
            "double",
            "char",
            "void",
            "boolean",
            "byte",
            "short",
            "long",
            "unsigned",
            "signed",
            "const",
            "static",
            "public",
            "private",
            "protected",
            "class",
            "interface",
            "struct",
        },
        "memory_keywords": {
            "new",
            "delete",
            "malloc",
            "free",
            "alloc",
            "sizeof",
            "this",
            "self",
        },
        "import_keywords": {
            "import",
            "from",
            "include",
            "require",
            "using",
            "package",
            "namespace",
            "export",
        },
        "exception_keywords": {
            "try",
            "catch",
            "finally",
            "throw",
            "throws",
            "except",
            "raise",
            "assert",
        },
    }

    # CST node types to track (language-agnostic where possible)
    CST_NODE_TYPES = [
        "function_definition",
        "method_declaration",
        "class_definition",
        "if_statement",
        "for_statement",
        "while_statement",
        "do_statement",
        "switch_statement",
        "try_statement",
        "catch_clause",
        "variable_declaration",
        "assignment_expression",
        "binary_expression",
        "unary_expression",
        "method_invocation",
        "call_expression",
        "return_statement",
        "break_statement",
        "continue_statement",
        "block",
        "parameter_list",
        "argument_list",
        "field_declaration",
        "array_creation",
        "lambda_expression",
        "comprehension",
        "decorated_definition",
        "with_statement",
    ]

    # Semantic relationship types
    RELATIONSHIP_TYPES = [
        "control_construct",
        "assignment",
        "function_call",
        "return",
        "binary_operation",
    ]

    def __init__(self, tokenizer: Optional[TreeSitterTokenizer] = None):
        """
        Initialize the semantic feature extractor.

        Args:
            tokenizer: TreeSitterTokenizer instance (created if not provided)
        """
        self.tokenizer = tokenizer or TreeSitterTokenizer()

        # Calculate total feature count
        self.n_traditional = 1 + len(
            self.KEYWORD_CATEGORIES
        )  # LOC + keyword categories
        self.n_cst = len(self.CST_NODE_TYPES)
        self.n_semantic = len(self.RELATIONSHIP_TYPES)

        # Total features per code snippet
        self.n_features_per_code = self.n_traditional + self.n_cst + self.n_semantic

        # For fused features (concatenation of two code snippets)
        self.n_fused_features = 2 * self.n_features_per_code

        self.feature_names = self._generate_feature_names()

    def extract_features(self, code: str, language: str = "java") -> np.ndarray:
        """
        Extract all semantic features from a single code snippet.

        Args:
            code: Source code string
            language: Programming language ('java', 'c', 'python')

        Returns:
            Numpy array of features
        """
        features = []

        # 1. Traditional features
        traditional = self._extract_traditional_features(code)
        features.extend(traditional)

        # 2. Syntactic (CST) features
        cst_features = self._extract_cst_features(code, language)
        features.extend(cst_features)

        # 3. Semantic (PDG-like) features
        semantic_features = self._extract_semantic_features(code, language)
        features.extend(semantic_features)

        return np.array(features, dtype=np.float64)

    def extract_fused_features(
        self, code1: str, code2: str, language: str = "java"
    ) -> np.ndarray:
        """
        Extract and fuse features from two code snippets using linear combination.

        Linear combination (concatenation) preserves original feature values
        and yields better results for tree-ensemble models like XGBoost.

        Args:
            code1: First source code string
            code2: Second source code string
            language: Programming language

        Returns:
            Concatenated feature vector [features1, features2]
        """
        features1 = self.extract_features(code1, language)
        features2 = self.extract_features(code2, language)

        # Linear combination via concatenation
        fused = np.concatenate([features1, features2])

        return fused

    def _extract_traditional_features(self, code: str) -> list[float]:
        """
        Extract traditional code metrics.

        Features:
        - Lines of code (LOC)
        - Keyword category counts (normalized by LOC)

        Args:
            code: Source code string

        Returns:
            List of traditional feature values
        """
        features = []

        # Lines of code
        loc = len(code.splitlines())
        features.append(float(loc))

        # Keyword category counts (normalized)
        code_lower = code.lower()
        # Tokenize for keyword matching
        tokens = re.findall(r"\b\w+\b", code_lower)
        token_set = set(tokens)

        for category, keywords in self.KEYWORD_CATEGORIES.items():
            count = len(token_set & keywords)
            # Normalize by LOC to handle different code lengths
            normalized = count / max(loc, 1)
            features.append(normalized)

        return features

    def _extract_cst_features(self, code: str, language: str) -> list[float]:
        """
        Extract syntactic features from Tree-sitter CST.

        Counts frequencies of non-leaf node types (syntactic constructs).

        Args:
            code: Source code string
            language: Programming language

        Returns:
            List of CST feature values (normalized frequencies)
        """
        try:
            frequencies = self.tokenizer.get_cst_frequencies(code, language)
        except Exception:
            # Return zeros if parsing fails
            return [0.0] * self.n_cst

        features = []
        total_nodes = sum(frequencies.values())

        for node_type in self.CST_NODE_TYPES:
            count = frequencies.get(node_type, 0)
            # Normalize by total nodes
            normalized = count / max(total_nodes, 1)
            features.append(normalized)

        return features

    def _extract_semantic_features(self, code: str, language: str) -> list[float]:
        """
        Extract semantic (PDG-like) dependency features.

        Counts frequencies of dependency relationships that approximate
        Program Dependency Graph (PDG) information.

        Args:
            code: Source code string
            language: Programming language

        Returns:
            List of semantic feature values (normalized)
        """
        try:
            relationships = self.tokenizer.get_dependency_relationships(code, language)
        except Exception:
            return [0.0] * self.n_semantic

        features = []
        total_rels = sum(relationships.values())

        for rel_type in self.RELATIONSHIP_TYPES:
            count = relationships.get(rel_type, 0)
            # Normalize by total relationships
            normalized = count / max(total_rels, 1)
            features.append(normalized)

        return features

    def _generate_feature_names(self) -> list[str]:
        """Generate names for all features."""
        names = []

        # Traditional feature names
        names.append("loc")
        for category in self.KEYWORD_CATEGORIES:
            names.append(f"keyword_{category}")

        # CST feature names
        for node_type in self.CST_NODE_TYPES:
            names.append(f"cst_{node_type}")

        # Semantic feature names
        for rel_type in self.RELATIONSHIP_TYPES:
            names.append(f"semantic_{rel_type}")

        return names

    def get_feature_names(self, fused: bool = False) -> list[str]:
        """
        Get feature names.

        Args:
            fused: If True, return names for fused features (with _1 and _2 suffixes)

        Returns:
            List of feature names
        """
        if fused:
            names1 = [f"{n}_1" for n in self.feature_names]
            names2 = [f"{n}_2" for n in self.feature_names]
            return names1 + names2

        return self.feature_names.copy()

    def get_feature_count(self, fused: bool = False) -> int:
        """
        Get the total number of features.

        Args:
            fused: If True, return count for fused features

        Returns:
            Number of features
        """
        if fused:
            return self.n_fused_features
        return self.n_features_per_code


class FeatureFusion:
    """
    Feature fusion strategies for combining multiple feature types.

    Supports:
    - Linear Combination (concatenation)
    - Weighted Sum
    - Feature Selection
    """

    @staticmethod
    def linear_combination(*feature_arrays: np.ndarray) -> np.ndarray:
        """
        Concatenate feature arrays (linear combination).

        This preserves original feature values and is optimal for
        tree-ensemble models like XGBoost.

        Args:
            *feature_arrays: Variable number of feature arrays

        Returns:
            Concatenated feature vector
        """
        return np.concatenate([arr.flatten() for arr in feature_arrays])

    @staticmethod
    def weighted_sum(
        *feature_arrays: np.ndarray, weights: Optional[list[float]] = None
    ) -> np.ndarray:
        """
        Compute weighted sum of feature arrays.

        Args:
            *feature_arrays: Variable number of feature arrays
            weights: Optional weights for each feature array

        Returns:
            Weighted sum of features
        """
        if weights is None:
            weights = [1.0] * len(feature_arrays)

        if len(weights) != len(feature_arrays):
            raise ValueError("Number of weights must match number of feature arrays")

        result = np.zeros_like(feature_arrays[0])
        for arr, weight in zip(feature_arrays, weights):
            result += weight * arr.flatten()

        return result

    @staticmethod
    def normalize_features(features: np.ndarray, method: str = "zscore") -> np.ndarray:
        """
        Normalize features for ML model input.

        Args:
            features: Feature array of shape (n_samples, n_features)
            method: Normalization method ('zscore', 'minmax', 'robust')

        Returns:
            Normalized features
        """
        if method == "zscore":
            mean = np.mean(features, axis=0)
            std = np.std(features, axis=0)
            std[std == 0] = 1  # Avoid division by zero
            return (features - mean) / std

        elif method == "minmax":
            min_val = np.min(features, axis=0)
            max_val = np.max(features, axis=0)
            range_val = max_val - min_val
            range_val[range_val == 0] = 1
            return (features - min_val) / range_val

        elif method == "robust":
            median = np.median(features, axis=0)
            q1 = np.percentile(features, 25, axis=0)
            q3 = np.percentile(features, 75, axis=0)
            iqr = q3 - q1
            iqr[iqr == 0] = 1
            return (features - median) / iqr

        else:
            raise ValueError(f"Unknown normalization method: {method}")
