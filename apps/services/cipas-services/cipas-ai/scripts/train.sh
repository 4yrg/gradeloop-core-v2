#!/usr/bin/env bash
# =============================================================================
# CIPAS AI — Training Launcher
# =============================================================================
#
# Convenience wrapper around train.py that provides GPU-preset modes and
# passes through flags to the Poetry-managed Python CLI.
#
# Usage
# ─────
#   ./scripts/train.sh                        # CatBoost on synthetic data
#   ./scripts/train.sh --model droiddetect    # DroidDetect on DroidCollection
#   ./scripts/train.sh --dataset aicd-bench   # Specific dataset
#   ./scripts/train.sh --quick                # Smoke-test preset
#   ./scripts/train.sh --cpu                  # Force CPU training
#
# Environment overrides
# ─────────────────────
#   DATASET      Dataset name  (default: synthetic)
#   MODEL        Model type    (default: catboost)
#   OUTPUT_DIR   Output dir    (default: models/)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()   { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header() { echo -e "\n${BLUE}${BOLD}════════════════════════════════════${NC}"; \
           echo -e "${BLUE}${BOLD}  $*${NC}"; \
           echo -e "${BLUE}${BOLD}════════════════════════════════════${NC}"; }

# ── Defaults ──────────────────────────────────────────────────────────────────
MODEL="${MODEL:-catboost}"
DATASET="${DATASET:-synthetic}"
VERBOSE=""
EXTRA_ARGS=()

# ── Argument parsing ──────────────────────────────────────────────────────────
usage() {
    echo ""
    echo -e "${BOLD}Usage:${NC} $0 [OPTIONS]"
    echo ""
    echo -e "${BOLD}Preset modes:${NC}"
    echo "  --quick           Smoke-test (synthetic data, reduced iterations)"
    echo "  --cpu             Force CPU training"
    echo ""
    echo -e "${BOLD}Model selection:${NC}"
    echo "  --model MODEL     Model to train: catboost | droiddetect  (default: catboost)"
    echo ""
    echo -e "${BOLD}Dataset:${NC}"
    echo "  --dataset NAME    Dataset to use  (default: synthetic)"
    echo "                    Options: synthetic, aicd-bench, droidcollection"
    echo ""
    echo -e "${BOLD}Misc:${NC}"
    echo "  --verbose         Enable verbose logging"
    echo "  --help, -h        Show this help"
    echo ""
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --quick)
            info "Mode: quick smoke-test"
            DATASET="synthetic"
            ;;
        --cpu)
            info "Mode: CPU training"
            export CIPAS_AI_SYSTEM_DEVICE=cpu
            ;;
        --model)
            MODEL="$2"; shift
            ;;
        --dataset)
            DATASET="$2"; shift
            ;;
        --verbose)
            VERBOSE="--verbose"
            ;;
        --help|-h)
            usage; exit 0
            ;;
        *)
            EXTRA_ARGS+=("$1")
            ;;
    esac
    shift
done

# ── Check environment ─────────────────────────────────────────────────────────
cd "$PROJECT_ROOT"

if command -v poetry &>/dev/null; then
    RUNNER="poetry run python"
else
    RUNNER="python"
fi

# ── GPU detection ─────────────────────────────────────────────────────────────
if python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
    GPU_COUNT=$(python -c "import torch; print(torch.cuda.device_count())" 2>/dev/null || echo "unknown")
    info "CUDA available — $GPU_COUNT GPU(s) detected"
else
    warn "CUDA not available — training on CPU (will be slow for DroidDetect)"
fi

# ── Run training ──────────────────────────────────────────────────────────────
header "CIPAS AI Training — model=$MODEL  dataset=$DATASET"

$RUNNER train.py \
    --model "$MODEL" \
    --dataset "$DATASET" \
    ${VERBOSE} \
    "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
#
# Trains the Stage 3 Deep-Path model (DroidDetect-Large-Binary) on the
# DroidCollection dataset following the paper specification:
#
#   - Model   : DroidDetect-Large-Binary (ModernBERT-large, 396 M params)
#   - Loss    : CrossEntropyLoss + 0.1 × BatchHardSoftMarginTripletLoss
#   - Optim   : AdamW  lr=5e-5  weight_decay=0.01
#   - Schedule: Linear warmup (10 %) → linear decay
#   - Noise   : MC-Dropout  (top 7 % uncertain samples removed / epoch)
#   - Filter  : AST depth 2–31, line count 6–300
#   - Data    : train + dev splits for training; test held for evaluation only
#
# Usage
# ─────
#   ./scripts/train.sh                   # auto-detect GPU, default settings
#   ./scripts/train.sh --hf              # pull DroidCollection from HF Hub
#   ./scripts/train.sh --quick           # smoke-test (200 samples, 1 epoch)
#   ./scripts/train.sh --low-vram        # < 8 GB VRAM (smaller batch + 4-bit)
#   ./scripts/train.sh --full-gpu        # high-VRAM preset (A100 / H100)
#   ./scripts/train.sh --cpu             # force CPU (slow, for testing only)
#
# Environment overrides
# ─────────────────────
#   TRAIN_DATA   path to train JSONL  (default: ../../datasets/droid-collection/Droid_Train.jsonl)
#   DEV_DATA     path to dev JSONL    (default: ../../datasets/droid-collection/Droid_Dev.jsonl)
#   EVAL_DATA    path to test JSONL   (default: ../../datasets/droid-collection/Droid_Test.jsonl)
#   OUTPUT_DIR   output directory     (default: models/droiddetect-large-binary-finetuned)
# =============================================================================

set -euo pipefail

# ── Script location / project root ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BLUE}${BOLD}══════════════════════════════════════════════════${NC}"; \
            echo -e "${BLUE}${BOLD}  $*${NC}"; \
            echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════${NC}"; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

# ── Defaults ─────────────────────────────────────────────────────────────────

# Data paths (can be overridden via env vars)
TRAIN_DATA="${TRAIN_DATA:-../../datasets/droid-collection/Droid_Train.jsonl}"
DEV_DATA="${DEV_DATA:-../../datasets/droid-collection/Droid_Dev.jsonl}"
EVAL_DATA="${EVAL_DATA:-../../datasets/droid-collection/Droid_Test.jsonl}"
OUTPUT_DIR="${OUTPUT_DIR:-models/droiddetect-large-binary-finetuned}"

# Model
MODEL_NAME="answerdotai/ModernBERT-large"
DROIDDETECT_REPO="project-droid/DroidDetect-Large-Binary"

# Training hyper-parameters (paper spec defaults)
EPOCHS=3
BATCH_SIZE=8
GRAD_ACCUM=4
LEARNING_RATE="5e-5"
WEIGHT_DECAY="0.01"
WARMUP_RATIO="0.10"
MAX_GRAD_NORM="1.0"
MAX_LENGTH=8192
TRIPLET_LAMBDA="0.1"

# Noise filtering (paper: top 7 % removed per epoch)
MC_DROPOUT_NOISE_FRACTION="0.07"
MC_DROPOUT_PASSES=10
MC_DROPOUT_RATE="0.1"

# Quality filters (paper: AST depth 2–31, lines 6–300)
AST_DEPTH_MIN=2
AST_DEPTH_MAX=31
LINE_COUNT_MIN=6
LINE_COUNT_MAX=300

# Checkpointing
SAVE_STEPS=500
EVAL_STEPS=250
SEED=42

# Flags
USE_4BIT=""
USE_HF_DATASET=""
FORCE_CPU=""
NO_QUALITY_FILTER=""
NO_MC_DROPOUT_FILTER=""
NO_PRETRAINED_WEIGHTS=""
MAX_TRAIN_SAMPLES=""
MAX_DEV_SAMPLES=""
MAX_EVAL_SAMPLES=""

# ── Argument parsing ──────────────────────────────────────────────────────────

usage() {
    echo ""
    echo -e "${BOLD}Usage:${NC} $0 [OPTIONS]"
    echo ""
    echo -e "${BOLD}Preset modes:${NC}"
    echo "  --quick          Smoke-test (200 train, 50 eval, 1 epoch, small batch)"
    echo "  --full-gpu       High-VRAM preset  (batch=16, accum=2, 8192 ctx)"
    echo "  --low-vram       < 8 GB VRAM       (batch=2,  accum=16, 4-bit, 2048 ctx)"
    echo "  --hf             Load DroidCollection directly from Hugging Face"
    echo "  --cpu            Force CPU training (very slow, testing only)"
    echo ""
    echo -e "${BOLD}Hyperparameters:${NC}"
    echo "  --epochs N                 Training epochs               (default: $EPOCHS)"
    echo "  --batch-size N             Per-device batch size         (default: $BATCH_SIZE)"
    echo "  --grad-accum N             Gradient accumulation steps   (default: $GRAD_ACCUM)"
    echo "  --lr FLOAT                 AdamW learning rate           (default: $LEARNING_RATE)"
    echo "  --max-length N             Max token length              (default: $MAX_LENGTH)"
    echo "  --triplet-lambda FLOAT     Triplet loss weight           (default: $TRIPLET_LAMBDA)"
    echo "  --use-4bit                 Enable 4-bit quantisation (bitsandbytes)"
    echo ""
    echo -e "${BOLD}Data:${NC}"
    echo "  --train-data FILE          Path to train JSONL"
    echo "  --dev-data   FILE          Path to dev   JSONL (merged into training)"
    echo "  --eval-data  FILE          Path to test  JSONL (held out for eval)"
    echo "  --output-dir DIR           Output directory"
    echo ""
    echo -e "${BOLD}Filters:${NC}"
    echo "  --no-quality-filter        Skip AST-depth / line-count quality filter"
    echo "  --no-mc-dropout            Skip MC-Dropout noise removal"
    echo "  --no-pretrained-weights    Train from random init (don't load DroidDetect checkpoint)"
    echo ""
    echo -e "${BOLD}Misc:${NC}"
    echo "  --seed N                   Random seed                   (default: $SEED)"
    echo "  --help, -h                 Show this help"
    echo ""
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in

            # ── Preset modes ───────────────────────────────────────────────
            --quick)
                info "Mode: quick smoke-test (200 train, 50 eval, 1 epoch)"
                MAX_TRAIN_SAMPLES="--max_train_samples 200"
                MAX_DEV_SAMPLES="--max_dev_samples 50"
                MAX_EVAL_SAMPLES="--max_eval_samples 50"
                EPOCHS=1
                BATCH_SIZE=2
                GRAD_ACCUM=2
                MAX_LENGTH=512
                SAVE_STEPS=9999   # effectively disable mid-run checkpoints
                EVAL_STEPS=50
                shift ;;
            --full-gpu)
                info "Mode: full-GPU (batch=16, accum=2, 8192 ctx)"
                BATCH_SIZE=16
                GRAD_ACCUM=2
                MAX_LENGTH=8192
                shift ;;
            --low-vram)
                info "Mode: low-VRAM (<8 GB, 4-bit, batch=2, accum=16, 2048 ctx)"
                BATCH_SIZE=2
                GRAD_ACCUM=16
                MAX_LENGTH=2048
                USE_4BIT="--use_4bit"
                shift ;;
            --hf)
                info "Mode: load DroidCollection from Hugging Face Hub"
                USE_HF_DATASET="--use_hf_dataset"
                shift ;;
            --cpu)
                warn "Mode: CPU-only (this will be extremely slow)"
                FORCE_CPU=1
                shift ;;

            # ── Hyperparameters ────────────────────────────────────────────
            --epochs)          EPOCHS="$2";          shift 2 ;;
            --batch-size)      BATCH_SIZE="$2";      shift 2 ;;
            --grad-accum)      GRAD_ACCUM="$2";      shift 2 ;;
            --lr)              LEARNING_RATE="$2";   shift 2 ;;
            --max-length)      MAX_LENGTH="$2";      shift 2 ;;
            --triplet-lambda)  TRIPLET_LAMBDA="$2";  shift 2 ;;
            --seed)            SEED="$2";            shift 2 ;;
            --use-4bit)        USE_4BIT="--use_4bit"; shift ;;

            # ── Data ───────────────────────────────────────────────────────
            --train-data)   TRAIN_DATA="$2";    shift 2 ;;
            --dev-data)     DEV_DATA="$2";      shift 2 ;;
            --eval-data)    EVAL_DATA="$2";     shift 2 ;;
            --output-dir)   OUTPUT_DIR="$2";    shift 2 ;;

            # ── Filters ────────────────────────────────────────────────────
            --no-quality-filter)       NO_QUALITY_FILTER="--no_quality_filter";           shift ;;
            --no-mc-dropout)           NO_MC_DROPOUT_FILTER="--no_mc_dropout_filter";     shift ;;
            --no-pretrained-weights)   NO_PRETRAINED_WEIGHTS="--no_load_pretrained_weights"; shift ;;

            # ── Misc ───────────────────────────────────────────────────────
            --help|-h) usage; exit 0 ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1 ;;
        esac
    done
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────

check_dependencies() {
    section "Pre-flight checks"

    # Python / Poetry
    if ! command -v python &>/dev/null; then
        error "Python not found — install Python 3.10+"
        exit 1
    fi
    PYTHON_VER=$(python --version 2>&1)
    info "Python: $PYTHON_VER"

    if ! command -v poetry &>/dev/null; then
        error "Poetry not found — install from https://python-poetry.org"
        exit 1
    fi
    info "Poetry: $(poetry --version 2>&1)"

    # CUDA
    if [[ -z "$FORCE_CPU" ]]; then
        CUDA_AVAILABLE=$(python -c "import torch; print(torch.cuda.is_available())" 2>/dev/null || echo "False")
        if [[ "$CUDA_AVAILABLE" == "True" ]]; then
            GPU_NAME=$(python -c "import torch; print(torch.cuda.get_device_name(0))" 2>/dev/null || echo "unknown")
            GPU_MEM=$(python -c "
import torch
mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
print(f'{mem:.1f} GB')
" 2>/dev/null || echo "unknown")
            info "CUDA available: ${GREEN}YES${NC} — $GPU_NAME ($GPU_MEM)"
        else
            warn "CUDA not available — training will run on CPU (very slow)"
        fi
    else
        info "CPU-only mode forced by --cpu flag"
    fi

    # bitsandbytes (only needed for quantisation)
    if [[ -n "$USE_4BIT" ]]; then
        BNB_OK=$(python -c "import bitsandbytes; print('ok')" 2>/dev/null || echo "missing")
        if [[ "$BNB_OK" != "ok" ]]; then
            error "bitsandbytes not installed but --use_4bit requested."
            error "Install with: pip install bitsandbytes"
            exit 1
        fi
        info "bitsandbytes: available"
    fi

    # Data files (skip check when using HF dataset)
    if [[ -z "$USE_HF_DATASET" ]]; then
        if [[ ! -f "$TRAIN_DATA" ]]; then
            warn "Training data not found: $TRAIN_DATA"
            warn "Pass --hf to pull DroidCollection directly from Hugging Face,"
            warn "or provide --train-data pointing to your local JSONL file."
        else
            TRAIN_LINES=$(wc -l < "$TRAIN_DATA" 2>/dev/null || echo "?")
            info "Train JSONL: $TRAIN_DATA  (~${TRAIN_LINES} lines)"
        fi
        if [[ -f "$DEV_DATA" ]]; then
            DEV_LINES=$(wc -l < "$DEV_DATA" 2>/dev/null || echo "?")
            info "Dev JSONL  : $DEV_DATA  (~${DEV_LINES} lines)"
        else
            warn "Dev JSONL not found: $DEV_DATA (training without dev merge)"
        fi
        if [[ -f "$EVAL_DATA" ]]; then
            EVAL_LINES=$(wc -l < "$EVAL_DATA" 2>/dev/null || echo "?")
            info "Test JSONL : $EVAL_DATA  (~${EVAL_LINES} lines)"
        else
            warn "Test JSONL not found: $EVAL_DATA (no mid-training evaluation)"
        fi
    fi
}

# ── Print run configuration ───────────────────────────────────────────────────

print_config() {
    header "Run Configuration"

    EFF_BATCH=$((BATCH_SIZE * GRAD_ACCUM))

    echo -e "  ${BOLD}Model${NC}"
    echo    "    Base encoder      : $MODEL_NAME"
    echo    "    DroidDetect repo  : $DROIDDETECT_REPO"
    echo    "    Output directory  : $OUTPUT_DIR"
    echo ""
    echo -e "  ${BOLD}Data${NC}"
    if [[ -n "$USE_HF_DATASET" ]]; then
        echo "    Source            : Hugging Face (project-droid/DroidCollection)"
        echo "    Training splits   : train + dev"
        echo "    Evaluation split  : test (held out)"
    else
        echo "    Train JSONL       : $TRAIN_DATA"
        echo "    Dev JSONL         : $DEV_DATA  (merged into training)"
        echo "    Test JSONL        : $EVAL_DATA (held out)"
    fi
    echo ""
    echo -e "  ${BOLD}Hyper-parameters${NC}"
    echo    "    Epochs            : $EPOCHS"
    echo    "    Batch size        : $BATCH_SIZE"
    echo    "    Gradient accum.   : $GRAD_ACCUM"
    echo    "    Effective batch   : $EFF_BATCH"
    echo    "    Learning rate     : $LEARNING_RATE  (AdamW, paper: 5e-5)"
    echo    "    Weight decay      : $WEIGHT_DECAY"
    echo    "    Warmup ratio      : $WARMUP_RATIO  (10 % of steps)"
    echo    "    Max grad norm     : $MAX_GRAD_NORM"
    echo    "    Max length        : $MAX_LENGTH tokens"
    echo    "    Triplet λ         : $TRIPLET_LAMBDA"
    echo ""
    echo -e "  ${BOLD}Noise filtering (MC-Dropout)${NC}"
    if [[ -n "$NO_MC_DROPOUT_FILTER" ]]; then
        echo "    MC-Dropout filter : DISABLED"
    else
        echo "    MC-Dropout filter : ENABLED"
        echo "    Noise fraction    : $MC_DROPOUT_NOISE_FRACTION  (top 7 %)"
        echo "    MC passes         : $MC_DROPOUT_PASSES"
        echo "    Dropout rate      : $MC_DROPOUT_RATE"
    fi
    echo ""
    echo -e "  ${BOLD}Quality filter${NC}"
    if [[ -n "$NO_QUALITY_FILTER" ]]; then
        echo "    Quality filter    : DISABLED"
    else
        echo "    Quality filter    : ENABLED"
        echo "    AST depth         : $AST_DEPTH_MIN – $AST_DEPTH_MAX"
        echo "    Line count        : $LINE_COUNT_MIN – $LINE_COUNT_MAX"
    fi
    echo ""
    echo -e "  ${BOLD}Optimisation${NC}"
    echo    "    4-bit quant       : ${USE_4BIT:-off}"
    echo    "    Mixed precision   : $([ -z "$FORCE_CPU" ] && echo 'AMP (CUDA)' || echo 'disabled (CPU mode)')"
    echo    "    Seed              : $SEED"
    echo ""
}

# ── Build the Python command ──────────────────────────────────────────────────

build_cmd() {
    CMD="poetry run python train_droid_collection.py"

    # ── Data ──────────────────────────────────────────────────────────────
    if [[ -n "$USE_HF_DATASET" ]]; then
        CMD="$CMD --use_hf_dataset"
    else
        [[ -f "$TRAIN_DATA" ]] && CMD="$CMD --train_data $TRAIN_DATA"
        [[ -f "$DEV_DATA"   ]] && CMD="$CMD --dev_data   $DEV_DATA"
        [[ -f "$EVAL_DATA"  ]] && CMD="$CMD --eval_data  $EVAL_DATA"
    fi

    # ── Sample caps ───────────────────────────────────────────────────────
    [[ -n "$MAX_TRAIN_SAMPLES" ]] && CMD="$CMD $MAX_TRAIN_SAMPLES"
    [[ -n "$MAX_DEV_SAMPLES"   ]] && CMD="$CMD $MAX_DEV_SAMPLES"
    [[ -n "$MAX_EVAL_SAMPLES"  ]] && CMD="$CMD $MAX_EVAL_SAMPLES"

    # ── Model ─────────────────────────────────────────────────────────────
    CMD="$CMD --model_name        $MODEL_NAME"
    CMD="$CMD --droiddetect_repo  $DROIDDETECT_REPO"
    CMD="$CMD --max_length        $MAX_LENGTH"
    [[ -n "$NO_PRETRAINED_WEIGHTS" ]] && CMD="$CMD $NO_PRETRAINED_WEIGHTS"

    # ── Training hyper-parameters ─────────────────────────────────────────
    CMD="$CMD --epochs                      $EPOCHS"
    CMD="$CMD --batch_size                  $BATCH_SIZE"
    CMD="$CMD --gradient_accumulation_steps $GRAD_ACCUM"
    CMD="$CMD --learning_rate               $LEARNING_RATE"
    CMD="$CMD --weight_decay                $WEIGHT_DECAY"
    CMD="$CMD --warmup_ratio                $WARMUP_RATIO"
    CMD="$CMD --max_grad_norm               $MAX_GRAD_NORM"
    CMD="$CMD --triplet_lambda              $TRIPLET_LAMBDA"

    # ── MC-Dropout noise filtering ────────────────────────────────────────
    if [[ -n "$NO_MC_DROPOUT_FILTER" ]]; then
        CMD="$CMD --no_mc_dropout_filter"
    else
        CMD="$CMD --mc_dropout_noise_fraction  $MC_DROPOUT_NOISE_FRACTION"
        CMD="$CMD --mc_dropout_passes          $MC_DROPOUT_PASSES"
        CMD="$CMD --mc_dropout_rate            $MC_DROPOUT_RATE"
    fi

    # ── Quality filter ────────────────────────────────────────────────────
    if [[ -n "$NO_QUALITY_FILTER" ]]; then
        CMD="$CMD --no_quality_filter"
    else
        CMD="$CMD --ast_depth_min   $AST_DEPTH_MIN"
        CMD="$CMD --ast_depth_max   $AST_DEPTH_MAX"
        CMD="$CMD --line_count_min  $LINE_COUNT_MIN"
        CMD="$CMD --line_count_max  $LINE_COUNT_MAX"
    fi

    # ── Quantisation / precision ──────────────────────────────────────────
    [[ -n "$USE_4BIT"    ]] && CMD="$CMD $USE_4BIT"
    [[ -n "$FORCE_CPU"   ]] && CMD="$CMD --no_mixed_precision"

    # ── Output ────────────────────────────────────────────────────────────
    CMD="$CMD --output_dir   $OUTPUT_DIR"
    CMD="$CMD --save_steps   $SAVE_STEPS"
    CMD="$CMD --eval_steps   $EVAL_STEPS"
    CMD="$CMD --seed         $SEED"
}

# ── After-training hints ──────────────────────────────────────────────────────

post_run_hints() {
    header "Training Complete"
    info "Model artefacts saved to: $OUTPUT_DIR"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo ""
    echo "  1. Evaluate the fine-tuned model on the held-out test split:"
    echo ""
    echo "       poetry run python evaluate_droid_collection.py \\"
    echo "           --model_path $OUTPUT_DIR/best \\"
    echo "           --eval_data  $EVAL_DATA \\"
    echo "           --output     results/eval_binary.json"
    echo ""
    echo "  2. Point cipas-ai at your new weights by setting:"
    echo ""
    echo "       CIPAS_AI_TIER2_MODEL_NAME=$OUTPUT_DIR/best"
    echo ""
    echo "  3. Run the service:"
    echo ""
    echo "       poetry run python main.py"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
    header "CIPAS AI — DroidDetect-Large-Binary Training"

    parse_args "$@"
    check_dependencies
    print_config
    build_cmd

    # Create output directory upfront so the script fails early if permissions
    # are wrong rather than after hours of training.
    mkdir -p "$OUTPUT_DIR"

    section "Starting Training"
    info "Working directory: $PROJECT_ROOT"
    info "Command:"
    echo ""
    echo -e "  ${CYAN}${CMD}${NC}"
    echo ""

    # Change to project root before running so relative paths resolve correctly
    cd "$PROJECT_ROOT"

    # ── Execute ───────────────────────────────────────────────────────────
    # We use `eval` so that the empty optional flags (which are empty strings)
    # don't get passed as literal empty arguments to Python.
    eval "$CMD"
    EXIT_CODE=$?

    if [[ $EXIT_CODE -eq 0 ]]; then
        post_run_hints
    else
        echo ""
        error "Training exited with code $EXIT_CODE"
        echo ""
        echo -e "${YELLOW}Troubleshooting tips:${NC}"
        echo "  • OOM?  Try --low-vram or reduce --batch-size / --max-length"
        echo "  • No data?  Pass --hf or point --train-data at your JSONL file"
        echo "  • Missing deps?  Run: poetry install"
        echo ""
        exit $EXIT_CODE
    fi
}

main "$@"
```

Now let's also write a new `scripts/train_catboost.sh` for Stage 2 CatBoost training and update the `scripts/build_parsers.py` for the extended feature set:
