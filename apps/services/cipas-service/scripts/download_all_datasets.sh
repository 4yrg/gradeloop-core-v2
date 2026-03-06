#!/bin/bash
# Multi-Dataset Download Utility
# This script handles downloading multiple AI code detection datasets

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}AI Code Detection Datasets Downloader${NC}"
echo -e "${BLUE}======================================${NC}"

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CIPAS_SERVICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Project root: $PROJECT_ROOT"
echo "CIPAS service: $CIPAS_SERVICE_DIR"

# Check if virtual environment exists
VENV_PATH="$PROJECT_ROOT/venv"
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${RED}Virtual environment not found at: $VENV_PATH${NC}"
    echo -e "${YELLOW}Please create a virtual environment first.${NC}"
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

# Available datasets
declare -A DATASETS
DATASETS["humanvsai"]="HumanVsAICode|OSS-forge/HumanVsAICode|download_humanvsai_dataset.py|explore_humanvsai_dataset.py"
DATASETS["aigcodeset"]="AIGCodeSet|basakdemirok/AIGCodeSet|download_aigcodeset_dataset.py|explore_aigcodeset_dataset.py"
DATASETS["aicdbench"]="AICD-Bench|AICD-bench/AICD-Bench|download_aicdbench_dataset.py|explore_aicdbench_dataset.py"

# Function to show available datasets
show_datasets() {
    echo -e "${PURPLE}Available datasets:${NC}"
    echo "1. HumanVsAICode (OSS-forge/HumanVsAICode)"
    echo "2. AIGCodeSet (basakdemirok/AIGCodeSet)"
    echo "3. AICD-Bench (AICD-bench/AICD-Bench)"
    echo "4. All datasets"
    echo "5. Exit"
}

# Function to download a specific dataset
download_dataset() {
    local dataset_key="$1"
    local info="${DATASETS[$dataset_key]}"
    local name=$(echo "$info" | cut -d'|' -f1)
    local hf_path=$(echo "$info" | cut -d'|' -f2)
    local download_script=$(echo "$info" | cut -d'|' -f3)
    local explore_script=$(echo "$info" | cut -d'|' -f4)
    
    echo -e "${BLUE}Downloading $name dataset...${NC}"
    echo "Source: https://huggingface.co/datasets/$hf_path"
    echo ""
    
    if python "scripts/$download_script"; then
        echo ""
        echo -e "${GREEN}✓ $name dataset download completed!${NC}"
        
        # Offer to explore the dataset
        echo -n "Would you like to explore the $name dataset? [y/N]: "
        read -r explore_response
        if [[ "$explore_response" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Exploring $name dataset...${NC}"
            python "scripts/$explore_script"
        fi
        return 0
    else
        echo ""
        echo -e "${RED}✗ $name dataset download failed${NC}"
        return 1
    fi
}

# Main menu loop
while true; do
    echo ""
    show_datasets
    echo -n "Select an option [1-5]: "
    read -r choice
    
    case $choice in
        1)
            download_dataset "humanvsai"
            ;;
        2)
            download_dataset "aigcodeset"
            ;;
        3)
            download_dataset "aicdbench"
            ;;
        4)
            echo -e "${BLUE}Downloading all datasets...${NC}"
            success_count=0
            total_count=3
            
            for dataset_key in "${!DATASETS[@]}"; do
                if download_dataset "$dataset_key"; then
                    ((success_count++))
                fi
                echo ""
            done
            
            echo -e "${BLUE}Batch download summary:${NC}"
            echo "Successfully downloaded: $success_count/$total_count datasets"
            
            if [ $success_count -eq $total_count ]; then
                echo -e "${GREEN}All datasets downloaded successfully!${NC}"
            else
                echo -e "${YELLOW}Some datasets failed to download. Check the logs above.${NC}"
            fi
            break
            ;;
        5)
            echo "Exiting..."
            break
            ;;
        *)
            echo -e "${RED}Invalid option. Please select 1-5.${NC}"
            ;;
    esac
done

echo ""
echo -e "${GREEN}Dataset management completed!${NC}"
echo "Datasets are available in: $PROJECT_ROOT/datasets/"