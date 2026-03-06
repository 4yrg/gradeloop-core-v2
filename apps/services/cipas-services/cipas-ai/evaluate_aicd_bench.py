#!/usr/bin/env python3
"""
evaluate_aicd_bench.py
──────────────────────
Evaluation script for AICD-bench Task 1 (Robust Binary Classification).

Features:
- Streaming evaluation on 2M+ samples
- Per-language metrics (C, C#, Python, Java)
- Out-of-distribution (OOD) analysis
- Confusion matrices and classification reports
- Comparison to DroidDetect baseline (target F1 ≥ 0.95)

Usage:
    # Evaluate on full AICD-bench
    poetry run python evaluate_aicd_bench.py --model_path models/unixcoder/unixcoder_detector_final.pt

    # Evaluate on subset (testing)
    poetry run python evaluate_aicd_bench.py --model_path models/unixcoder/unixcoder_detector_final.pt --max_samples 1000

    # Per-language evaluation
    poetry run python evaluate_aicd_bench.py --model_path models/unixcoder/unixcoder_detector_final.pt --per_language
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
import torch.nn as nn
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

# Local imports
from dataset_loaders import load_aicd_bench_dataset
from models import create_unixcoder_detector
from preprocessing import process_code_for_unixcoder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class AICDBenchDataset(Dataset):
    """PyTorch Dataset wrapper for AICD-bench."""
    
    def __init__(
        self,
        samples: List,
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
        
        # Process code
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
        
        return {
            "code": code,
            "docstring": docstring,
            "ast_sequence": ast_sequence,
            "label": sample.label,
            "language": sample.language,
            "source": getattr(sample, "source", "unknown"),
        }


def collate_fn(batch, model):
    """Custom collate function."""
    formatted_texts = []
    labels = []
    languages = []
    sources = []
    
    for item in batch:
        formatted = model.format_input(
            code=item["code"],
            docstring=item["docstring"],
            ast_sequence=item["ast_sequence"],
        )
        formatted_texts.append(formatted)
        labels.append(item["label"])
        languages.append(item["language"])
        sources.append(item["source"])
    
    inputs = model.tokenize(formatted_texts)
    
    return {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs["attention_mask"],
        "labels": torch.tensor(labels, dtype=torch.long),
        "languages": languages,
        "sources": sources,
    }


def evaluate_model(
    model: nn.Module,
    data_loader: DataLoader,
    device: torch.device,
    desc: str = "Evaluating",
) -> Dict:
    """Evaluate model and collect predictions."""
    model.eval()
    
    all_preds = []
    all_probs = []
    all_labels = []
    all_languages = []
    all_sources = []
    
    with torch.no_grad():
        for batch in tqdm(data_loader, desc=desc):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)
            
            # Forward pass
            outputs = model(input_ids, attention_mask, return_embeddings=False)
            logits = outputs["logits"]
            
            # Get predictions and probabilities
            probs = torch.softmax(logits, dim=-1)
            predictions = torch.argmax(logits, dim=-1)
            
            all_preds.extend(predictions.cpu().numpy())
            all_probs.extend(probs[:, 1].cpu().numpy())  # Probability of AI class
            all_labels.extend(labels.cpu().numpy())
            all_languages.extend(batch["languages"])
            all_sources.extend(batch["sources"])
    
    return {
        "predictions": np.array(all_preds),
        "probabilities": np.array(all_probs),
        "labels": np.array(all_labels),
        "languages": all_languages,
        "sources": all_sources,
    }


def compute_metrics(labels: np.ndarray, predictions: np.ndarray, probabilities: np.ndarray) -> Dict:
    """Compute comprehensive evaluation metrics."""
    # Basic metrics
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, predictions, average="weighted", zero_division=0
    )
    
    accuracy = (predictions == labels).mean() * 100
    
    # Per-class metrics
    precision_per_class, recall_per_class, f1_per_class, support = precision_recall_fscore_support(
        labels, predictions, average=None, zero_division=0
    )
    
    # ROC-AUC
    try:
        roc_auc = roc_auc_score(labels, probabilities)
    except Exception:
        roc_auc = None
    
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "per_class": {
            "human": {
                "precision": precision_per_class[0],
                "recall": recall_per_class[0],
                "f1": f1_per_class[0],
                "support": int(support[0]),
            },
            "ai": {
                "precision": precision_per_class[1],
                "recall": recall_per_class[1],
                "f1": f1_per_class[1],
                "support": int(support[1]),
            },
        },
    }


def compute_per_language_metrics(
    labels: np.ndarray,
    predictions: np.ndarray,
    probabilities: np.ndarray,
    languages: List[str],
) -> Dict:
    """Compute metrics per programming language."""
    unique_languages = sorted(set(languages))
    
    per_language = {}
    for lang in unique_languages:
        # Get indices for this language
        indices = [i for i, l in enumerate(languages) if l.lower() == lang.lower()]
        
        if not indices:
            continue
        
        lang_labels = labels[indices]
        lang_preds = predictions[indices]
        lang_probs = probabilities[indices]
        
        metrics = compute_metrics(lang_labels, lang_preds, lang_probs)
        per_language[lang] = metrics
    
    return per_language


def plot_confusion_matrix(
    labels: np.ndarray,
    predictions: np.ndarray,
    save_path: Path,
    title: str = "Confusion Matrix",
):
    """Plot and save confusion matrix."""
    cm = confusion_matrix(labels, predictions)
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Human", "AI"],
        yticklabels=["Human", "AI"],
    )
    plt.title(title)
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    
    logger.info(f"Saved confusion matrix to {save_path}")


def plot_roc_curve(
    labels: np.ndarray,
    probabilities: np.ndarray,
    save_path: Path,
    title: str = "ROC Curve",
):
    """Plot and save ROC curve."""
    fpr, tpr, _ = roc_curve(labels, probabilities)
    roc_auc = roc_auc_score(labels, probabilities)
    
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, label=f"AUC = {roc_auc:.4f}", linewidth=2)
    plt.plot([0, 1], [0, 1], "k--", label="Random")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(title)
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    
    logger.info(f"Saved ROC curve to {save_path}")


def main(args):
    """Main evaluation function."""
    # Device
    device = torch.device(args.device)
    logger.info(f"Using device: {device}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 1: Load model
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 1: Loading model")
    logger.info("=" * 80)
    
    # Load checkpoint
    checkpoint = torch.load(args.model_path, map_location=device)
    
    if "config" in checkpoint:
        config = checkpoint["config"]
        model_name = config.get("model_name", "microsoft/unixcoder-base")
        max_length = config.get("max_length", 512)
    else:
        model_name = "microsoft/unixcoder-base"
        max_length = 512
    
    # Create model
    model = create_unixcoder_detector(
        model_name=model_name,
        num_classes=2,
        embedding_dim=256,
        dropout=0.1,
        max_length=max_length,
        device=device,
    )
    
    # Load weights
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    
    logger.info(f"Loaded model from {args.model_path}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 2: Load AICD-bench dataset
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 2: Loading AICD-bench dataset")
    logger.info("=" * 80)
    
    aicd_dataset = load_aicd_bench_dataset(
        root_dir=args.aicd_bench_path,
        task="task1",
        split="test",
    )
    
    # Limit samples if specified
    if args.max_samples:
        aicd_dataset.samples = aicd_dataset.samples[:args.max_samples]
        logger.info(f"Limited to {len(aicd_dataset)} samples for testing")
    
    logger.info(f"Loaded {len(aicd_dataset)} samples from AICD-bench")
    
    # Filter languages if specified
    if args.filter_languages:
        target_languages = {"c", "c#", "python", "java"}
        filtered_samples = [
            s for s in aicd_dataset.samples
            if s.language.lower() in target_languages
        ]
        aicd_dataset.samples = filtered_samples
        logger.info(f"Filtered to {len(aicd_dataset)} samples (C, C#, Python, Java only)")
    
    # Create PyTorch dataset
    pytorch_dataset = AICDBenchDataset(
        samples=aicd_dataset.samples,
        tokenizer=model.tokenizer,
        max_length=max_length,
    )
    
    data_loader = DataLoader(
        pytorch_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        collate_fn=lambda batch: collate_fn(batch, model),
    )
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 3: Evaluate
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 3: Evaluating on AICD-bench")
    logger.info("=" * 80)
    
    results = evaluate_model(model, data_loader, device, desc="AICD-bench Evaluation")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 4: Compute metrics
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("=" * 80)
    logger.info("Step 4: Computing metrics")
    logger.info("=" * 80)
    
    # Overall metrics
    overall_metrics = compute_metrics(
        results["labels"],
        results["predictions"],
        results["probabilities"],
    )
    
    logger.info("\n" + "=" * 80)
    logger.info("OVERALL METRICS")
    logger.info("=" * 80)
    logger.info(f"Accuracy: {overall_metrics['accuracy']:.2f}%")
    logger.info(f"Precision: {overall_metrics['precision']:.4f}")
    logger.info(f"Recall: {overall_metrics['recall']:.4f}")
    logger.info(f"F1 Score: {overall_metrics['f1']:.4f}")
    if overall_metrics["roc_auc"]:
        logger.info(f"ROC-AUC: {overall_metrics['roc_auc']:.4f}")
    
    logger.info("\nPer-Class Metrics:")
    for class_name, metrics in overall_metrics["per_class"].items():
        logger.info(f"  {class_name.upper()}:")
        logger.info(f"    Precision: {metrics['precision']:.4f}")
        logger.info(f"    Recall: {metrics['recall']:.4f}")
        logger.info(f"    F1: {metrics['f1']:.4f}")
        logger.info(f"    Support: {metrics['support']}")
    
    # Per-language metrics
    if args.per_language:
        logger.info("\n" + "=" * 80)
        logger.info("PER-LANGUAGE METRICS")
        logger.info("=" * 80)
        
        per_language_metrics = compute_per_language_metrics(
            results["labels"],
            results["predictions"],
            results["probabilities"],
            results["languages"],
        )
        
        for lang, metrics in per_language_metrics.items():
            logger.info(f"\n{lang.upper()}:")
            logger.info(f"  Accuracy: {metrics['accuracy']:.2f}%")
            logger.info(f"  F1 Score: {metrics['f1']:.4f}")
            if metrics["roc_auc"]:
                logger.info(f"  ROC-AUC: {metrics['roc_auc']:.4f}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 5: Generate visualizations
    # ─────────────────────────────────────────────────────────────────────────
    if args.output_dir:
        logger.info("=" * 80)
        logger.info("Step 5: Generating visualizations")
        logger.info("=" * 80)
        
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Confusion matrix
        plot_confusion_matrix(
            results["labels"],
            results["predictions"],
            output_dir / "confusion_matrix.png",
            title="AICD-bench Confusion Matrix",
        )
        
        # ROC curve
        if overall_metrics["roc_auc"]:
            plot_roc_curve(
                results["labels"],
                results["probabilities"],
                output_dir / "roc_curve.png",
                title="AICD-bench ROC Curve",
            )
        
        # Per-language confusion matrices
        if args.per_language:
            for lang in set(results["languages"]):
                indices = [i for i, l in enumerate(results["languages"]) if l == lang]
                if indices:
                    plot_confusion_matrix(
                        results["labels"][indices],
                        results["predictions"][indices],
                        output_dir / f"confusion_matrix_{lang.lower()}.png",
                        title=f"{lang.upper()} Confusion Matrix",
                    )
        
        # Save results
        results_dict = {
            "overall_metrics": overall_metrics,
            "per_language_metrics": per_language_metrics if args.per_language else None,
            "model_path": str(args.model_path),
            "aicd_bench_path": str(args.aicd_bench_path),
            "num_samples": len(results["labels"]),
        }
        
        with open(output_dir / "evaluation_results.json", "w") as f:
            json.dump(results_dict, f, indent=2)
        
        logger.info(f"Saved results to {output_dir}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Step 6: Comparison to DroidDetect baseline
    # ─────────────────────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 80)
    logger.info("COMPARISON TO DROIDDETECT BASELINE")
    logger.info("=" * 80)
    
    droiddetect_baseline_f1 = 0.95  # Target from paper
    
    if overall_metrics["f1"] >= droiddetect_baseline_f1:
        logger.info(f"✓ F1 Score ({overall_metrics['f1']:.4f}) >= DroidDetect baseline ({droiddetect_baseline_f1:.2f})")
    else:
        logger.info(f"✗ F1 Score ({overall_metrics['f1']:.4f}) < DroidDetect baseline ({droiddetect_baseline_f1:.2f})")
        logger.info(f"  Gap: {(droiddetect_baseline_f1 - overall_metrics['f1']):.4f}")
    
    logger.info("=" * 80)
    logger.info("Evaluation complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate on AICD-bench Task 1")
    
    # Model
    parser.add_argument(
        "--model_path",
        type=Path,
        required=True,
        help="Path to trained model checkpoint",
    )
    
    # Data
    parser.add_argument(
        "--aicd_bench_path",
        type=Path,
        default=Path("../../datasets/aicd-bench"),
        help="Path to AICD-bench dataset",
    )
    
    parser.add_argument(
        "--filter_languages",
        action="store_true",
        help="Filter to C, C#, Python, Java only",
    )
    
    parser.add_argument(
        "--max_samples",
        type=int,
        default=None,
        help="Limit evaluation to N samples (for testing)",
    )
    
    # Evaluation
    parser.add_argument(
        "--batch_size",
        type=int,
        default=32,
        help="Evaluation batch size",
    )
    
    parser.add_argument(
        "--per_language",
        action="store_true",
        help="Compute per-language metrics",
    )
    
    # Output
    parser.add_argument(
        "--output_dir",
        type=Path,
        default=Path("evaluation_results"),
        help="Directory to save evaluation results",
    )
    
    # Device
    parser.add_argument(
        "--device",
        default="cuda" if torch.cuda.is_available() else "cpu",
        help="Device to use for evaluation",
    )
    
    parser.add_argument(
        "--num_workers",
        type=int,
        default=4,
        help="Number of data loader workers",
    )
    
    args = parser.parse_args()
    
    main(args)
