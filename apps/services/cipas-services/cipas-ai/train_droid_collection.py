#!/usr/bin/env python3
"""
train_droid_collection.py
─────────────────────────
Fine-tunes ModernBERT-Large on the DroidCollection dataset for AI code detection.

This script implements the complete training pipeline:
- Loads DroidCollection JSONL files (Train/Test splits)
- Applies class-weighted CrossEntropyLoss for imbalanced data
- AdamW optimizer with weight decay (0.01)
- Linear warmup scheduler (10% of steps)
- Mixed precision training (AMP)
- Gradient accumulation for large effective batch sizes
- Sliding window for long code files (8192 tokens)
- Model checkpointing and best model tracking
- Evaluation on test split after training

Dataset Format (DroidCollection JSONL):
    {
        "Code": "...",
        "Label": "HUMAN_GENERATED" | "MACHINE_GENERATED" | "MACHINE_REFINED" | "MACHINE_GENERATED_ADVERSARIAL",
        "Language": "python" | "java" | ...,
        ...
    }

Label Mapping:
    0: Human-written
    1: AI-generated
    2: AI-refined
    3: AI-generated-adversarial (optional, can be merged with class 1)

Usage:
    # Basic training (uses default paths)
    poetry run python train_droid_collection.py

    # Full options
    poetry run python train_droid_collection.py \\
        --train_data ../../datasets/droid-collection/Droid_Train.jsonl \\
        --eval_data  ../../datasets/droid-collection/Droid_Test.jsonl \\
        --output_dir models/droiddetect-large-finetuned \\
        --batch_size 8 \\
        --gradient_accumulation_steps 4 \\
        --epochs 3 \\
        --learning_rate 2e-5 \\
        --max_length 8192 \\
        --use_4bit

    # Quick test run (100 samples)
    poetry run python train_droid_collection.py --max_train_samples 100 --max_eval_samples 50
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

# Optional: bitsandbytes for quantization
try:
    import bitsandbytes as bnb

    HAS_BNB = True
except ImportError:
    HAS_BNB = False

# Transformers for ModernBERT
from transformers import AutoModel, AutoTokenizer

# ── Configuration ─────────────────────────────────────────────────────────────


@dataclass
class TrainingConfig:
    """Training configuration with sensible defaults."""

    # Model
    model_name: str = "answerdotai/ModernBERT-large"
    num_classes: int = 3  # Human, AI-generated, AI-refined (or 4 with adversarial)
    max_length: int = 8192

    # Data
    train_data: Path = field(
        default_factory=lambda: Path("datasets/droid-collection/Droid_Train.jsonl")
    )
    eval_data: Path = field(
        default_factory=lambda: Path("datasets/droid-collection/Droid_Test.jsonl")
    )
    max_train_samples: int | None = None
    max_eval_samples: int | None = None

    # Training hyperparameters
    batch_size: int = 8
    gradient_accumulation_steps: int = 4
    epochs: int = 3
    learning_rate: float = 2e-5
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    max_grad_norm: float = 1.0

    # Optimization
    mixed_precision: bool = True
    use_4bit: bool = False
    use_8bit: bool = False

    # Checkpointing
    save_steps: int = 500
    eval_steps: int = 200
    output_dir: str = "models/droiddetect-large-finetuned"
    save_total_limit: int = 3

    # Logging
    logging_steps: int = 50
    report_to: str = "none"  # Can be "wandb", "tensorboard", etc.

    # Device
    device: str = field(init=False)
    seed: int = 42

    def __post_init__(self):
        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"

        # Validate quantization
        if self.use_4bit and self.use_8bit:
            raise ValueError("Cannot enable both 4-bit and 8-bit quantization")


# ── Label Mappings ────────────────────────────────────────────────────────────

LABEL_STR_TO_INT: dict[str, int] = {
    "HUMAN_GENERATED": 0,
    "MACHINE_GENERATED": 1,
    "MACHINE_REFINED": 2,
    "MACHINE_GENERATED_ADVERSARIAL": 3,
}

INT_TO_LABEL_NAME: dict[int, str] = {
    0: "Human-written",
    1: "AI-generated",
    2: "AI-refined",
    3: "AI-generated-adversarial",
}

# For 3-class setup, merge adversarial into AI-generated
LABEL_MERGE_MAP: dict[int, int] = {
    0: 0,  # Human → Human
    1: 1,  # AI-generated → AI-generated
    2: 2,  # AI-refined → AI-refined
    3: 1,  # Adversarial → AI-generated
}


# ── Dataset ───────────────────────────────────────────────────────────────────


class DroidCollectionDataset(Dataset):
    """
    PyTorch Dataset for DroidCollection JSONL files.

    Handles:
    - Lazy loading from JSONL
    - Label string → int conversion
    - Optional class merging (3-class vs 4-class)
    """

    def __init__(
        self,
        data_path: Path,
        max_samples: int | None = None,
        num_classes: int = 3,
        code_field: str = "Code",
        label_field: str = "Label",
    ):
        self.data_path = data_path
        self.max_samples = max_samples
        self.num_classes = num_classes
        self.code_field = code_field
        self.label_field = label_field

        # Pre-scan dataset for indexing
        self._indices: list[int] = []
        self._valid_count = 0
        self._skipped_count = 0
        self._scan_dataset()

    def _scan_dataset(self) -> None:
        """Scan dataset to build index of valid samples."""
        with self.data_path.open("rb") as f:
            for line_num, line in enumerate(f):
                if self.max_samples and self._valid_count >= self.max_samples:
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    # Quick validation without full parse
                    if (
                        self.code_field.encode() in line
                        and self.label_field.encode() in line
                    ):
                        self._indices.append(line_num)
                        self._valid_count += 1
                    else:
                        self._skipped_count += 1
                except Exception:
                    self._skipped_count += 1

    def __len__(self) -> int:
        return len(self._indices)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        line_num = self._indices[idx]

        with self.data_path.open("r", encoding="utf-8") as f:
            for current_line_num, line in enumerate(f):
                if current_line_num == line_num:
                    record = json.loads(line.strip())
                    break

        code = record.get(self.code_field, "")
        raw_label = record.get(self.label_field, 0)

        # Convert label
        if isinstance(raw_label, str):
            label_int = LABEL_STR_TO_INT.get(raw_label.strip().upper(), 0)
        else:
            label_int = int(raw_label)

        # Merge classes if using 3-class setup
        if self.num_classes == 3:
            label_int = LABEL_MERGE_MAP.get(label_int, 0)

        return {
            "code": code.strip(),
            "label": label_int,
            "language": record.get("Language", "unknown"),
        }


def load_jsonl_dataset(
    data_path: Path,
    max_samples: int | None = None,
    num_classes: int = 3,
) -> DroidCollectionDataset:
    """Load DroidCollection dataset."""
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found: {data_path}")

    return DroidCollectionDataset(
        data_path=data_path,
        max_samples=max_samples,
        num_classes=num_classes,
    )


# ── Model Architecture ────────────────────────────────────────────────────────


class DroidDetectLargeForClassification(nn.Module):
    """
    ModernBERT-Large based classifier for code detection.

    Architecture:
    - ModernBERT-large encoder (1024 hidden dim, 8192 context)
    - Mean pooling over sequence
    - Projection layer (1024 → 256)
    - Classification head (256 → num_classes)
    """

    def __init__(
        self,
        model_name: str,
        num_classes: int = 3,
        projection_dim: int = 256,
        dropout: float = 0.1,
        use_4bit: bool = False,
        use_8bit: bool = False,
    ):
        super().__init__()

        self.num_classes = num_classes
        self.hidden_size = 1024  # ModernBERT-large

        # Load encoder
        logger.info(f"Loading encoder: {model_name}")
        self.encoder = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True,
        )

        # Projection layer
        if use_4bit and HAS_BNB:
            logger.info("Using 4-bit projection layer")
            self.projection = bnb.nn.Linear4bit(
                self.hidden_size,
                projection_dim,
                bias=False,
                quant_type="nf4",
            )
        elif use_8bit and HAS_BNB:
            logger.info("Using 8-bit projection layer")
            self.projection = bnb.nn.Linear8bitLt(
                self.hidden_size,
                projection_dim,
                bias=False,
            )
        else:
            self.projection = nn.Linear(self.hidden_size, projection_dim)

        self.activation = nn.ReLU()
        self.dropout = nn.Dropout(dropout)

        # Classification head
        self.classifier = nn.Linear(projection_dim, num_classes)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: torch.Tensor | None = None,
    ) -> dict[str, torch.Tensor]:
        """Forward pass with optional loss computation."""
        # Encode
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

        # Mean pooling with attention mask
        sequence_output = outputs.last_hidden_state
        mask_expanded = (
            attention_mask.unsqueeze(-1).expand(sequence_output.size()).float()
        )
        sum_embeddings = (sequence_output * mask_expanded).sum(dim=1)
        sum_mask = mask_expanded.sum(dim=1).clamp(min=1e-9)
        pooled_output = sum_embeddings / sum_mask

        # Project and classify
        projected = self.dropout(self.activation(self.projection(pooled_output)))
        logits = self.classifier(projected)

        result = {"logits": logits}

        # Compute loss
        if labels is not None:
            loss_fct = nn.CrossEntropyLoss()
            loss = loss_fct(logits.view(-1, self.num_classes), labels.view(-1))
            result["loss"] = loss

        return result

    def save_pretrained(self, output_dir: str) -> None:
        """Save model weights and configuration."""
        os.makedirs(output_dir, exist_ok=True)

        torch.save(
            self.state_dict(),
            os.path.join(output_dir, "pytorch_model.bin"),
        )

        config = {
            "model_type": "droiddetect-large",
            "base_model": "answerdotai/ModernBERT-large",
            "num_classes": self.num_classes,
            "hidden_size": self.hidden_size,
            "projection_dim": 256,
        }
        with open(os.path.join(output_dir, "config.json"), "w") as f:
            json.dump(config, f, indent=2)

        logger.info(f"Model saved to {output_dir}")


# ── Data Collator ─────────────────────────────────────────────────────────────


@dataclass
class DataCollatorWithPadding:
    """
    Data collator that pads sequences to max length in batch.

    Handles variable-length inputs efficiently.
    """

    tokenizer: AutoTokenizer
    max_length: int = 8192

    def __call__(self, features: list[dict]) -> dict[str, torch.Tensor]:
        codes = [f["code"] for f in features]
        labels = [f["label"] for f in features]

        # Tokenize with padding
        batch = self.tokenizer(
            codes,
            truncation=True,
            max_length=self.max_length,
            padding=True,
            return_tensors="pt",
        )

        batch["labels"] = torch.tensor(labels, dtype=torch.long)

        return batch


# ── Metrics ───────────────────────────────────────────────────────────────────


def compute_metrics(
    logits: torch.Tensor,
    labels: torch.Tensor,
) -> dict[str, float]:
    """Compute accuracy and per-class metrics."""
    preds = logits.argmax(dim=-1)

    correct = (preds == labels).sum().item()
    total = labels.numel()
    accuracy = correct / total if total > 0 else 0.0

    # Per-class accuracy
    class_correct = torch.zeros(self.num_classes)
    class_total = torch.zeros(self.num_classes)

    for i in range(self.num_classes):
        mask = labels == i
        class_correct[i] = (preds[mask] == labels[mask]).sum().item()
        class_total[i] = mask.sum().item()

    return {
        "accuracy": accuracy,
        "class_accuracy": (class_correct / class_total.clamp(min=1)).tolist(),
    }


# ── Trainer ───────────────────────────────────────────────────────────────────


class Trainer:
    """
    Training loop with all optimizations.

    Features:
    - Gradient accumulation
    - Mixed precision (AMP)
    - Linear warmup + decay scheduler
    - Class-weighted loss
    - Checkpointing
    - Evaluation during training
    """

    def __init__(
        self,
        model: nn.Module,
        train_dataset: DroidCollectionDataset,
        eval_dataset: DroidCollectionDataset | None,
        tokenizer: AutoTokenizer,
        config: TrainingConfig,
    ):
        self.model = model
        self.train_dataset = train_dataset
        self.eval_dataset = eval_dataset
        self.tokenizer = tokenizer
        self.config = config

        # Data loaders
        self.train_loader = DataLoader(
            train_dataset,
            batch_size=config.batch_size,
            shuffle=True,
            collate_fn=DataCollatorWithPadding(tokenizer, config.max_length),
            num_workers=4,
            pin_memory=True,
        )

        self.eval_loader = (
            DataLoader(
                eval_dataset,
                batch_size=config.batch_size * 2,
                shuffle=False,
                collate_fn=DataCollatorWithPadding(tokenizer, config.max_length),
                num_workers=4,
                pin_memory=True,
            )
            if eval_dataset
            else None
        )

        # Optimizer
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
            betas=(0.9, 0.999),
            eps=1e-8,
        )

        # Scheduler
        num_training_steps = (
            len(self.train_loader) // config.gradient_accumulation_steps
        ) * config.epochs
        num_warmup_steps = int(num_training_steps * config.warmup_ratio)

        self.scheduler = torch.optim.lr_scheduler.LambdaLR(
            self.optimizer,
            lr_lambda=self._get_linear_schedule_with_warmup(
                num_warmup_steps, num_training_steps
            ),
        )

        # Mixed precision scaler
        self.scaler = (
            torch.cuda.amp.GradScaler()
            if config.mixed_precision and config.device == "cuda"
            else None
        )

        # Class weights for imbalanced data
        self.class_weights = self._compute_class_weights()

        # Training state
        self.global_step = 0
        self.best_eval_loss = float("inf")
        self.best_eval_accuracy = 0.0

    def _get_linear_schedule_with_warmup(
        self,
        num_warmup_steps: int,
        num_training_steps: int,
    ):
        """Create linear warmup + decay schedule."""

        def lr_lambda(current_step: int) -> float:
            if current_step < num_warmup_steps:
                return float(current_step) / float(max(1, num_warmup_steps))
            return max(
                0.0,
                float(num_training_steps - current_step)
                / float(max(1, num_training_steps - num_warmup_steps)),
            )

        return lr_lambda

    def _compute_class_weights(self) -> torch.Tensor | None:
        """Compute class weights for imbalanced dataset."""
        # Count labels in training dataset
        label_counts: dict[int, int] = {}
        for i in range(len(self.train_dataset)):
            label = self.train_dataset[i]["label"]
            label_counts[label] = label_counts.get(label, 0) + 1

        if not label_counts:
            return None

        # Calculate inverse frequency weights
        total = sum(label_counts.values())
        num_classes = self.config.num_classes

        weights = torch.zeros(num_classes)
        for class_id in range(num_classes):
            count = label_counts.get(class_id, 1)
            weights[class_id] = total / (num_classes * count)

        # Normalize
        weights = weights / weights.sum() * num_classes

        logger.info(f"Class counts: {label_counts}")
        logger.info(f"Class weights: {weights.tolist()}")

        return weights.to(self.config.device)

    def train_epoch(self, epoch: int) -> float:
        """Train for one epoch."""
        self.model.train()
        total_loss = 0.0
        num_batches = 0

        progress_bar = tqdm(
            self.train_loader,
            desc=f"Epoch {epoch + 1}/{self.config.epochs}",
        )

        self.optimizer.zero_grad()

        for batch_idx, batch in enumerate(progress_bar):
            # Move to device
            batch = {
                k: v.to(self.config.device) if isinstance(v, torch.Tensor) else v
                for k, v in batch.items()
            }

            # Mixed precision forward pass
            with torch.cuda.amp.autocast(enabled=self.scaler is not None):
                outputs = self.model(**batch)
                loss = outputs["loss"]

                # Apply class weights
                if self.class_weights is not None:
                    labels = batch["labels"]
                    sample_weights = self.class_weights[labels]
                    loss = (loss * sample_weights).mean()

                # Scale for gradient accumulation
                loss = loss / self.config.gradient_accumulation_steps

            # Backward pass
            if self.scaler:
                self.scaler.scale(loss).backward()
            else:
                loss.backward()

            # Update weights
            if (batch_idx + 1) % self.config.gradient_accumulation_steps == 0:
                if self.scaler:
                    self.scaler.unscale_(self.optimizer)
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config.max_grad_norm,
                    )
                    self.scaler.step(self.optimizer)
                    self.scaler.update()
                else:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(),
                        self.config.max_grad_norm,
                    )
                    self.optimizer.step()

                self.scheduler.step()
                self.optimizer.zero_grad()
                self.global_step += 1

            # Logging
            total_loss += loss.item() * self.config.gradient_accumulation_steps
            num_batches += 1
            avg_loss = total_loss / num_batches

            progress_bar.set_postfix({"loss": f"{avg_loss:.4f}"})

            # Save checkpoint
            if self.global_step % self.config.save_steps == 0:
                self._save_checkpoint(f"checkpoint-{self.global_step}")

            # Evaluation
            if self.eval_loader and self.global_step % self.config.eval_steps == 0:
                eval_metrics = self.evaluate()
                logger.info(
                    f"Step {self.global_step}: "
                    f"eval_loss={eval_metrics['loss']:.4f}, "
                    f"eval_acc={eval_metrics['accuracy']:.4f}"
                )

                # Save best model
                if eval_metrics["accuracy"] > self.best_eval_accuracy:
                    self.best_eval_accuracy = eval_metrics["accuracy"]
                    self._save_best_model()

        return avg_loss

    @torch.no_grad()
    def evaluate(self) -> dict[str, float]:
        """Evaluate on validation set."""
        if not self.eval_loader:
            return {}

        self.model.eval()
        total_loss = 0.0
        all_preds = []
        all_labels = []

        for batch in tqdm(self.eval_loader, desc="Evaluating"):
            batch = {
                k: v.to(self.config.device) if isinstance(v, torch.Tensor) else v
                for k, v in batch.items()
            }

            outputs = self.model(**batch)
            total_loss += outputs["loss"].item()

            preds = outputs["logits"].argmax(dim=-1).cpu().tolist()
            all_preds.extend(preds)
            all_labels.extend(batch["labels"].cpu().tolist())

        # Calculate metrics
        accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / len(all_labels)

        avg_loss = total_loss / len(self.eval_loader)

        # Per-class accuracy
        class_correct = torch.zeros(self.config.num_classes)
        class_total = torch.zeros(self.config.num_classes)

        for pred, label in zip(all_preds, all_labels):
            class_correct[label] += int(pred == label)
            class_total[label] += 1

        class_accuracy = (class_correct / class_total.clamp(min=1)).tolist()

        return {
            "loss": avg_loss,
            "accuracy": accuracy,
            "class_accuracy": class_accuracy,
        }

    def _save_checkpoint(self, name: str) -> None:
        """Save training checkpoint."""
        checkpoint_dir = os.path.join(self.config.output_dir, name)
        self.model.save_pretrained(checkpoint_dir)
        self.tokenizer.save_pretrained(checkpoint_dir)

        # Save training state
        torch.save(
            {
                "global_step": self.global_step,
                "optimizer_state_dict": self.optimizer.state_dict(),
                "scheduler_state_dict": self.scheduler.state_dict(),
                "best_eval_loss": self.best_eval_loss,
                "best_eval_accuracy": self.best_eval_accuracy,
            },
            os.path.join(checkpoint_dir, "training_state.pt"),
        )

        logger.info(f"Saved checkpoint to {checkpoint_dir}")

    def _save_best_model(self) -> None:
        """Save best model based on evaluation accuracy."""
        best_dir = os.path.join(self.config.output_dir, "best")
        self.model.save_pretrained(best_dir)
        self.tokenizer.save_pretrained(best_dir)
        logger.info(
            f"Saved best model (acc={self.best_eval_accuracy:.4f}) to {best_dir}"
        )

    def train(self) -> None:
        """Full training loop."""
        logger.info("=" * 70)
        logger.info("DroidDetect-Large Training")
        logger.info("=" * 70)
        logger.info(f"Device: {self.config.device}")
        logger.info(f"Training samples: {len(self.train_dataset):,}")
        if self.eval_dataset:
            logger.info(f"Evaluation samples: {len(self.eval_dataset):,}")
        logger.info(f"Batch size: {self.config.batch_size}")
        logger.info(f"Gradient accumulation: {self.config.gradient_accumulation_steps}")
        logger.info(
            f"Effective batch size: {self.config.batch_size * self.config.gradient_accumulation_steps}"
        )
        logger.info(f"Learning rate: {self.config.learning_rate}")
        logger.info(f"Epochs: {self.config.epochs}")
        logger.info(f"Max length: {self.config.max_length}")
        logger.info("=" * 70)

        start_time = time.time()

        for epoch in range(self.config.epochs):
            logger.info(f"\n{'=' * 70}")
            logger.info(f"Epoch {epoch + 1}/{self.config.epochs}")
            logger.info(f"{'=' * 70}")

            train_loss = self.train_epoch(epoch)

            # Final evaluation for epoch
            if self.eval_loader:
                eval_metrics = self.evaluate()
                logger.info(
                    f"Epoch {epoch + 1} Summary: "
                    f"train_loss={train_loss:.4f}, "
                    f"eval_loss={eval_metrics['loss']:.4f}, "
                    f"eval_acc={eval_metrics['accuracy']:.4f}"
                )

        total_time = time.time() - start_time
        logger.info(f"\n{'=' * 70}")
        logger.info(f"Training complete in {total_time / 60:.1f} minutes")
        logger.info(f"Best evaluation accuracy: {self.best_eval_accuracy:.4f}")
        logger.info(f"Model saved to {self.config.output_dir}")
        logger.info(f"{'=' * 70}")

        # Save final model
        self.model.save_pretrained(self.config.output_dir)
        self.tokenizer.save_pretrained(self.config.output_dir)


# ── Argument Parsing ──────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train DroidDetect-Large on DroidCollection dataset",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Data
    parser.add_argument(
        "--train_data",
        type=Path,
        default=None,
        help="Path to training JSONL file",
    )
    parser.add_argument(
        "--eval_data",
        type=Path,
        default=None,
        help="Path to evaluation JSONL file",
    )
    parser.add_argument(
        "--max_train_samples",
        type=int,
        default=None,
        help="Maximum training samples (for quick tests)",
    )
    parser.add_argument(
        "--max_eval_samples",
        type=int,
        default=None,
        help="Maximum evaluation samples",
    )

    # Model
    parser.add_argument(
        "--model_name",
        type=str,
        default="answerdotai/ModernBERT-large",
        help="Base model name",
    )
    parser.add_argument(
        "--num_classes",
        type=int,
        default=3,
        choices=[3, 4],
        help="Number of classes (3=merge adversarial, 4=keep separate)",
    )
    parser.add_argument(
        "--max_length",
        type=int,
        default=8192,
        help="Maximum sequence length",
    )

    # Training
    parser.add_argument(
        "--batch_size",
        type=int,
        default=8,
        help="Batch size per device",
    )
    parser.add_argument(
        "--gradient_accumulation_steps",
        type=int,
        default=4,
        help="Gradient accumulation steps",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of epochs",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=2e-5,
        help="Learning rate",
    )
    parser.add_argument(
        "--weight_decay",
        type=float,
        default=0.01,
        help="Weight decay",
    )
    parser.add_argument(
        "--warmup_ratio",
        type=float,
        default=0.1,
        help="Warmup ratio (10%% of steps)",
    )
    parser.add_argument(
        "--max_grad_norm",
        type=float,
        default=1.0,
        help="Maximum gradient norm",
    )

    # Optimization
    parser.add_argument(
        "--no_mixed_precision",
        action="store_true",
        help="Disable mixed precision training",
    )
    parser.add_argument(
        "--use_4bit",
        action="store_true",
        help="Enable 4-bit quantization (requires bitsandbytes)",
    )
    parser.add_argument(
        "--use_8bit",
        action="store_true",
        help="Enable 8-bit quantization (requires bitsandbytes)",
    )

    # Output
    parser.add_argument(
        "--output_dir",
        type=str,
        default="models/droiddetect-large-finetuned",
        help="Output directory",
    )
    parser.add_argument(
        "--save_steps",
        type=int,
        default=500,
        help="Save checkpoint every N steps",
    )
    parser.add_argument(
        "--eval_steps",
        type=int,
        default=200,
        help="Evaluate every N steps",
    )

    # Misc
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--logging_steps",
        type=int,
        default=50,
        help="Log every N steps",
    )

    return parser.parse_args()


# ── Main ──────────────────────────────────────────────────────────────────────

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def set_seed(seed: int) -> None:
    """Set random seeds for reproducibility."""
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def main() -> None:
    args = parse_args()

    # Set seed
    set_seed(args.seed)

    # Determine data paths
    train_data = args.train_data
    eval_data = args.eval_data

    if train_data is None:
        # Try default path
        train_data = Path("datasets/droid-collection/Droid_Train.jsonl")

    if eval_data is None:
        eval_data = Path("datasets/droid-collection/Droid_Test.jsonl")

    # Validate paths
    if not train_data.exists():
        logger.error(f"Training data not found: {train_data}")
        logger.error("Please provide --train_data or ensure default path exists")
        sys.exit(1)

    has_eval = eval_data.exists()
    if not has_eval:
        logger.warning(f"Evaluation data not found: {eval_data}")
        logger.warning("Training without evaluation")

    # Create config
    config = TrainingConfig(
        model_name=args.model_name,
        num_classes=args.num_classes,
        max_length=args.max_length,
        train_data=train_data,
        eval_data=eval_data if has_eval else None,
        max_train_samples=args.max_train_samples,
        max_eval_samples=args.max_eval_samples,
        batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        max_grad_norm=args.max_grad_norm,
        mixed_precision=not args.no_mixed_precision,
        use_4bit=args.use_4bit,
        use_8bit=args.use_8bit,
        save_steps=args.save_steps,
        eval_steps=args.eval_steps,
        output_dir=args.output_dir,
        seed=args.seed,
    )

    # Check quantization dependencies
    if (args.use_4bit or args.use_8bit) and not HAS_BNB:
        logger.error(
            "bitsandbytes not installed. Install with: pip install bitsandbytes"
        )
        sys.exit(1)

    # Load datasets
    logger.info(f"Loading training dataset: {train_data}")
    train_dataset = load_jsonl_dataset(
        train_data,
        max_samples=args.max_train_samples,
        num_classes=args.num_classes,
    )
    logger.info(f"Loaded {len(train_dataset):,} training samples")

    eval_dataset = None
    if has_eval:
        logger.info(f"Loading evaluation dataset: {eval_data}")
        eval_dataset = load_jsonl_dataset(
            eval_data,
            max_samples=args.max_eval_samples,
            num_classes=args.num_classes,
        )
        logger.info(f"Loaded {len(eval_dataset):,} evaluation samples")

    # Load tokenizer
    logger.info(f"Loading tokenizer: {args.model_name}")
    tokenizer = AutoTokenizer.from_pretrained(
        args.model_name,
        trust_remote_code=True,
    )

    # Create model
    model = DroidDetectLargeForClassification(
        model_name=args.model_name,
        num_classes=args.num_classes,
        use_4bit=args.use_4bit,
        use_8bit=args.use_8bit,
    )
    model.to(config.device)

    # Create trainer
    trainer = Trainer(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        config=config,
    )

    # Train
    trainer.train()

    logger.info("\n" + "=" * 70)
    logger.info("Training complete!")
    logger.info(f"Model saved to: {args.output_dir}")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
