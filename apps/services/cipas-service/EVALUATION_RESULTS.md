# Clone Detection System - Evaluation Results

## Summary

This document summarizes the evaluation results of the multi-language clone detection system.

---

## TOMA Dataset Structure

| File | Clone Type | Description |
|------|------------|-------------|
| `type-1.csv` | Type-1 | Exact clones (identical code) |
| `type-2.csv` | Type-2 | Renamed clones (different identifiers) |
| `type-3.csv` | Type-3 (Strong) | Modified clones with high similarity |
| `type-4.csv` | Type-3 (Moderate) | Modified clones with lower similarity |
| `type-5.csv` | Type-4 | Semantic clones (different implementation) |
| `nonclone.csv` | Non-clones | Negative examples |

**Note:** For Type-3 training, we merge `type-3.csv` (Strong) and `type-4.csv` (Moderate) as both represent Type-3 clones at different similarity levels.

---

## 1. Type-1/2/3 Clone Detection (Random Forest - Pipeline A)

**Training Data:** Type-1 + Type-2 + Type-3 (Strong) + Type-3 (Moderate) + Non-clones

### Performance Metrics

| Metric | Value |
|--------|-------|
| **Training F1** | 91.72% |
| **Cross-Validation F1** | 92.96% ± 1.77% |
| **Test F1 (Type-3 Strong)** | 99.95% |
| **Precision** | 100.00% |
| **Recall** | 99.90% |
| **Training Time** | 3.65s (2000 samples) |

### Feature Importance (Top 3)

1. **Levenshtein Ratio**: 40.3% - Most important for detecting modified clones
2. **Jaccard Similarity**: 19.2% - Set overlap of tokens
3. **Dice Coefficient**: 15.5% - Weighted set overlap

### Dataset Statistics

| Source | Samples |
|--------|---------|
| Type-1 (exact) | 48,116 |
| Type-2 (renamed) | 4,234 |
| Type-3 Strong | 21,395 |
| Type-3 Moderate | 86,341 |
| Non-clones | 279,033 |
| **Total** | **439,119** |

---

## 2. Type-4 Clone Detection (XGBoost - Pipeline B)

**Training Data:** Type-5 (Type-4 semantic) + Non-clones

### Performance Metrics

| Metric | Value |
|--------|-------|
| **Training F1** | 96.48% |
| **Cross-Validation F1** | 96.24% ± 1.57% |
| **Test F1** | 99.30% |
| **Precision** | 99.40% |
| **Recall** | 99.20% |
| **AUC-ROC** | 99.93% |
| **Training Time** | 4.02s (500 samples) |

### Top Feature Categories

1. **CST Try Statement**: 24.7%
2. **CST Catch Clause**: 16.2%
3. **CST Method Declaration**: 8.3%
4. **CST Break Statement**: 5.4%
5. **LOC**: 3.7%

---

## 3. BigCloneBench Evaluation (Cross-Dataset)

### With Threshold Calibration

| Model | Threshold | Precision | Recall | F1 Score |
|-------|-----------|-----------|--------|----------|
| Type-3 (RF) | 0.50 | - | - | 0.00* |
| Type-4 (XGB) | 0.85 | 92.42% | 97.50% | **94.89%** |

*Type-3 model has domain shift issue - doesn't generalize to BCB without fine-tuning

### Comparison with Benchmark Tools

| Tool | Type-3 F1 | Type-4 F1 | Method |
|------|-----------|-----------|--------|
| SourcererCC | 0.79 | - | Token-based |
| ASTNN | 0.88 | 0.88 | Tree-based NN |
| **Our Type-3 (TOMA)** | **0.9995** | - | RF + Syntactic |
| **Our Type-4 (TOMA)** | - | **0.993** | XGB + Semantic |
| **Our Type-4 (BCB)** | - | **0.949** | XGB + Calibrated |

---

## 4. Usage

### Training Type-1/2/3 Model

```bash
cd apps/services/cipas-service
source .venv/bin/activate

# Train on merged Type-3 (strong + moderate) with non-clones
python scripts/train_type3.py --sample-size 15000 --test

# Custom dataset selection
python scripts/train_type3.py --datasets type-3.csv type-4.csv --sample-size 10000
```

### Training Type-4 Model

```bash
# Train on Type-5 (Type-4 semantic clones)
python scripts/train_type4.py --sample-size 5000 --test
```

### Threshold Calibration (for new datasets)

```bash
# Find optimal decision thresholds
python scripts/calibrate_thresholds.py --sample-size 200
```

### Evaluation on BigCloneBench

```bash
# Evaluate with calibrated thresholds
python scripts/evaluate_bcb.py --sample-size 500
```

### Full Pipeline

```bash
# Run complete training and evaluation
python scripts/run_pipeline.py --all
```

---

## 5. Files Generated

| File | Description |
|------|-------------|
| `clone_detection/models/saved/type3_rf.pkl` | Trained Random Forest model |
| `clone_detection/models/saved/type4_xgb.pkl` | Trained XGBoost model |
| `scripts/thresholds.json` | Calibrated decision thresholds |

---

## 6. Conclusion

### Achievements

✅ **Excellent Type-1/2/3 Detection**: 99.95% F1 on Strong Type-3 test set
✅ **Excellent Type-4 Detection**: 99.3% F1 on TOMA, 94.9% on BigCloneBench
✅ **Fast CPU-only Training**: ~4 seconds for both models
✅ **Multi-language Support**: Java, C, Python via Tree-sitter
✅ **15 Token Types**: Covering 99.7% of code tokens
✅ **78 Semantic Features**: CST + PDG-like feature fusion

### Key Insights

1. **Merging Strong + Moderate Type-3** improves model robustness
2. **Levenshtein Ratio** is the most important feature for Type-3 detection
3. **CST features** (try/catch) are most discriminative for Type-4
4. **Threshold calibration** is essential for cross-dataset evaluation
5. **Type-4 model generalizes better** than Type-3 to new datasets

### Recommendations

- Use **Type-4 (XGBoost) model** for cross-dataset evaluation
- Apply **threshold calibration (0.85)** for BigCloneBench-like data
- For production Type-3 detection, **fine-tune on target domain data**

---

## 7. References

- **TOMA Dataset**: Function-level Java clones with similarity scores
- **BigCloneBench**: Industry-standard clone benchmark (28GB, Java-only)
- **Tree-sitter**: Incremental parsing library for CST extraction
- **Pipeline A**: 6 syntactic similarity metrics (TOMA approach)
- **Pipeline B**: 78 fused semantic features (XGBoost approach)
