"""
ToMA Mapper: Map language-specific Tree-sitter nodes to 15-type token schema.

This module provides the Token Mapping (ToMA) intermediate representation
that transforms language-specific CST nodes into a unified 15-type token schema.
"""

from enum import Enum
from typing import Dict, List

try:
    from tree_sitter import Node
except ImportError:
    Node = object  # type: ignore


class TokenType(Enum):
    """
    15-type ToMA token schema for language-agnostic clone detection.

    Control Flow: IfType, ElseType, SwitchType, CaseType, ForType, WhileType,
                  DoType, BreakType, ContinueType, ReturnType
    Declarations: VarDeclType, FuncDeclType, ParamType
    Expressions:  CallType, QlfType (Qualified name)
    """

    # Control Flow (10 types)
    IF = "IfType"
    ELSE = "ElseType"
    SWITCH = "SwitchType"
    CASE = "CaseType"
    FOR = "ForType"
    WHILE = "WhileType"
    DO = "DoType"
    BREAK = "BreakType"
    CONTINUE = "ContinueType"
    RETURN = "ReturnType"

    # Declarations (3 types)
    VAR_DECL = "VarDeclType"
    FUNC_DECL = "FuncDeclType"
    PARAM = "ParamType"

    # Expressions (2 types)
    CALL = "CallType"
    QLF = "QlfType"  # Qualified name (e.g., obj.method, package.Class)


# Token type mapping for different languages
TOKEN_TYPE_MAPPING: Dict[str, Dict[str, TokenType]] = {
    "python": {
        # Control Flow
        "if_statement": TokenType.IF,
        "elif_clause": TokenType.ELSE,  # Map elif to ElseType
        "else_clause": TokenType.ELSE,
        "for_statement": TokenType.FOR,
        "while_statement": TokenType.WHILE,
        "return_statement": TokenType.RETURN,
        "break_statement": TokenType.BREAK,
        "continue_statement": TokenType.CONTINUE,
        # Declarations
        "function_definition": TokenType.FUNC_DECL,
        "parameter": TokenType.PARAM,
        "assignment": TokenType.VAR_DECL,
        # Expressions
        "call": TokenType.CALL,
        "attribute": TokenType.QLF,  # Python: obj.method → QlfType
        "identifier": TokenType.QLF,
    },
    "java": {
        # Control Flow
        "if_statement": TokenType.IF,
        "else_clause": TokenType.ELSE,
        "switch_statement": TokenType.SWITCH,
        "switch_block_statement_group": TokenType.CASE,
        "for_statement": TokenType.FOR,
        "enhanced_for_statement": TokenType.FOR,
        "while_statement": TokenType.WHILE,
        "do_statement": TokenType.DO,
        "break_statement": TokenType.BREAK,
        "continue_statement": TokenType.CONTINUE,
        "return_statement": TokenType.RETURN,
        # Declarations
        "local_variable_declaration": TokenType.VAR_DECL,
        "method_declaration": TokenType.FUNC_DECL,
        "formal_parameter": TokenType.PARAM,
        # Expressions
        "method_invocation": TokenType.CALL,
        "qualified_name": TokenType.QLF,  # Java: package.Class → QlfType
        "identifier": TokenType.QLF,
    },
    "c": {
        # Control Flow
        "if_statement": TokenType.IF,
        "else_clause": TokenType.ELSE,
        "switch_statement": TokenType.SWITCH,
        "case_statement": TokenType.CASE,
        "for_statement": TokenType.FOR,
        "while_statement": TokenType.WHILE,
        "do_statement": TokenType.DO,
        "break_statement": TokenType.BREAK,
        "continue_statement": TokenType.CONTINUE,
        "return_statement": TokenType.RETURN,
        # Declarations
        "declaration": TokenType.VAR_DECL,
        "function_definition": TokenType.FUNC_DECL,
        "parameter_declaration": TokenType.PARAM,
        # Expressions
        "call_expression": TokenType.CALL,
        "identifier": TokenType.QLF,
    },
}


class ToMAMapper:
    """
    Map language-specific Tree-sitter CST nodes to 15-type ToMA token sequence.

    This mapper enables language-agnostic clone detection by transforming
    different language constructs into a unified token schema.

    Example:
        >>> mapper = ToMAMapper("java")
        >>> tokens = mapper.map_fragment(node, source_code)
        # ['FuncDeclType', 'ParamType', 'VarDeclType', 'IfType', 'CallType']
    """

    def __init__(self, language: str):
        """
        Initialize the ToMAMapper.

        Args:
            language: Programming language (python, java, c)
        """
        self.language = language
        self.mapping = TOKEN_TYPE_MAPPING.get(language, {})

    def map_to_tokens(self, node: "Node") -> List[TokenType]:
        """
        Recursively map CST node to ToMA token sequence.

        Args:
            node: Tree-sitter CST node

        Returns:
            List of TokenType enums
        """
        tokens = []

        # Check if current node type maps to a token type
        if node.type in self.mapping:
            tokens.append(self.mapping[node.type])

        # Recurse into children
        for child in node.children:
            tokens.extend(self.map_to_tokens(child))

        return tokens

    def map_fragment(self, node: "Node", source_code: bytes) -> List[str]:
        """
        Map a code fragment to string token sequence.

        Args:
            node: CST node
            source_code: Original source code

        Returns:
            List of token type strings (e.g., ['IfType', 'CallType', 'QlfType'])
        """
        tokens = self.map_to_tokens(node)
        return [t.value for t in tokens]

    def map_fragment_flat(self, node: "Node") -> str:
        """
        Map fragment to space-separated token string.

        Args:
            node: CST node

        Returns:
            Space-separated token string
        """
        tokens = self.map_to_tokens(node)
        return " ".join(t.value for t in tokens)

    def get_token_counts(self, node: "Node") -> Dict[str, int]:
        """
        Get count of each token type in a fragment.

        Args:
            node: CST node

        Returns:
            Dictionary mapping token type to count
        """
        tokens = self.map_to_tokens(node)
        counts: Dict[str, int] = {}

        for token in tokens:
            token_str = token.value
            counts[token_str] = counts.get(token_str, 0) + 1

        return counts

    @staticmethod
    def get_all_token_types() -> List[str]:
        """
        Get list of all 15 token types.

        Returns:
            List of token type strings
        """
        return [t.value for t in TokenType]
