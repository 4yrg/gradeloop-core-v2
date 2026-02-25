#!/bin/bash
# =============================================================================
# Clone Detection Pipeline Setup Script
# =============================================================================
# This script sets up the complete clone detection pipeline including:
# - Python virtual environment creation
# - Dependencies installation
# - Tree-sitter grammars compilation
# - Directory structure initialization
# - Model directory preparation
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Clone Detection Pipeline Setup${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Step 1: Check Python version
echo -e "${YELLOW}[1/6] Checking Python version...${NC}"
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "  Python version: $PYTHON_VERSION"

# Step 2: Create virtual environment
echo -e "${YELLOW}[2/6] Setting up virtual environment...${NC}"
VENV_PATH="$PROJECT_ROOT/.venv-cipas-syntax"
if [ -d "$VENV_PATH" ]; then
    echo "  Virtual environment already exists at: $VENV_PATH"
    echo "  Removing existing environment..."
    rm -rf "$VENV_PATH"
fi

python3 -m venv "$VENV_PATH"
echo -e "  ${GREEN}✓${NC} Virtual environment created at: $VENV_PATH"

# Activate virtual environment
source "$VENV_PATH/bin/activate"
echo "  Virtual environment activated"

# Step 3: Upgrade pip and install dependencies
echo -e "${YELLOW}[3/6] Installing dependencies...${NC}"
pip install --upgrade pip > /dev/null 2>&1
pip install -r "$PROJECT_ROOT/requirements.txt"
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# Step 4: Setup Tree-sitter grammars
echo -e "${YELLOW}[4/6] Setting up Tree-sitter grammars...${NC}"
GRAMMARS_DIR="$PROJECT_ROOT/data/grammars"
mkdir -p "$GRAMMARS_DIR"

# Check if grammars already exist
if [ -d "$GRAMMARS_DIR/tree-sitter-python" ] && \
   [ -d "$GRAMMARS_DIR/tree-sitter-java" ] && \
   [ -d "$GRAMMARS_DIR/tree-sitter-c" ]; then
    echo "  Grammars already downloaded"
else
    echo "  Downloading Tree-sitter grammars..."
    cd "$GRAMMARS_DIR"

    if [ ! -d "tree-sitter-python" ]; then
        git clone --depth 1 https://github.com/tree-sitter/tree-sitter-python.git
        echo "  Downloaded Python grammar"
    fi

    if [ ! -d "tree-sitter-java" ]; then
        git clone --depth 1 https://github.com/tree-sitter/tree-sitter-java.git
        echo "  Downloaded Java grammar"
    fi

    if [ ! -d "tree-sitter-c" ]; then
        git clone --depth 1 https://github.com/tree-sitter/tree-sitter-c.git
        echo "  Downloaded C grammar"
    fi

    cd "$PROJECT_ROOT"
fi

echo -e "  ${GREEN}✓${NC} Tree-sitter grammars ready"

# Step 5: Create necessary directories
echo -e "${YELLOW}[5/6] Creating directory structure...${NC}"
mkdir -p "$PROJECT_ROOT/data/models"
mkdir -p "$PROJECT_ROOT/data/indices"
mkdir -p "$PROJECT_ROOT/reports"
mkdir -p "$PROJECT_ROOT/reports/evaluations"
mkdir -p "$PROJECT_ROOT/reports/results"

echo "  Created directories:"
echo "    - data/models/"
echo "    - data/indices/"
echo "    - reports/"
echo "    - reports/evaluations/"
echo "    - reports/results/"
echo -e "  ${GREEN}✓${NC} Directory structure ready"

# Step 6: Verify installation
echo -e "${YELLOW}[6/6] Verifying installation...${NC}"
python -c "import tree_sitter; import sklearn; import pandas; import numpy" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} All dependencies verified"
else
    echo -e "  ${RED}✗${NC} Some dependencies are missing"
    exit 1
fi

# Deactivate virtual environment
deactivate 2>/dev/null || true

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}✓ Pipeline setup complete!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Activate virtual environment:"
echo "     source $VENV_PATH/bin/activate"
echo ""
echo "  2. Train the model:"
echo "     python scripts/train_model.py \\"
echo "       -d ../../../../datasets/toma-dataset \\"
echo "       -s ../../../../datasets/toma-dataset/id2sourcecode \\"
echo "       -o data/models/clone_classifier.joblib \\"
echo "       -l java \\"
echo "       -n 10000"
echo ""
echo "  3. Evaluate on BigCloneBench:"
echo "     python scripts/evaluate_bcb.py \\"
echo "       -m data/models/clone_classifier.joblib \\"
echo "       -d ../../../../datasets/bigclonebench \\"
echo "       -o reports/evaluations/bcb_evaluation.json"
echo ""
echo "  4. View documentation:"
echo "     cat docs/PIPELINE_GUIDE.md"
echo ""
