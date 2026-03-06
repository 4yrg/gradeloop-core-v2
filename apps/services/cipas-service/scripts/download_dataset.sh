#!/bin/bash
# Dataset Download Utility
# This script handles downloading the HumanVsAICode dataset with proper environment setup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}HumanVsAICode Dataset Downloader${NC}"
echo -e "${BLUE}=================================${NC}"

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CIPAS_SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Script directory: $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"
echo "CIPAS service: $CIPAS_SERVICE_DIR"

# Check if virtual environment exists
VENV_PATH="$PROJECT_ROOT/venv"
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${RED}Virtual environment not found at: $VENV_PATH${NC}"
    echo -e "${YELLOW}Please create a virtual environment first:${NC}"
    echo "cd $PROJECT_ROOT"
    echo "python -m venv venv"
    echo "source venv/bin/activate"
    echo "pip install -r requirements.txt  # if exists"
    exit 1
fi

echo -e "${GREEN}✓ Virtual environment found${NC}"

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_PATH/bin/activate"

# Check if required packages are installed
echo "Checking dependencies..."
python -c "import datasets, pandas; print('✓ Dependencies available')" 2>/dev/null || {
    echo -e "${YELLOW}Installing required dependencies...${NC}"
    pip install datasets huggingface-hub pandas
}

# Change to cipas service directory
cd "$CIPAS_SERVICE_DIR"

# Check if dataset already exists
DATASET_DIR="$PROJECT_ROOT/datasets/humanvsai-code"
if [ -d "$DATASET_DIR" ] && [ -n "$(ls -A "$DATASET_DIR" 2>/dev/null | grep '\.csv$')" ]; then
    echo -e "${YELLOW}Dataset already exists at: $DATASET_DIR${NC}"
    echo -n "Do you want to re-download and overwrite? [y/N]: "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Download cancelled."
        
        # Offer to explore existing dataset
        echo -n "Would you like to explore the existing dataset instead? [y/N]: "
        read -r explore_response
        if [[ "$explore_response" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Exploring existing dataset...${NC}"
            python scripts/explore_humanvsai_dataset.py
        fi
        exit 0
    fi
fi

# Run the download script
echo -e "${BLUE}Starting dataset download...${NC}"
echo "This may take several minutes depending on your internet connection."
echo ""

if python scripts/download_humanvsai_dataset.py; then
    echo ""
    echo -e "${GREEN}✓ Dataset download completed successfully!${NC}"
    
    # Offer to explore the dataset
    echo -n "Would you like to explore the downloaded dataset? [y/N]: "
    read -r explore_response
    if [[ "$explore_response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Exploring dataset...${NC}"
        python scripts/explore_humanvsai_dataset.py
    fi
    
    echo ""
    echo -e "${GREEN}Dataset is ready for use in AI code detection training!${NC}"
    echo "Location: $DATASET_DIR"
else
    echo ""
    echo -e "${RED}✗ Dataset download failed${NC}"
    echo "Please check the error messages above and try again."
    exit 1
fi