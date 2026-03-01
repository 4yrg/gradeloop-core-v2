#!/bin/bash
# =============================================================================
# CIPAS AI - Training Script for DroidDetect-Large
# =============================================================================
# Quick-start training script with sensible defaults.
#
# Usage:
#   ./scripts/train.sh                    # Default training
#   ./scripts/train.sh --quick            # Quick test run (100 samples)
#   ./scripts/train.sh --gpu              # Full GPU training
#   ./scripts/train.sh --low-vram         # For GPUs with < 8GB VRAM
# =============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default paths
TRAIN_DATA="${TRAIN_DATA:-../../datasets/droid-collection/Droid_Train.jsonl}"
EVAL_DATA="${EVAL_DATA:-../../datasets/droid-collection/Droid_Test.jsonl}"
OUTPUT_DIR="${OUTPUT_DIR:-models/droiddetect-large-finetuned}"

# Default hyperparameters
BATCH_SIZE=8
GRADIENT_ACCUMULATION=4
EPOCHS=3
LEARNING_RATE="2e-5"
MAX_LENGTH=8192
USE_4BIT=false
MAX_TRAIN_SAMPLES=""
MAX_EVAL_SAMPLES=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    print_info "Checking dependencies..."

    if ! command -v python &> /dev/null; then
        print_error "Python not found. Please install Python 3.10+"
        exit 1
    fi

    if ! command -v poetry &> /dev/null; then
        print_error "Poetry not found. Please install Poetry"
        exit 1
    fi

    # Check if dataset exists
    if [ ! -f "$TRAIN_DATA" ]; then
        print_warning "Training data not found: $TRAIN_DATA"
        print_warning "Please ensure the DroidCollection dataset is available"
    fi
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                print_info "Quick test mode (100 train, 50 eval samples)"
                MAX_TRAIN_SAMPLES="--max_train_samples 100"
                MAX_EVAL_SAMPLES="--max_eval_samples 50"
                EPOCHS=1
                BATCH_SIZE=2
                GRADIENT_ACCUMULATION=2
                shift
                ;;
            --gpu)
                print_info "Full GPU training mode"
                BATCH_SIZE=8
                GRADIENT_ACCUMULATION=4
                USE_4BIT="--use_4bit"
                shift
                ;;
            --low-vram)
                print_info "Low VRAM mode (< 8GB)"
                BATCH_SIZE=2
                GRADIENT_ACCUMULATION=16
                MAX_LENGTH=2048
                USE_4BIT="--use_4bit"
                EPOCHS=5
                shift
                ;;
            --batch-size)
                BATCH_SIZE="$2"
                shift 2
                ;;
            --epochs)
                EPOCHS="$2"
                shift 2
                ;;
            --learning-rate)
                LEARNING_RATE="$2"
                shift 2
                ;;
            --max-length)
                MAX_LENGTH="$2"
                shift 2
                ;;
            --output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --train-data)
                TRAIN_DATA="$2"
                shift 2
                ;;
            --eval-data)
                EVAL_DATA="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --quick           Quick test run (100 samples)"
                echo "  --gpu             Full GPU training (default)"
                echo "  --low-vram        For GPUs with < 8GB VRAM"
                echo "  --batch-size N    Batch size (default: 8)"
                echo "  --epochs N        Number of epochs (default: 3)"
                echo "  --learning-rate N Learning rate (default: 2e-5)"
                echo "  --max-length N    Max sequence length (default: 8192)"
                echo "  --output-dir DIR  Output directory"
                echo "  --train-data FILE Training data path"
                echo "  --eval-data FILE  Evaluation data path"
                echo "  --help, -h        Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

main() {
    print_header "CIPAS AI - DroidDetect-Large Training"

    # Parse command line arguments
    parse_args "$@"

    # Check dependencies
    check_dependencies

    # Print configuration
    echo ""
    print_header "Configuration"
    echo "  Training data:     $TRAIN_DATA"
    echo "  Evaluation data:   $EVAL_DATA"
    echo "  Output directory:  $OUTPUT_DIR"
    echo "  Batch size:        $BATCH_SIZE"
    echo "  Gradient accum:    $GRADIENT_ACCUMULATION"
    echo "  Effective batch:   $((BATCH_SIZE * GRADIENT_ACCUMULATION))"
    echo "  Epochs:            $EPOCHS"
    echo "  Learning rate:     $LEARNING_RATE"
    echo "  Max length:        $MAX_LENGTH"
    echo "  4-bit quant:       $USE_4BIT"
    [ -n "$MAX_TRAIN_SAMPLES" ] && echo "  Max train samples: $MAX_TRAIN_SAMPLES"
    [ -n "$MAX_EVAL_SAMPLES" ] && echo "  Max eval samples:  $MAX_EVAL_SAMPLES"
    echo ""

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Build command
    CMD="poetry run python train_droid_collection.py"
    CMD="$CMD --train_data $TRAIN_DATA"
    CMD="$CMD --eval_data $EVAL_DATA"
    CMD="$CMD --output_dir $OUTPUT_DIR"
    CMD="$CMD --batch_size $BATCH_SIZE"
    CMD="$CMD --gradient_accumulation_steps $GRADIENT_ACCUMULATION"
    CMD="$CMD --epochs $EPOCHS"
    CMD="$CMD --learning_rate $LEARNING_RATE"
    CMD="$CMD --max_length $MAX_LENGTH"
    CMD="$CMD $USE_4BIT"
    [ -n "$MAX_TRAIN_SAMPLES" ] && CMD="$CMD $MAX_TRAIN_SAMPLES"
    [ -n "$MAX_EVAL_SAMPLES" ] && CMD="$CMD $MAX_EVAL_SAMPLES"

    # Run training
    print_header "Starting Training"
    print_info "Executing: $CMD"
    echo ""

    cd "$PROJECT_ROOT"
    eval "$CMD"

    print_header "Training Complete"
    print_info "Model saved to: $OUTPUT_DIR"
    echo ""
    print_info "To evaluate the trained model:"
    echo "  poetry run python evaluate_droid_collection.py \\"
    echo "      --dataset $EVAL_DATA \\"
    echo "      --output results/eval_finetuned.json"
    echo ""
}

# Run main function
main "$@"
