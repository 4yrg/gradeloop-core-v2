#!/usr/bin/env python3
"""
train_unixcoder.py
──────────────────
Unified training script for UniXcoder AI code detector with multi-dataset support.

Training Pipeline:
1. Load 4 datasets: AIGCodeSet, HumanVsAICode, DroidCollection, Zendoo
2. Train preliminary model (1 epoch) with dropout
3. Apply MC Dropout uncertainty filtering (remove top 7% uncertain human samples)
4. Train final model with DroidDetectLoss (CrossEntropy + Triplet)
5. Evaluate on AICD-bench Task 1

Usage:
    # Full training (all datasets)
    poetry run python train_unixcoder.py

    # Quick test (subset)
    poetry run python train_unixcoder.py --max_samples 1000 --epochs 1

    # Resume from checkpoint
    poetry run python train_unixcoder.py --resume_from models/checkpoint_epoch_1.pt
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import LinearLR, CosineAnnealingLR, SequentialLR
from torch.utils.data import DataLoader, Dataset, Subset
from tqdm import tqdm

# Local imports
from dataset_loaders import create_unified_dataset
from models import create_unixcoder_detector
from losses import create_droiddetect_loss
from preprocessing import process_code_for_unixcoder
from preprocessing.uncertainty_filter import apply_uncertainty_filtering, train_preliminary_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training configuration."""
    
    # Model
    model_name: str = "microsoft/unixcoder-base"
    num_classes: int = 2
    embedding_dim: int = 256
    dropout: float = 0.1
    max_length: int = 512
    
    # Datasets
    datasets_root: Path = field(default_factory=lambda: Path("../../datasets"))
    filter_languages: bool = True  # C, C#, Python, Java only
    
    # Training
    epochs: int = 3
    batch_size: int = 64
    learning_rate: float = 5e-5
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    gradient_accumulation_steps: int = 1
    max_grad_norm: float = 1.0
    
    # Loss
    loss_alpha: float = 0.1  # Triplet loss weight
    triplet_margin: float = 0.2
    
    # MC Dropout filtering
    apply_uncertainty_filtering: bool = True
    mc_dropout_samples: int = 20
    uncertainty_threshold_percentile: float = 93.0  # Top 7%
    preliminary_epochs: int = 1
    preliminary_max_steps: Optional[int] = 500  # Quick preliminary training
    
    # Data
    max_samples: Optional[int] = None  # Limit for testing
    num_workers: int = 4
    
    # Checkpointing
    output_dir: Path = field(default_factory=lambda: Path("models/unixcoder"))
    save_every_epoch: bool = True
    checkpoint_name: str = "unixcoder_detector"
    
    # Evaluation
    eval_batch_size: int = 32
    eval_every_steps: Optional[int] = None
    
    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    seed: int = 42


class CodeDataset(Dataset):
    """PyTorch Dataset wrapper for unified dataset with tokenization."""
    
    def __init__(
        self,
        samples: list,
        tokenizer,
        max_length: int = 512,
        include_ast: bool = True,
    ):
        self.samples = samples
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.include_ast = include_ast
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        
        # Process code to extract AST and docstring
        if self.include_ast:
            processed = process_code_for_unixcoder(
                code=sample.code,
                language=sample.language,
            )
            code = processed["code"]
            docstring = processed.get("docstring")
            ast_sequence = processed.get("ast_sequence")
        else:
            code = sample.code
            docstring = sample.docstring
            ast_sequence = None
        
        # Format for UniXcoder (handled by model's format_input)
        # For now, just return components and format in collate_fn
        return {
            "code": code,
            "docstring": docstring,
            "ast_sequence": ast_sequence,
            "label": sample.label,
            "language": sample.language,
        }


def collate_fn(batch, model):
    """Custom collate function to format multi-modal inputs."""
    # Format inputs for UniXcoder
    formatted_texts = []
    labels = []
    
    for item in batch:
        formatted = model.format_input(
            code=item["code"],
            docstring=item["docstring"],
            ast_sequence=item["ast_sequence"],
        )
        formatted_texts.append(formatted)
        labels.append(item["label"])
    
    # Tokenize
    inputs = model.tokenize(formatted_texts)
    
    return {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs["attention_mask"],
        "labels": torch.tensor(labels, dtype=torch.long),
    }


def set_seed(seed: int):
    """Set random seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def train_epoch(
    model: nn.Module,
    train_loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    loss_fn: nn.Module,
    device: torch.device,
    epoch: int,
    config: TrainingConfig,
):
    """Train for one epoch."""
    model.train()
    
    total_loss = 0.0
    total_ce_loss = 0.0
    total_triplet_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(train_loader, desc=f"Epoch {epoch}")
    
    for batch_idx, batch in enumerate(pbar):
        # Move to device
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["labels"].to(device)
        
        # Forward pass
        outputs = model(input_ids, attention_mask, return_embeddings=True)
        
        # Compute loss
        loss_dict = loss_fn(outputs["logits"], outputs["embeddings"], labels)
        loss = loss_dict["total_loss"]
        
        # Backward pass
        loss = loss / config.gradient_accumulation_steps
        loss.backward()
        
        if (batch_idx + 1) % config.gradient_accumulation_steps == 0:
            # Clip gradients
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.max_grad_norm)
            
            optimizer.step()
            optimizer.zero_grad()
        
        # Track metrics
        total_loss += loss_dict["total_loss"].item()
        total_ce_loss += loss_dict["ce_loss"].item()
        total_triplet_loss += loss_dict["triplet_loss"].item()
        
        predictions = torch.argmax(outputs["logits"], dim=-1)
        correct += (predictions == labels).sum().item()
        total += labels.size(0)
        
        # Update progress bar
        pbar.set_postfix({
            "loss": loss_dict["total_loss"].item(),
            "ce": loss_dict["ce_loss"].item(),
            "triplet": loss_dict["triplet_loss"].item(),
            "acc": correct / total * 100,
        })
    
    avg_loss = total_loss / len(train_loader)
    avg_ce_loss = total_ce_loss / len(train_loader)
    avg_triplet_loss = total_triplet_loss / len(train_loader)
    accuracy = correct / total * 100
    
    logger.info(
        f"Epoch {epoch} - "
        f"Loss: {avg_loss:.4f} (CE: {avg_ce_loss:.4f}, Triplet: {avg_triplet_loss:.4f}), "
        f"Accuracy: {accuracy:.2f}%"
    )
    
    return {
        "loss": avg_loss,
        "ce_loss": avg_ce_loss,
        "triplet_loss": avg_triplet_loss,
        "accuracy": accuracy,
    }


def evaluate(
    model: nn.Module,
    eval_loader: DataLoader,
    device: torch.device,
    desc: str = "Evaluation",
):
    """Evaluate model."""
    model.eval()
    
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for batch in tqdm(eval_loader, desc=desc):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)
            
            outputs = model(input_ids, attention_mask, return_embeddings=False)
            predictions = torch.argmax(outputs["logits"], dim=-1)
            
            correct += (predictions == labels).sum().item()
            total += labels.size(0)
            
            all_preds.extend(predictions.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    
    accuracy = correct / total * 100
    
    # Calculate additional metrics
    from sklearn.metrics import precision_recall_fscore_support, classification_report
    
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_labels, all_preds, average="weighted", zero_division=0
    )
    
    logger.info(f"{desc} - Accuracy: {accuracy:.2f}%, F1: {f1:.4f}")
    
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "predictions": all_preds,
        "labels": all_labels,
    }


def main(config: TrainingConfig):
    """Main training function."""
    # Set seed
    set_seed(config.seed)
    
    # Create output directory
    config.output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save config
    with open(config.output_dir / "config.json", "w") as f:
        json.dump(vars(config), f, indent=2, default=str)
    
    logger.info(f"Configuration:\n{json.dumps(vars(config), indent=2, default=str)}")
    
    # Device
    device = torch.device(config.device)
    logger.info(f"Using device: {device}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 1: Load datasets
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 1: Loading datasets")
    logger.info("=" * 80)
    
    train_dataset = create_unified_dataset(
        datasets_root=config.datasets_root,
        split="train",
        filter_languages=config.filter_languages,
    )
    
    # Limit samples for testing
    if config.max_samples:
        indices = list(range(min(config.max_samples, len(train_dataset))))
        train_dataset.samples = [train_dataset.samples[i] for i in indices]
        logger.info(f"Limited to {len(train_dataset)} samples for testing")
    
    logger.info(f"Loaded {len(train_dataset)} training samples")
    logger.info(f"Label distribution: {train_dataset.get_label_distribution()}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 2: Create model
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 2: Creating UniXcoder model")
    logger.info("=" * 80)
    
    model = create_unixcoder_detector(
        model_name=config.model_name,
        num_classes=config.num_classes,
        embedding_dim=config.embedding_dim,
        dropout=config.dropout,
        max_length=config.max_length,
        device=device,
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 3: MC Dropout uncertainty filtering (optional)
    # ─────────────────────────────────────────────────────────────────────────
    if config.apply_uncertainty_filtering:
        logger.info("=" * 80)
        logger.info("Step 3: MC Dropout uncertainty filtering")
        logger.info("=" * 80)
        
        # Create preliminary dataset
        preliminary_dataset = CodeDataset(
            samples=train_dataset.samples,
            tokenizer=model.tokenizer,
            max_length=config.max_length,
        )
        
        preliminary_loader = DataLoader(
            preliminary_dataset,
            batch_size=config.batch_size,
            shuffle=True,
            num_workers=config.num_workers,
            collate_fn=lambda batch: collate_fn(batch, model),
        )
        
        # Create preliminary optimizer and loss
        preliminary_optimizer = AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        preliminary_loss = nn.CrossEntropyLoss()
        
        # Train preliminary model
        logger.info("Training preliminary model for uncertainty estimation...")
        train_preliminary_model(
            model=model,
            train_loader=preliminary_loader,
            optimizer=preliminary_optimizer,
            loss_fn=preliminary_loss,
            device=device,
            max_steps=config.preliminary_max_steps,
        )
        
        # Apply filtering
        def tokenize_fn(samples):
            return collate_fn(samples, model)
        
        filtered_samples, kept_indices, filter_stats = apply_uncertainty_filtering(
            dataset=train_dataset.samples,
            model=model,
            device=device,
            batch_size=config.eval_batch_size,
            num_mc_samples=config.mc_dropout_samples,
            threshold_percentile=config.uncertainty_threshold_percentile,
            tokenize_fn=tokenize_fn,
            save_path=config.output_dir / "uncertainty_filtering_results.json",
        )
        
        # Update dataset
        train_dataset.samples = filtered_samples
        logger.info(f"Dataset after filtering: {len(train_dataset)} samples")
        
        # Re-initialize model for clean final training
        model = create_unixcoder_detector(
            model_name=config.model_name,
            num_classes=config.num_classes,
            embedding_dim=config.embedding_dim,
            dropout=config.dropout,
            max_length=config.max_length,
            device=device,
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 4: Create final training dataset and loaders
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 4: Creating data loaders")
    logger.info("=" * 80)
    
    train_pytorch_dataset = CodeDataset(
        samples=train_dataset.samples,
        tokenizer=model.tokenizer,
        max_length=config.max_length,
    )
    
    train_loader = DataLoader(
        train_pytorch_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.num_workers,
        collate_fn=lambda batch: collate_fn(batch, model),
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 5: Create optimizer, scheduler, and loss
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 5: Creating optimizer and loss function")
    logger.info("=" * 80)
    
    optimizer = AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
    
    # Calculate total steps
    total_steps = len(train_loader) * config.epochs
    warmup_steps = int(total_steps * config.warmup_ratio)
    
    # Linear warmup + cosine decay
    warmup_scheduler = LinearLR(
        optimizer,
        start_factor=0.1,
        end_factor=1.0,
        total_iters=warmup_steps,
    )
    
    cosine_scheduler = CosineAnnealingLR(
        optimizer,
        T_max=total_steps - warmup_steps,
        eta_min=1e-7,
    )
    
    scheduler = SequentialLR(
        optimizer,
        schedulers=[warmup_scheduler, cosine_scheduler],
        milestones=[warmup_steps],
    )
    
    # DroidDetect loss (CrossEntropy + Triplet)
    loss_fn = create_droiddetect_loss(
        num_classes=config.num_classes,
        alpha=config.loss_alpha,
        triplet_margin=config.triplet_margin,
        device=device,
    )
    
    logger.info(f"Total steps: {total_steps}, Warmup steps: {warmup_steps}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 6: Training loop
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 6: Training")
    logger.info("=" * 80)
    
    best_f1 = 0.0
    training_history = []
    
    for epoch in range(1, config.epochs + 1):
        # Train
        train_metrics = train_epoch(
            model=model,
            train_loader=train_loader,
            optimizer=optimizer,
            loss_fn=loss_fn,
            device=device,
            epoch=epoch,
            config=config,
        )
        
        training_history.append(train_metrics)
        
        # Save checkpoint
        if config.save_every_epoch:
            checkpoint_path = config.output_dir / f"{config.checkpoint_name}_epoch_{epoch}.pt"
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),
                "train_metrics": train_metrics,
            }, checkpoint_path)
            logger.info(f"Saved checkpoint to {checkpoint_path}")
        
        # Update scheduler
        for _ in range(len(train_loader)):
            scheduler.step()
    
    # Save final model
    final_model_path = config.output_dir / f"{config.checkpoint_name}_final.pt"
    torch.save({
        "model_state_dict": model.state_dict(),
        "config": vars(config),
        "training_history": training_history,
    }, final_model_path)
    logger.info(f"Saved final model to {final_model_path}")
    
    # Save training history
    with open(config.output_dir / "training_history.json", "w") as f:
        json.dump(training_history, f, indent=2)
    
    logger.info("Training complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train UniXcoder AI code detector")
    
    # Model
    parser.add_argument("--model_name", default="microsoft/unixcoder-base")
    parser.add_argument("--max_length", type=int, default=512)
    
    # Data
    parser.add_argument("--datasets_root", type=Path, default=Path("../../datasets"))
    parser.add_argument("--max_samples", type=int, default=None)
    
    # Training
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=64)
    parser.add_argument("--learning_rate", type=float, default=5e-5)
    parser.add_argument("--loss_alpha", type=float, default=0.1)
    
    # MC Dropout
    parser.add_argument("--no_uncertainty_filtering", action="store_true")
    parser.add_argument("--mc_dropout_samples", type=int, default=20)
    
    # Output
    parser.add_argument("--output_dir", type=Path, default=Path("models/unixcoder"))
    
    # Device
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--seed", type=int, default=42)
    
    args = parser.parse_args()
    
    # Create config
    config = TrainingConfig(
        model_name=args.model_name,
        max_length=args.max_length,
        datasets_root=args.datasets_root,
        max_samples=args.max_samples,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        loss_alpha=args.loss_alpha,
        apply_uncertainty_filtering=not args.no_uncertainty_filtering,
        mc_dropout_samples=args.mc_dropout_samples,
        output_dir=args.output_dir,
        device=args.device,
        seed=args.seed,
    )
    
    main(config)
