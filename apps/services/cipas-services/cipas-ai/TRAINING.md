# CIPAS AI - Training Guide

## Overview

This guide covers training the **ModernBERT-Large** based code detection model on the **DroidCollection** dataset.

## Prerequisites

1. **Hardware Requirements**:
   - **Minimum**: 16GB RAM, CPU-only (slow)
   - **Recommended**: NVIDIA GPU with 16GB+ VRAM (RTX 3090/4090, A100, etc.)
   - **Optimal**: Multi-GPU setup with 40GB+ VRAM per GPU

2. **Software Requirements**:
   - Python 3.10+
   - Poetry
   - NVIDIA CUDA Toolkit 12.1+ (for GPU training)
   - Git LFS (for downloading models)

## Installation

### 1. Install Dependencies

```bash
cd apps/services/cipas-services/cipas-ai

# Install Poetry dependencies
poetry install

# For GPU training, install CUDA-enabled PyTorch
poetry run pip install torch --index-url https://download.pytorch.org/whl/cu121

# Install bitsandbytes for quantization (optional, Linux only)
poetry run pip install bitsandbytes
```

### 2. Download Dataset

Ensure the DroidCollection dataset is available:

```bash
# Dataset should be at:
# ../../datasets/droid-collection/Droid_Train.jsonl
# ../../datasets/droid-collection/Droid_Test.jsonl

# If not present, download from HuggingFace:
# https://huggingface.co/datasets/project-droid/DroidCollection
```

### 3. Prepare Dataset

```bash
# Validate and analyze dataset
poetry run python scripts/prepare_droid_dataset.py \
    --data_path ../../datasets/droid-collection/Droid_Combined.jsonl \
    --output_dir ../../datasets/droid-collection \
    --eval_ratio 0.1
```

## Training

### Quick Test Run (CPU)

Test the training pipeline with a small subset:

```bash
poetry run python train_droid_collection.py \
    --max_train_samples 100 \
    --max_eval_samples 50 \
    --epochs 1 \
    --batch_size 2 \
    --gradient_accumulation_steps 2 \
    --output_dir models/test-run
```

### Standard Training (Single GPU)

Full training on a single GPU (16GB VRAM):

```bash
poetry run python train_droid_collection.py \
    --train_data ../../datasets/droid-collection/Droid_Train.jsonl \
    --eval_data ../../datasets/droid-collection/Droid_Test.jsonl \
    --output_dir models/droiddetect-large-finetuned \
    --batch_size 8 \
    --gradient_accumulation_steps 4 \
    --epochs 3 \
    --learning_rate 2e-5 \
    --max_length 8192 \
    --use_4bit
```

### High-Performance Training (Multi-GPU)

For multi-GPU setups, use `torchrun`:

```bash
torchrun --nproc_per_node=2 \
    train_droid_collection.py \
    --train_data ../../datasets/droid-collection/Droid_Train.jsonl \
    --eval_data ../../datasets/droid-collection/Droid_Test.jsonl \
    --output_dir models/droiddetect-large-finetuned \
    --batch_size 16 \
    --gradient_accumulation_steps 2 \
    --epochs 3 \
    --learning_rate 2e-5 \
    --max_length 4096
```

### Memory-Efficient Training (< 8GB VRAM)

For GPUs with limited VRAM:

```bash
poetry run python train_droid_collection.py \
    --batch_size 2 \
    --gradient_accumulation_steps 16 \
    --use_4bit \
    --max_length 2048 \
    --epochs 5
```

## Configuration Options

### Model Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `--model_name` | `answerdotai/ModernBERT-large` | Base encoder model |
| `--num_classes` | `3` | 3 (merge adversarial) or 4 (keep separate) |
| `--max_length` | `8192` | Maximum sequence length (tokens) |

### Training Hyperparameters

| Option | Default | Description |
|--------|---------|-------------|
| `--batch_size` | `8` | Batch size per device |
| `--gradient_accumulation_steps` | `4` | Gradient accumulation steps |
| `--epochs` | `3` | Number of training epochs |
| `--learning_rate` | `2e-5` | Learning rate (AdamW) |
| `--weight_decay` | `0.01` | Weight decay (L2 regularization) |
| `--warmup_ratio` | `0.1` | Warmup ratio (10% of steps) |
| `--max_grad_norm` | `1.0` | Gradient clipping threshold |

### Optimization

| Option | Default | Description |
|--------|---------|-------------|
| `--use_4bit` | `false` | Enable 4-bit quantization |
| `--use_8bit` | `false` | Enable 8-bit quantization |
| `--no_mixed_precision` | `false` | Disable AMP (mixed precision) |

### Output & Logging

| Option | Default | Description |
|--------|---------|-------------|
| `--output_dir` | `models/droiddetect-large-finetuned` | Output directory |
| `--save_steps` | `500` | Save checkpoint every N steps |
| `--eval_steps` | `200` | Evaluate every N steps |
| `--seed` | `42` | Random seed |

## Monitoring Training

### Real-time Logs

Training progress is logged to stdout:

```
2024-01-01 12:00:00 - INFO - Epoch 1/3
2024-01-01 12:00:00 - INFO - Loading encoder: answerdotai/ModernBERT-large
...
Epoch 1/3: 100%|████████████| 1000/1000 [10:00<00:00, loss=0.456]
Step 200: eval_loss=0.523, eval_acc=0.876
```

### Weights & Biases Integration

For experiment tracking, modify the script to use W&B:

```python
# Add to train_droid_collection.py
import wandb
wandb.init(project="droiddetect-large", config=config)
```

## Evaluation

### Evaluate Trained Model

```bash
poetry run python evaluate_droid_collection.py \
    --dataset ../../datasets/droid-collection/Droid_Test.jsonl \
    --max-samples 5000 \
    --batch-size 32 \
    --output results/eval_finetuned.json
```

### Expected Performance

Based on the DroidDetect paper, expect:

| Metric | Binary (Human vs AI) | Ternary (3-class) |
|--------|---------------------|-------------------|
| Accuracy | ~0.95 | ~0.88 |
| Macro F1 | ~0.94 | ~0.87 |
| Recall (AI) | ~0.96 | ~0.89 |

## Checkpoint Management

### Resume Training

To resume from a checkpoint, modify the script to load training state:

```python
checkpoint = torch.load("models/checkpoint-500/training_state.pt")
model.load_state_dict(torch.load("models/checkpoint-500/pytorch_model.bin"))
optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
```

### Export Best Model

The best model (by evaluation accuracy) is automatically saved to:

```
models/droiddetect-large-finetuned/best/
├── pytorch_model.bin
├── config.json
└── tokenizer/
```

### Upload to HuggingFace Hub

```python
from huggingface_hub import HfApi

api = HfApi()
api.upload_folder(
    folder_path="models/droiddetect-large-finetuned/best",
    repo_id="your-username/droiddetect-large-finetuned",
    repo_type="model",
)
```

## Troubleshooting

### Out of Memory (OOM)

**Solution 1**: Reduce batch size and increase gradient accumulation

```bash
--batch_size 4 --gradient_accumulation_steps 8
```

**Solution 2**: Enable 4-bit quantization

```bash
--use_4bit
```

**Solution 3**: Reduce max sequence length

```bash
--max_length 4096
```

### Slow Training

**Solution 1**: Enable mixed precision (default)

```bash
# Mixed precision is enabled by default
# To explicitly disable: --no_mixed_precision
```

**Solution 2**: Use Flash Attention (requires installation)

```bash
poetry run pip install flash-attn --no-build-isolation
```

**Solution 3**: Increase number of data loading workers

```python
# In train_droid_collection.py, modify DataLoader:
num_workers=8  # Increase from default 4
```

### Poor Convergence

**Solution 1**: Lower learning rate

```bash
--learning_rate 1e-5
```

**Solution 2**: Increase warmup ratio

```bash
--warmup_ratio 0.15
```

**Solution 3**: Train for more epochs

```bash
--epochs 5
```

### Class Imbalance

The script automatically computes class weights. To verify:

```bash
poetry run python scripts/prepare_droid_dataset.py \
    --data_path ../../datasets/droid-collection/Droid_Train.jsonl
```

Check the label distribution in the output. If severely imbalanced, consider:

1. **Oversampling** minority classes
2. **Undersampling** majority classes
3. **Focal Loss** instead of CrossEntropy

## Performance Benchmarks

### Training Speed (samples/second)

| Hardware | Batch Size | Speed |
|----------|------------|-------|
| CPU (8-core) | 4 | ~5 |
| RTX 3090 | 8 | ~150 |
| RTX 4090 | 16 | ~300 |
| A100 (40GB) | 32 | ~500 |

### Memory Usage

| Configuration | VRAM Usage |
|---------------|------------|
| Full precision, 8192 tokens | ~24GB |
| 4-bit quantized, 8192 tokens | ~8GB |
| Full precision, 4096 tokens | ~14GB |
| 4-bit quantized, 4096 tokens | ~5GB |

## Best Practices

1. **Start Small**: Test with 100 samples before full training
2. **Use Quantization**: 4-bit for limited VRAM, minimal accuracy loss
3. **Monitor Validation Loss**: Stop early if val loss increases
4. **Save Frequently**: Checkpoints every 200-500 steps
5. **Seed Everything**: For reproducibility, use `--seed 42`
6. **Class Weights**: Automatically applied for imbalanced data
7. **Gradient Clipping**: Prevents exploding gradients (default: 1.0)

## Example Training Scripts

### `run_training.sh`

```bash
#!/bin/bash

# Training configuration
TRAIN_DATA="../../datasets/droid-collection/Droid_Train.jsonl"
EVAL_DATA="../../datasets/droid-collection/Droid_Test.jsonl"
OUTPUT_DIR="models/droiddetect-large-finetuned"

# Run training
poetry run python train_droid_collection.py \
    --train_data "$TRAIN_DATA" \
    --eval_data "$EVAL_DATA" \
    --output_dir "$OUTPUT_DIR" \
    --batch_size 8 \
    --gradient_accumulation_steps 4 \
    --epochs 3 \
    --learning_rate 2e-5 \
    --max_length 8192 \
    --use_4bit \
    --seed 42

echo "Training complete!"
```

## Next Steps

After training:

1. **Evaluate** on test set
2. **Test** with real code samples
3. **Deploy** to the CIPAS AI service
4. **Monitor** production performance
5. **Iterate** based on false positives/negatives

## License

Part of the Gradeloop Core project.
