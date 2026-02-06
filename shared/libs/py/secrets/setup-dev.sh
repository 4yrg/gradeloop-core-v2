#!/bin/bash
# Quick development environment setup script

set -e

echo "🔧 Setting up development environment for gradeloop-secrets..."

# Check if we're in the right directory
if [ ! -f "setup.py" ]; then
    echo "❌ Error: setup.py not found. Please run this script from shared/libs/py/secrets/"
    exit 1
fi

# Install the package with dev dependencies
echo "📦 Installing package in editable mode with dev dependencies..."
pip install -e ".[dev]"

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "You can now:"
echo "  • Run tests: pytest"
echo "  • Check formatting: black --check ."
echo "  • Format code: black ."
echo "  • Run linter: ruff check ."
echo "  • Run security scan: bandit -r . -c .bandit"
echo ""
echo "For more information, see DEVELOPMENT.md"
