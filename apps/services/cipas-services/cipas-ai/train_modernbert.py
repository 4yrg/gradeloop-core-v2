"""
Training Script for ModernBERT-Large / DroidDetect-Large.

Trains the Tier 2 model on the DroidCollection dataset or custom datasets.

Features:
- Loads JSONL datasets into HuggingFace Dataset
- Class-weighted CrossEntropyLoss for imbalanced data
- AdamW optimizer with weight decay (0.01)
- Linear warmup scheduler (10% of steps)
- Mixed precision training (AMP)
- Gradient accumulation for large batches
- Model checkpointing

Usage:
    python train_modernbert.py \
        --train_data datasets/droid_collection_train.jsonl \
        --eval_data datasets/droid_collection_eval.jsonl \
        --output_dir models/droiddetect-large-finetuned \
        --batch_size 16 \
        --epochs 3 \
        --learning_rate 2e-5
"""

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from datasets import Dataset, DatasetDict
from huggingface_hub import HfApi
from torch.utils.data import DataLoader
from tqdm import tqdm
from transformers import (
    AutoModel,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================


@dataclass
class TrainingConfig:
    """Training configuration."""

    # Model
    model_name: str = "answerdotai/ModernBERT-large"
    num_classes: int = 3  # Human, AI-generated, AI-refined
    max_length: int = 8192

    # Training
    batch_size: int = 8
    gradient_accumulation_steps: int = 2
    epochs: int = 3
    learning_rate: float = 2e-5
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1

    # Optimization
    mixed_precision: bool = True
    gradient_clip: float = 1.0

    # Checkpointing
    save_steps: int = 500
    output_dir: str = "models/droiddetect-large-finetuned"

    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


# =============================================================================
# Model Architecture
# =============================================================================


class DroidDetectLargeForClassification(nn.Module):
    """
    ModernBERT-Large based classifier for code detection.

    Architecture:
    - ModernBERT-large encoder (1024 hidden dim)
    - Mean pooling
    - Projection layer (1024 -> 256)
    - Classification head (256 -> 3 classes)
    """

    def __init__(
        self,
        model_name: str,
        num_classes: int = 3,
        projection_dim: int = 256,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.num_classes = num_classes
        self.hidden_size = 1024  # ModernBERT-large hidden dimension

        # Load base encoder
        logger.info(f"Loading encoder: {model_name}")
        self.encoder = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True,
        )

        # Projection layer
        self.projection = nn.Sequential(
            nn.Linear(self.hidden_size, projection_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(projection_dim, num_classes),
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: Optional[torch.Tensor] = None,
    ) -> dict:
        """
        Forward pass.

        Args:
            input_ids: Token IDs (batch_size, seq_len)
            attention_mask: Attention mask (batch_size, seq_len)
            labels: Optional labels for loss computation

        Returns:
            Dictionary with logits and optional loss
        """
        # Encode
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

        # Mean pooling
        sequence_output = outputs.last_hidden_state
        pooled_output = (sequence_output * attention_mask.unsqueeze(-1)).sum(
            dim=1
        ) / attention_mask.sum(dim=1, keepdim=True)

        # Project and classify
        projected = self.projection(pooled_output)
        logits = self.classifier(projected)

        result = {"logits": logits}

        # Compute loss if labels provided
        if labels is not None:
            loss_fct = nn.CrossEntropyLoss()
            loss = loss_fct(logits.view(-1, self.num_classes), labels.view(-1))
            result["loss"] = loss

        return result

    def save_pretrained(self, output_dir: str) -> None:
        """Save model weights and configuration."""
        os.makedirs(output_dir, exist_ok=True)

        # Save model state dict
        torch.save(
            self.state_dict(),
            os.path.join(output_dir, "pytorch_model.bin"),
        )

        # Save config
        config = {
            "model_type": "droiddetect-large",
            "num_classes": self.num_classes,
            "hidden_size": self.hidden_size,
            "projection_dim": 256,
        }
        with open(os.path.join(output_dir, "config.json"), "w") as f:
            json.dump(config, f, indent=2)

        logger.info(f"Model saved to {output_dir}")


# =============================================================================
# Data Loading
# =============================================================================


def load_jsonl_dataset(file_path: str) -> Dataset:
    """
    Load a JSONL dataset for training.

    Expected format:
    {
        "code": "...",
        "label": 0,  # 0=Human, 1=AI-generated, 2=AI-refined
        "language": "python"
    }

    Args:
        file_path: Path to JSONL file

    Returns:
        HuggingFace Dataset
    """
    data = []

    logger.info(f"Loading dataset from {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        for line in tqdm(f, desc="Loading"):
            try:
                item = json.loads(line.strip())
                data.append(
                    {
                        "code": item.get("code", item.get("code_snippet", "")),
                        "label": item.get("label", item.get("class", 0)),
                        "language": item.get("language", "unknown"),
                    }
                )
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping invalid JSON line: {e}")

    logger.info(f"Loaded {len(data)} samples")
    return Dataset.from_list(data)


def compute_class_weights(dataset: Dataset) -> torch.Tensor:
    """
    Compute class weights for imbalanced datasets.

    Args:
        dataset: Dataset with 'label' column

    Returns:
        Tensor of class weights
    """
    labels = dataset["label"]
    class_counts = torch.bincount(torch.tensor(labels), minlength=3).float()

    # Inverse frequency weighting
    total = class_counts.sum()
    weights = total / (class_counts + 1e-6)

    # Normalize weights
    weights = weights / weights.sum() * len(weights)

    logger.info(f"Class counts: {class_counts.tolist()}")
    logger.info(f"Class weights: {weights.tolist()}")

    return weights


# =============================================================================
# Tokenization
# =============================================================================


def tokenize_function(
    examples: dict,
    tokenizer,
    max_length: int = 8192,
) -> dict:
    """
    Tokenize code examples.

    For long inputs, uses truncation with sliding window strategy.
    """
    return tokenizer(
        examples["code"],
        truncation=True,
        max_length=max_length,
        padding=False,  # Dynamic padding in collator
    )


class DataCollatorWithPadding:
    """Data collator that pads to max length in batch."""

    def __init__(self, tokenizer, max_length: int = 8192):
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __call__(self, features: list[dict]) -> dict:
        # Pad to max length in batch
        batch = self.tokenizer.pad(
            features,
            padding=True,
            max_length=None,
            return_tensors="pt",
        )

        # Add labels if present
        if "label" in features[0]:
            batch["labels"] = torch.tensor([f["label"] for f in features])

        return batch


# =============================================================================
# Training Loop
# =============================================================================


class Trainer:
    """Training loop with gradient accumulation and mixed precision."""

    def __init__(
        self,
        model: nn.Module,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset],
        config: TrainingConfig,
    ):
        self.model = model
        self.train_dataset = train_dataset
        self.eval_dataset = eval_dataset
        self.config = config

        # Tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            config.model_name,
            trust_remote_code=True,
        )

        # Data loaders
        self.train_loader = self._create_train_loader()
        self.eval_loader = self._create_eval_loader() if eval_dataset else None

        # Optimizer
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )

        # Scheduler
        total_steps = (
            len(self.train_loader) // config.gradient_accumulation_steps
        ) * config.epochs
        warmup_steps = int(total_steps * config.warmup_ratio)

        self.scheduler = get_linear_schedule_with_warmup(
            self.optimizer,
            num_warmup_steps=warmup_steps,
            num_training_steps=total_steps,
        )

        # Mixed precision
        self.scaler = (
            torch.cuda.amp.GradScaler()
            if config.mixed_precision and config.device == "cuda"
            else None
        )

        # Class weights
        self.class_weights = compute_class_weights(train_dataset).to(config.device)

        # Training state
        self.global_step = 0
        self.best_eval_loss = float("inf")

    def _create_train_loader(self) -> DataLoader:
        """Create training data loader."""
        # Tokenize dataset
        tokenized_dataset = self.train_dataset.map(
            lambda x: tokenize_function(x, self.tokenizer, self.config.max_length),
            batched=True,
            remove_columns=["code", "language"],
        )

        return DataLoader(
            tokenized_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            collate_fn=DataCollatorWithPadding(self.tokenizer, self.config.max_length),
            num_workers=4,
            pin_memory=True,
        )

    def _create_eval_loader(self) -> DataLoader:
        """Create evaluation data loader."""
        tokenized_dataset = self.eval_dataset.map(
            lambda x: tokenize_function(x, self.tokenizer, self.config.max_length),
            batched=True,
            remove_columns=["code", "language"],
        )

        return DataLoader(
            tokenized_dataset,
            batch_size=self.config.batch_size * 2,
            shuffle=False,
            collate_fn=DataCollatorWithPadding(self.tokenizer, self.config.max_length),
            num_workers=4,
            pin_memory=True,
        )

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
                    loss = loss * self.class_weights[batch["labels"]].mean()

                # Scale loss for gradient accumulation
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
                        self.model.parameters(), self.config.gradient_clip
                    )
                    self.scaler.step(self.optimizer)
                    self.scaler.update()
                else:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(), self.config.gradient_clip
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
                self._save_checkpoint()

        return avg_loss

    @torch.no_grad()
    def evaluate(self) -> dict:
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

        # Calculate accuracy
        accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / len(all_labels)

        avg_loss = total_loss / len(self.eval_loader)

        return {
            "eval_loss": avg_loss,
            "eval_accuracy": accuracy,
        }

    def _save_checkpoint(self) -> None:
        """Save model checkpoint."""
        checkpoint_dir = os.path.join(
            self.config.output_dir, f"checkpoint-{self.global_step}"
        )
        self.model.save_pretrained(checkpoint_dir)
        self.tokenizer.save_pretrained(checkpoint_dir)
        logger.info(f"Saved checkpoint to {checkpoint_dir}")

    def train(self) -> None:
        """Full training loop."""
        logger.info("Starting training...")
        logger.info(f"Device: {self.config.device}")
        logger.info(f"Training samples: {len(self.train_dataset)}")
        if self.eval_dataset:
            logger.info(f"Evaluation samples: {len(self.eval_dataset)}")

        for epoch in range(self.config.epochs):
            # Train
            train_loss = self.train_epoch(epoch)

            # Evaluate
            metrics = self.evaluate()
            metrics["train_loss"] = train_loss

            logger.info(
                f"Epoch {epoch + 1}/{self.config.epochs} - "
                f"Train Loss: {train_loss:.4f}, "
                f"Eval Loss: {metrics.get('eval_loss', 'N/A'):.4f}, "
                f"Eval Accuracy: {metrics.get('eval_accuracy', 0):.4f}"
            )

            # Save best model
            if (
                self.eval_dataset
                and metrics.get("eval_loss", float("inf")) < self.best_eval_loss
            ):
                self.best_eval_loss = metrics["eval_loss"]
                self._save_best_model()

        # Save final model
        self.model.save_pretrained(self.config.output_dir)
        self.tokenizer.save_pretrained(self.config.output_dir)
        logger.info(f"Training complete. Model saved to {self.config.output_dir}")

    def _save_best_model(self) -> None:
        """Save best model based on evaluation loss."""
        best_dir = os.path.join(self.config.output_dir, "best")
        self.model.save_pretrained(best_dir)
        self.tokenizer.save_pretrained(best_dir)
        logger.info(f"Saved best model to {best_dir}")


# =============================================================================
# Main Entry Point
# =============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Train ModernBERT-Large for code detection"
    )

    # Data
    parser.add_argument(
        "--train_data",
        type=str,
        required=True,
        help="Path to training JSONL file",
    )
    parser.add_argument(
        "--eval_data",
        type=str,
        default=None,
        help="Path to evaluation JSONL file",
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
        help="Number of classification classes",
    )

    # Training
    parser.add_argument(
        "--batch_size",
        type=int,
        default=8,
        help="Batch size",
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
        help="Warmup ratio",
    )
    parser.add_argument(
        "--gradient_accumulation_steps",
        type=int,
        default=2,
        help="Gradient accumulation steps",
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

    # Optimization
    parser.add_argument(
        "--no_mixed_precision",
        action="store_true",
        help="Disable mixed precision training",
    )
    parser.add_argument(
        "--max_length",
        type=int,
        default=8192,
        help="Maximum sequence length",
    )

    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()

    # Create config
    config = TrainingConfig(
        model_name=args.model_name,
        num_classes=args.num_classes,
        batch_size=args.batch_size,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        save_steps=args.save_steps,
        output_dir=args.output_dir,
        max_length=args.max_length,
        mixed_precision=not args.no_mixed_precision,
    )

    # Load datasets
    train_dataset = load_jsonl_dataset(args.train_data)

    eval_dataset = None
    if args.eval_data:
        eval_dataset = load_jsonl_dataset(args.eval_data)

    # Create model
    model = DroidDetectLargeForClassification(
        model_name=config.model_name,
        num_classes=config.num_classes,
    )
    model.to(config.device)

    # Create trainer
    trainer = Trainer(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        config=config,
    )

    # Train
    trainer.train()

    # Upload to HuggingFace Hub (optional)
    if os.environ.get("HUGGING_FACE_TOKEN"):
        logger.info("Uploading model to HuggingFace Hub...")
        api = HfApi()
        api.upload_folder(
            folder_path=config.output_dir,
            repo_id="your-username/droiddetect-large-finetuned",
            repo_type="model",
        )


if __name__ == "__main__":
    main()
