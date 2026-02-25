#!/bin/bash
# =============================================================================
# Tree-sitter Grammar Setup Script
# =============================================================================
# This script clones and compiles Tree-sitter grammars for Python, Java, and C.
# Compiled grammars are stored in data/grammars/
# =============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GRAMMARS_DIR="$PROJECT_ROOT/data/grammars"

echo "🔧 Setting up Tree-sitter grammars..."
echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Grammars directory: $GRAMMARS_DIR"

# Create grammars directory
mkdir -p "$GRAMMARS_DIR"

# Function to clone and build a grammar
setup_grammar() {
    local lang_name=$1
    local repo_url=$2
    local grammar_dir="$GRAMMARS_DIR/tree-sitter-$lang_name"
    local library_file="$grammar_dir/lib$lang_name.so"

    if [ -d "$grammar_dir" ]; then
        echo "✅ $lang_name grammar already exists, skipping..."
        return 0
    fi

    echo "📥 Cloning tree-sitter-$lang_name..."
    git clone --depth 1 "$repo_url" "$grammar_dir"

    echo "🔨 Compiling $lang_name grammar..."
    cd "$grammar_dir"

    # Check if grammar has a build system
    if [ -f "bindings/python/build.py" ]; then
        # Use Python bindings build if available
        cd bindings/python
        python -m pip install -e . --quiet
        cd ../..
    fi

    # Compile shared library using gcc
    if [ -f "src/parser.c" ]; then
        gcc -shared -fPIC -o "$library_file" src/parser.c
        echo "✅ Compiled $library_file"
    elif [ -f "src/parser.cc" ]; then
        g++ -shared -fPIC -o "$library_file" src/parser.cc
        echo "✅ Compiled $library_file"
    else
        echo "⚠️  No parser source found for $lang_name"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

# Setup Python grammar
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setting up Python grammar..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
setup_grammar "python" "https://github.com/tree-sitter/tree-sitter-python.git"

# Setup Java grammar
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setting up Java grammar..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
setup_grammar "java" "https://github.com/tree-sitter/tree-sitter-java.git"

# Setup C grammar
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Setting up C grammar..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
setup_grammar "c" "https://github.com/tree-sitter/tree-sitter-c.git"

# Verify installations
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Grammar setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Compiled grammars:"
ls -lh "$GRAMMARS_DIR"/*.so 2>/dev/null || echo "⚠️  No .so files found"
echo ""
echo "To verify installation, run:"
echo "  python -c \"from tree_sitter import Language; print(Language('data/grammars/tree-sitter-python/libpython.so', 'python'))\""
