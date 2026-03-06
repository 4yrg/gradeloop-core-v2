# Dataset Download Scripts

This directory contains scripts for downloading and managing datasets used by the CIPAS service.

## Available Datasets

### 1. HumanVsAICode Dataset
**Source:** https://huggingface.co/datasets/OSS-forge/HumanVsAICode  
**Script:** `download_humanvsai_dataset.py`  
**Explorer:** `explore_humanvsai_dataset.py`  

Contains code samples with human-written code and AI-generated variants from ChatGPT, DeepSeek Coder, and Qwen.

### 2. AIGCodeSet Dataset  
**Source:** https://huggingface.co/datasets/basakdemirok/AIGCodeSet  
**Script:** `download_aigcodeset_dataset.py`  
**Explorer:** `explore_aigcodeset_dataset.py`  

A dataset for AI-generated code detection research.

### 3. AICD-Bench Dataset
**Source:** https://huggingface.co/datasets/AICD-bench/AICD-Bench  
**Script:** `download_aicdbench_dataset.py`  
**Explorer:** `explore_aicdbench_dataset.py`  

Benchmark dataset for AI Code Detection evaluation.

## Quick Start

### Download All Datasets (Recommended)
```bash
cd /path/to/cipas-service
./scripts/download_all_datasets.sh
```
This interactive script lets you choose which datasets to download.

### Download Individual Datasets
For HumanVsAICode:
```bash
python scripts/download_humanvsai_dataset.py
# Or: ./scripts/download_dataset.sh
```

For AIGCodeSet:
```bash
python scripts/download_aigcodeset_dataset.py
```

For AICD-Bench:
```bash
python scripts/download_aicdbench_dataset.py
```

#### Output Location
The datasets will be downloaded to:
```
/datasets/
├── humanvsai-code/         # HumanVsAICode dataset
│   ├── train.csv
│   └── dataset_info.txt
├── aigcodeset/             # AIGCodeSet dataset
│   ├── [splits].csv
│   └── dataset_info.txt
└── aicd-bench/             # AICD-Bench dataset
    ├── [splits].csv
    └── dataset_info.txt
```

#### Features
- **Automatic directory creation**: Creates the target directory if it doesn't exist
- **Progress logging**: Detailed logging of the download process
- **Data verification**: Verifies downloaded files and provides statistics
- **Overwrite protection**: Asks for confirmation before overwriting existing data
- **Error handling**: Comprehensive error handling and user feedback
- **Dataset info**: Saves metadata and statistics for reference

### Dataset Structure
The downloaded CSV files will contain:
- **code**: The source code samples
- **label**: Classification label (human vs AI-generated)
- Additional metadata fields as provided by the dataset

### Integration with CIPAS Service
Once downloaded, this dataset can be used to:
1. Train new AI code detection models
2. Evaluate existing model performance
3. Fine-tune confidence thresholds
4. Benchmark different detection approaches

### Troubleshooting
- **Import errors**: Ensure datasets and huggingface-hub packages are installed
- **Permission errors**: Check write permissions to the /datasets directory
- **Network issues**: Ensure stable internet connection for large dataset download
- **Disk space**: Verify sufficient disk space (dataset size varies)

### Adding New Datasets
To add scripts for additional datasets:
1. Create a new script following the same pattern
2. Update this README with usage instructions
3. Add any new dependencies to pyproject.toml

## Dataset Exploration

### explore_humanvsai_dataset.py

A utility script to explore and analyze the downloaded HumanVsAICode dataset.

#### Usage
After downloading the dataset, you can explore it with:
```bash
python scripts/explore_humanvsai_dataset.py
```

Or directly:
```bash
./scripts/explore_humanvsai_dataset.py
```

#### Features
- **Data loading**: Loads all CSV splits from the downloaded dataset
- **Basic statistics**: Shows sample counts, columns, data types, and missing values
- **Label distribution**: Displays the distribution of human vs AI-generated code
- **Code analysis**: Analyzes code length, line counts, and language patterns
- **Sample preview**: Shows sample data for quick inspection

#### Output
The script provides comprehensive information about:
- Dataset structure and splits
- Label distributions and class balance
- Code length and complexity statistics  
- Basic language pattern detection
- Data quality assessment

This exploration helps understand the dataset before using it for training or evaluation.