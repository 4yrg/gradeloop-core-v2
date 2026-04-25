# CIPAS Semantics and AI Detection: Implementation and Results

## 1. Introduction

This document provides the implementation details and experimental results for two core components of the CIPAS (Code Plagiarism Detection and Analysis System) framework:

1. **CIPAS Semantics** - Semantic Clone Detection service
2. **CIPAS AI Detection** - AI-Generated Code Detection service

---

## 2. CIPAS Semantics: Semantic Clone Detection

### 2.1 Problem Statement

Semantic clone detection identifies code snippets that implement the same functionality despite syntactic differences. This is critical for detecting plagiarism where students rename variables, modify formatting, or restructure code while preserving the original logic.

### 2.2 Model Architecture

The semantic clone detection model is based on **GraphCodeBERT**, a pre-trained code understanding model that captures both syntactic and semantic code features.

#### Base Encoder
- **Model**: `microsoft/graphcodebert-base`
- **Hidden Size**: 768
- **Architecture**: Transformer-based encoder with 12 layers, 12 attention heads

#### Classification Head
The model uses a Siamese-style architecture that processes two code snippets and combines their embeddings:

```
Input Features: [e1, e2, |e1 - e2|, e1 * e2]
- e1: CLS embedding from code snippet 1 (768D)
- e2: CLS embedding from code snippet 2 (768D)
- |e1 - e2|: Absolute difference (768D)
- e1 * e2: Element-wise product (768D)
Combined: 3072D
```

**Classification Network**:
```
3072 → 512 (Linear + LayerNorm + Dropout 0.3 + ReLU)
512 → 128 (Linear + LayerNorm + Dropout 0.2 + ReLU)
128 → 2 (Linear)  # Output: [not_clone, clone]
```

#### Model Configuration
| Parameter | Value |
|-----------|-------|
| model_name | microsoft/graphcodebert-base |
| max_length | 512 tokens |
| hidden_size | 768 |
| dropout_rate | 0.3 |
| best_epoch | 8 |

### 2.3 Training Methodology

#### Dataset
The model was trained on a combined dataset:

1. **GPTCloneBench** - Synthetic AI-generated code pairs (20% of dataset)
2. **Project CodeNet** - Real-world programming solutions (80% of dataset)

| Dataset Split | Ratio |
|-------------|-------|
| Training | 70% |
| Validation | 15% |
| Test | 15% |

**Positive/Negative Balance**: 50% clone pairs, 50% non-clone pairs

#### Training Configuration
| Parameter | Value |
|-----------|-------|
| max_samples | 200,000 |
| num_epochs | 20 |
| batch_size | 16 (train), 32 (eval) |
| learning_rate | 2e-5 |
| weight_decay | 0.01 |
| gradient_accumulation_steps | 2 |
| warmup_ratio | 0.1 |
| label_smoothing | 0.1 |
| early_stopping_patience | 5 |
| random_seed | 42 |

#### Hardware Optimizations
- Mixed Precision (AMP): Enabled
- TF32: Enabled for RTX 6000 Blackwell
- cuDNN Benchmark: Enabled
- DataLoader workers: 4
- Pin Memory: Enabled

#### Data Augmentation
- Random comment insertion (30% probability)
- Code pair swapping

### 2.4 Training Pipeline

1. **Data Loading**: Download GPTCloneBench and Project CodeNet from Google Drive
2. **Preprocessing**: Tokenize code pairs with GraphCodeBERT tokenizer
3. **Split**: Stratified train/val/test split
4. **Training**: Mini-batch gradient descent with label smoothing loss
5. **Validation**: Evaluate F1 score after each epoch
6. **Early Stopping**: Stop if no improvement for 5 epochs
7. **Export**: Save best model checkpoint

### 2.5 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/semantics/health` | GET | Health check |
| `/api/v1/semantics/ready` | GET | Readiness check |
| `/api/v1/semantics/model/info` | GET | Model configuration |
| `/api/v1/semantics/detect` | POST | Detect semantic clones (single pair) |
| `/api/v1/semantics/detect/batch` | POST | Batch clone detection |
| `/api/v1/semantics/similarity` | POST | Get similarity score |

#### Request/Response Schemas

**CloneDetectionRequest**:
```json
{
  "code1": "string",
  "code2": "string"
}
```

**CloneDetectionResponse**:
```json
{
  "is_clone": "boolean",
  "confidence": "float (0-1)",
  "clone_probability": "float (0-1)",
  "not_clone_probability": "float (0-1)"
}
```

### 2.6 Implementation Files

| File | Description |
|------|-------------|
| `api/main.py` | FastAPI application entry point |
| `api/models/model.py` | SemanticCloneModel architecture |
| `api/models/inference.py` | Inference wrapper |
| `api/endpoints/detection.py` | API endpoints |
| `api/schemas/schemas.py` | Pydantic request/response models |
| `api/core/config.py` | Configuration settings |
| `scripts/train/train.py` | Complete training pipeline |

### 2.7 Available Results

**Note**: The evaluation results (precision, recall, F1, confusion matrix) are **NOT available** in the repository. The following artifacts exist:

- ✅ Trained model: `model/model.pt`
- ✅ Model config: `model/config.json`
- ✅ Tokenizer: `model/tokenizer/`
- ✅ Best epoch: 8
- ❌ Epoch-by-epoch metrics (loss, F1)
- ❌ Confusion matrices
- ❌ Final test evaluation metrics (accuracy, precision, recall, F1, ROC-AUC)
- ❌ Training history (CSV)

---

## 3. CIPAS AI Detection: AI-Generated Code Identification

### 3.1 Problem Statement

With the proliferation of large language models (LLMs) capable of generating code, detecting AI-generated code submissions has become essential for academic integrity. This service identifies whether a code snippet was likely generated by an AI system.

### 3.2 Model Architecture

The AI detection model is based on **UniXcoder**, a universal code representation model that excels at code understanding tasks.

#### Base Encoder
- **Model**: `microsoft/unixcoder-base`
- **Hidden Size**: 768
- **Architecture**: Roberta-based encoder

#### Classification Head
```
CLS Token Embedding (768) → Linear(768, 2)
Output: [human_probability, ai_probability]
```

#### Model Configuration
| Parameter | Value |
|-----------|-------|
| model_name | microsoft/unixcoder-base |
| max_length | 256 tokens |
| hidden_size | 768 |
| vocab_size | 51,416 |

### 3.3 Training Methodology

The model was fine-tuned on the **AICD-Bench** benchmark, astandard dataset for AI code detection.

#### Training Configuration
| Parameter | Value |
|-----------|-------|
| batch_size | 64 |
| max_length | 512 tokens |
| evaluation_benchmarks | T1, T2, T3 |

### 3.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/ai/health` | GET | Health check |
| `/api/v1/ai/ready` | GET | Readiness check |
| `/api/v1/ai/detect` | POST | Detect AI-generated code |

#### Request/Response Schemas

**CodeSnippetRequest**:
```json
{
  "code": "string"
}
```

**AIDetectionResponse**:
```json
{
  "is_ai_generated": "boolean",
  "confidence": "float (0-1)",
  "ai_likelihood": "float (0-1)",
  "human_likelihood": "float (0-1)"
}
```

### 3.5 Implementation Files

| File | Description |
|------|-------------|
| `src/main.py` | FastAPI application entry point |
| `src/models.py` | UniXcoderClassifier + AIDetectionModel |
| `src/schemas.py` | Pydantic request/response models |
| `scripts/training/evaluate.py` | Evaluation script |
| `scripts/training/data.py` | Data loading utilities |

### 3.6 Available Results

The following metrics are **available** in the repository:

| Metric | Value |
|--------|-------|
| **ROC-AUC** | **0.9912** |

This AUC was computed on the AICD-Bench test set.

**Note**: Comprehensive evaluation results are **NOT available**:
- ✅ ROC-AUC: 0.9912
- ❌ Accuracy
- ❌ Precision
- ❌ Recall
- ❌ F1 Score
- ❌ Confusion Matrix
- ❌ Per-benchmark results (T1, T2, T3)

The evaluation script (`scripts/training/evaluate.py`) exists and can be run to generate these metrics.

---

## 4. System Architecture

### 4.1 Service Deployment

Both services are deployed as FastAPI applications behind Kong API Gateway:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Client    │ ──► │  Kong Gateway   │ ──► │ CIPAS Semantics    │
│             │     │                 │     │ (Port 8105)       │
└─────────────┘     │                 │     └─────────────────────┘
                    │                 │     ┌─────────────────────┐
                    │                 │ ──► │ CIPAS AI Detection │
                    │                 │     │ (Port 8104)       │
                    └─────────────────┘     └─────────────────────┘
```

### 4.2 Service Configuration

**CIPAS Semantics**:
- Port: 8105
- API prefix: `/api/v1/semantics`
- Model directory: `./model`

**CIPAS AI Detection**:
- Port: 8104
- API prefix: `/api/v1/ai`
- Model directory: `./model`

### 4.3 Docker Configuration

Both services include Dockerfile configurations for containerized deployment.

---

## 5. Summary of Results

### 5.1 CIPAS Semantics

| Aspect | Status |
|--------|--------|
| Model Architecture | ✅ GraphCodeBERT-based Siamese network |
| Training Pipeline | ✅ Implemented |
| Trained Model | ✅ Available (epoch 8) |
| Best Epoch | 8 |
| Test Metrics | ❌ Not available |

### 5.2 CIPAS AI Detection

| Aspect | Status |
|--------|--------|
| Model Architecture | ✅ UniXcoder-based classifier |
| Training Pipeline | ✅ Implemented |
| Trained Model | ✅ Available |
| ROC-AUC | ✅ 0.9912 |
| Test Metrics (Precision/Recall/F1) | ❌ Not available |

---

## 6. Recommendations for Complete Evaluation

To obtain comprehensive evaluation metrics:

1. **CIPAS Semantics**: Run the test set through the trained model using the training script's evaluation mode
2. **CIPAS AI Detection**: Execute `scripts/training/evaluate.py` on AICD-Bench T1, T2, T3 splits

Both evaluation scripts are present in the repository and can generate:
- Accuracy, Precision, Recall, F1 Score
- Confusion matrices
- ROC-AUC curves

---

## 7. References

- GraphCodeBERT: https://github.com/microsoft/GraphCodeBERT
- UniXcoder: https://github.com/microsoft/CodeBERT/tree/master/models/unixcoder
- AICD-Bench: https://huggingface.co/datasets/AICD-bench/AICD-Bench
- Project CodeNet: https://github.com/IBM/project-codenet
- GPTCloneBench: https://github.com/iamgiel/GPTCloneBench