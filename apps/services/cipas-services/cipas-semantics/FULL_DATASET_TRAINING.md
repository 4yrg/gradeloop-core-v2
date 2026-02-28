# Full Dataset Training Guide - Type-IV Code Clone Detector

## Overview

This guide explains how to train the Type-IV Code Clone Detector on the **full Project CodeNet dataset** for production-quality models.

## Dataset Information

**Project CodeNet** contains:
- **13.9 million** code submissions
- **4,053** programming problems
- **55** programming languages
- Primary languages: C++, Python, Java, C, Ruby, C#

## Training Options

### 1. Full Dataset Training (Production)

```bash
# All 4 languages (Java, Python, C, C#) - RECOMMENDED
poetry run python train.py --full-dataset --all-languages

# Java only
poetry run python train.py --full-dataset --language java

# Specific languages
poetry run python train.py --full-dataset --languages java python csharp
```

**Expected Results:**
- Training pairs: ~100,000 - 500,000 per language
- Training time: **4-12 hours** (depends on hardware)
- Model size: ~50-200 MB
- Expected F1: **0.85-0.90**

### 2. Large Sample Training (Recommended for Development)

```bash
# 100k samples across all languages
poetry run python train.py --all-languages --sample-size 100000

# 50k samples (good balance)
poetry run python train.py --all-languages --sample-size 50000
```

**Expected Results:**
- Training pairs: 25,000 - 100,000
- Training time: **1-4 hours**
- Model size: ~30-100 MB
- Expected F1: **0.82-0.88**

### 3. Medium Sample Training (Quick Iteration)

```bash
# 10k samples
poetry run python train.py --all-languages --sample-size 10000
```

**Expected Results:**
- Training pairs: 10,000
- Training time: **15-30 minutes**
- Model size: ~20-50 MB
- Expected F1: **0.75-0.82**

### 4. Quick Test (Validation)

```bash
# 1k samples
poetry run python train.py --sample-size 1000 --model-name type4_xgb_test.pkl
```

**Expected Results:**
- Training pairs: 1,000
- Training time: **2-5 minutes**
- Model size: ~10-20 MB
- Expected F1: **0.60-0.75**

## System Requirements

### Full Dataset Training

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 16 GB | 32 GB |
| **CPU** | 4 cores | 8+ cores |
| **Storage** | 10 GB free | 20 GB free |
| **Time** | 8-12 hours | 4-6 hours |

### Large Sample Training (100k)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 8 GB | 16 GB |
| **CPU** | 4 cores | 8 cores |
| **Storage** | 5 GB free | 10 GB free |
| **Time** | 3-5 hours | 1-2 hours |

### Medium Sample Training (10k)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 4 GB | 8 GB |
| **CPU** | 2 cores | 4 cores |
| **Storage** | 2 GB free | 5 GB free |
| **Time** | 30-60 min | 15-30 min |

## Training Process

### Phase 1: Data Loading (30-60 minutes for full dataset)

```
Loading problem list...
Found 2820 problems with submissions
Loading submissions...
Loaded 97 problems with submissions
```

### Phase 2: Pair Creation (15-30 minutes)

```
Creating 250,000 clone pairs...
  Created 1,000 clone pairs...
  Created 2,000 clone pairs...
  ...
Creating 250,000 non-clone pairs...
  Created 1,000 non-clone pairs...
```

### Phase 3: Feature Extraction (1-3 hours)

```
Extracting Sheneamer features...
Feature matrix shape: (500000, 218)
Class distribution: 250000 clones, 250000 non-clones
```

### Phase 4: Model Training (30-60 minutes)

```
Training XGBoost classifier...
Cross-validation F1: 0.8523 (+/- 0.0234)
Test set metrics: {'accuracy': 0.86, 'precision': 0.85, 'recall': 0.87, 'f1': 0.86}
Model saved to models/type4_xgb_codenet.pkl
```

### Phase 5: Visualization (15-30 minutes)

```
Generating training visualizations...
Visualizations saved to: metrics_output/training_report.html
```

## Output Files

```
models/
├── type4_xgb_codenet.pkl              # Trained XGBoost model
└── type4_xgb_codenet.pkl.features.json # Feature names

metrics_output/
└── training/
    └── YYYYMMDD_HHMMSS/
        ├── figures/
        │   ├── confusion_matrix.png
        │   ├── confusion_matrix_normalized.png
        │   ├── roc_curve.png
        │   ├── pr_curve.png
        │   └── feature_importance.png
        └── reports/
            └── training_report_type4_xgb_codenet.html

pipeline_output/
└── summary/
    └── YYYYMMDD_HHMMSS/
        ├── summary.json
        └── README.md
```

## Monitoring Training

### Check Progress

The training script logs progress every 1,000 pairs:

```bash
# Watch training logs
poetry run python train.py --full-dataset --all-languages 2>&1 | tee training.log

# In another terminal, monitor progress
tail -f training.log
```

### Resource Monitoring

```bash
# Monitor memory usage
watch -n 5 'free -h'

# Monitor CPU usage
htop

# Monitor disk usage
df -h .
```

## Tips for Full Dataset Training

### 1. Run in Background

```bash
# Using nohup
nohup poetry run python train.py --full-dataset --all-languages > training.log 2>&1 &

# Check if running
ps aux | grep train.py

# View logs
tail -f training.log
```

### 2. Use Screen/Tmux

```bash
# Start screen session
screen -S clone_training

# Run training
poetry run python train.py --full-dataset --all-languages

# Detach: Ctrl+A, D
# Reattach: screen -r clone_training
```

### 3. Disable Visualizations (Faster)

```bash
# Skip visualization generation
poetry run python train.py --full-dataset --all-languages --no-visualize
```

### 4. Train Languages Separately

```bash
# Train Java first
poetry run python train.py --full-dataset --language java --model-name type4_xgb_java.pkl

# Then Python
poetry run python train.py --full-dataset --language python --model-name type4_xgb_python.pkl

# Then C
poetry run python train.py --full-dataset --language c --model-name type4_xgb_c.pkl

# Then C#
poetry run python train.py --full-dataset --language csharp --model-name type4_xgb_csharp.pkl
```

## Evaluation After Training

```bash
# Evaluate on all languages
poetry run python evaluate.py --all-languages --sample-size 10000

# Evaluate on specific dataset
poetry run python evaluate.py \
  --model models/type4_xgb_codenet.pkl \
  --datasets gptclonebench \
  --all-languages \
  --sample-size 5000
```

## Troubleshooting

### Out of Memory

```bash
# Reduce sample size
poetry run python train.py --sample-size 50000 --all-languages

# Or train languages one at a time
poetry run python train.py --full-dataset --language java
```

### Training Too Slow

```bash
# Disable visualizations
poetry run python train.py --full-dataset --no-visualize

# Disable cross-validation
poetry run python train.py --full-dataset --no-cv
```

### Dataset Not Found

```bash
# Verify dataset path
ls -la ../../../../datasets/project-codenet/

# Check data directory
ls ../../../../datasets/project-codenet/data/ | head
```

## Expected Performance by Sample Size

| Sample Size | Training Time | Expected F1 | Use Case |
|-------------|---------------|-------------|----------|
| 1,000 | 2-5 min | 0.60-0.75 | Testing/Validation |
| 10,000 | 15-30 min | 0.75-0.82 | Development |
| 50,000 | 1-2 hours | 0.80-0.86 | Pre-production |
| 100,000 | 2-4 hours | 0.82-0.88 | Production |
| 500,000 (full) | 4-12 hours | 0.85-0.90 | Production (Best) |

## Next Steps After Training

1. **Evaluate Model**
   ```bash
   poetry run python evaluate.py --all-languages --sample-size 10000
   ```

2. **Review Visualizations**
   ```bash
   # Open HTML report
   open metrics_output/training/*/reports/*.html
   ```

3. **Deploy Model**
   ```bash
   # Start the API service
   poetry run uvicorn main:app --port 8087
   ```

4. **Monitor Performance**
   ```bash
   # Check API health
   curl http://localhost:8087/api/v1/semantics/health
   ```

## Contact & Support

For issues or questions:
- Check logs in `training.log`
- Review metrics in `metrics_output/`
- Verify dataset structure in `datasets/project-codenet/`
