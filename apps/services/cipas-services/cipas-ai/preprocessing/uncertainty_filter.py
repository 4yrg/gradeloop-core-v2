#!/usr/bin/env python3
"""
uncertainty_filter.py
─────────────────────
MC Dropout-based uncertainty filtering for noisy label detection.

Implements DroidDetect's uncertainty-based resampling strategy:
1. Train preliminary model with dropout enabled (1 epoch)
2. Run MC Dropout inference on human-labeled samples (20 forward passes)
3. Calculate prediction variance/uncertainty
4. Remove top 7% most uncertain samples

This addresses potential label noise in datasets where some "human-written"
code may have been generated with AI assistance (post-2021 GitHub data).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
from tqdm import tqdm

logger = logging.getLogger(__name__)


class UncertaintyFilter:
    """Filter noisy labels using MC Dropout uncertainty estimation."""
    
    def __init__(
        self,
        model: torch.nn.Module,
        device: torch.device,
        num_samples: int = 20,
        threshold_percentile: float = 93.0,
    ):
        """Initialize uncertainty filter.
        
        Args:
            model: UniXcoder detector model with dropout
            device: Device to run inference on
            num_samples: Number of MC Dropout forward passes
            threshold_percentile: Percentile threshold for filtering (93 = top 7%)
        """
        self.model = model
        self.device = device
        self.num_samples = num_samples
        self.threshold_percentile = threshold_percentile
        
        logger.info(
            f"Initialized UncertaintyFilter "
            f"(samples={num_samples}, threshold={threshold_percentile}%)"
        )
    
    def estimate_uncertainty(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> Tuple[float, np.ndarray]:
        """Estimate uncertainty for a single batch using MC Dropout.
        
        Args:
            input_ids: Token IDs [batch_size, seq_len]
            attention_mask: Attention mask [batch_size, seq_len]
        
        Returns:
            Tuple of (uncertainty_score, mean_probabilities)
        """
        # Enable dropout for MC sampling
        self.model.train()
        
        all_probabilities = []
        
        with torch.no_grad():
            for _ in range(self.num_samples):
                outputs = self.model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    return_embeddings=False,
                )
                logits = outputs["logits"]
                probs = torch.softmax(logits, dim=-1)
                all_probabilities.append(probs.cpu().numpy())
        
        # Stack: [num_samples, batch_size, num_classes]
        all_probabilities = np.stack(all_probabilities, axis=0)
        
        # Calculate mean and std
        mean_probs = np.mean(all_probabilities, axis=0)
        std_probs = np.std(all_probabilities, axis=0)
        
        # Uncertainty: mean standard deviation across classes
        uncertainty = np.mean(std_probs, axis=-1)
        
        return uncertainty, mean_probs
    
    def filter_dataset(
        self,
        dataset: List,
        batch_size: int = 32,
        tokenize_fn: callable = None,
        save_path: Optional[Path] = None,
    ) -> Tuple[List[int], List[int], dict]:
        """Filter dataset by identifying uncertain samples.
        
        Args:
            dataset: List of samples (must have 'label' attribute)
            batch_size: Batch size for inference
            tokenize_fn: Function to tokenize samples
            save_path: Optional path to save filtering results
        
        Returns:
            Tuple of (kept_indices, filtered_indices, statistics)
        """
        logger.info(f"Starting uncertainty-based filtering on {len(dataset)} samples")
        
        # Filter only human-labeled samples (label == 0)
        human_indices = [i for i, sample in enumerate(dataset) if sample.label == 0]
        logger.info(f"Found {len(human_indices)} human-labeled samples")
        
        if len(human_indices) == 0:
            logger.warning("No human-labeled samples found")
            return list(range(len(dataset))), [], {}
        
        # Calculate uncertainty for human samples
        uncertainties = []
        predictions = []
        
        self.model.eval()
        self.model.to(self.device)
        
        for i in tqdm(range(0, len(human_indices), batch_size), desc="MC Dropout inference"):
            batch_indices = human_indices[i:i + batch_size]
            batch_samples = [dataset[idx] for idx in batch_indices]
            
            # Tokenize batch
            if tokenize_fn:
                inputs = tokenize_fn(batch_samples)
            else:
                # Default: assume samples have .code attribute
                codes = [s.code for s in batch_samples]
                inputs = self.model.tokenize(codes)
            
            # Move to device
            input_ids = inputs["input_ids"].to(self.device)
            attention_mask = inputs["attention_mask"].to(self.device)
            
            # Estimate uncertainty
            batch_uncertainty, batch_probs = self.estimate_uncertainty(
                input_ids, attention_mask
            )
            
            uncertainties.extend(batch_uncertainty.tolist())
            predictions.extend(np.argmax(batch_probs, axis=-1).tolist())
        
        uncertainties = np.array(uncertainties)
        predictions = np.array(predictions)
        
        # Calculate threshold
        threshold = np.percentile(uncertainties, self.threshold_percentile)
        logger.info(f"Uncertainty threshold (p{self.threshold_percentile}): {threshold:.4f}")
        
        # Identify samples to filter
        filter_mask = uncertainties > threshold
        filtered_human_indices = [
            human_indices[i] for i in range(len(human_indices)) if filter_mask[i]
        ]
        
        # Keep all AI-generated samples + confident human samples
        ai_indices = [i for i, sample in enumerate(dataset) if sample.label != 0]
        kept_human_indices = [
            human_indices[i] for i in range(len(human_indices)) if not filter_mask[i]
        ]
        kept_indices = sorted(ai_indices + kept_human_indices)
        
        # Statistics
        stats = {
            "total_samples": len(dataset),
            "human_samples": len(human_indices),
            "ai_samples": len(ai_indices),
            "filtered_count": len(filtered_human_indices),
            "filtered_percentage": len(filtered_human_indices) / len(human_indices) * 100,
            "kept_count": len(kept_indices),
            "uncertainty_threshold": float(threshold),
            "mean_uncertainty": float(np.mean(uncertainties)),
            "std_uncertainty": float(np.std(uncertainties)),
            "min_uncertainty": float(np.min(uncertainties)),
            "max_uncertainty": float(np.max(uncertainties)),
        }
        
        logger.info(
            f"Filtered {len(filtered_human_indices)} samples "
            f"({stats['filtered_percentage']:.2f}% of human-labeled)"
        )
        logger.info(f"Keeping {len(kept_indices)} samples for training")
        
        # Save results
        if save_path:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            results = {
                "stats": stats,
                "kept_indices": kept_indices,
                "filtered_indices": filtered_human_indices,
                "uncertainties": uncertainties.tolist(),
                "predictions": predictions.tolist(),
            }
            with open(save_path, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"Saved filtering results to {save_path}")
        
        return kept_indices, filtered_human_indices, stats


def train_preliminary_model(
    model: torch.nn.Module,
    train_loader: torch.utils.data.DataLoader,
    optimizer: torch.optim.Optimizer,
    loss_fn: torch.nn.Module,
    device: torch.device,
    max_steps: Optional[int] = None,
) -> None:
    """Train preliminary model for 1 epoch (for uncertainty estimation).
    
    Args:
        model: UniXcoder detector model
        train_loader: Training data loader
        optimizer: Optimizer
        loss_fn: Loss function
        device: Device
        max_steps: Optional maximum steps (for quick training)
    """
    model.train()
    model.to(device)
    
    total_loss = 0.0
    num_batches = 0
    
    pbar = tqdm(train_loader, desc="Preliminary training")
    for batch_idx, batch in enumerate(pbar):
        if max_steps and batch_idx >= max_steps:
            break
        
        # Forward pass
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["labels"].to(device)
        
        outputs = model(input_ids, attention_mask, return_embeddings=True)
        
        # Compute loss
        if hasattr(loss_fn, 'forward'):
            # DroidDetectLoss
            loss_dict = loss_fn(outputs["logits"], outputs["embeddings"], labels)
            loss = loss_dict["total_loss"]
        else:
            # Simple CrossEntropy
            loss = loss_fn(outputs["logits"], labels)
        
        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        num_batches += 1
        
        # Update progress bar
        pbar.set_postfix({"loss": loss.item()})
    
    avg_loss = total_loss / num_batches if num_batches > 0 else 0
    logger.info(f"Preliminary training complete. Average loss: {avg_loss:.4f}")


def apply_uncertainty_filtering(
    dataset: List,
    model: torch.nn.Module,
    device: torch.device,
    batch_size: int = 32,
    num_mc_samples: int = 20,
    threshold_percentile: float = 93.0,
    tokenize_fn: callable = None,
    save_path: Optional[Path] = None,
) -> Tuple[List, List[int], dict]:
    """High-level function to apply uncertainty filtering.
    
    Args:
        dataset: Dataset to filter
        model: Trained preliminary model
        device: Device
        batch_size: Batch size for inference
        num_mc_samples: Number of MC Dropout samples
        threshold_percentile: Percentile threshold (93 = top 7%)
        tokenize_fn: Tokenization function
        save_path: Path to save results
    
    Returns:
        Tuple of (filtered_dataset, kept_indices, statistics)
    """
    filter_obj = UncertaintyFilter(
        model=model,
        device=device,
        num_samples=num_mc_samples,
        threshold_percentile=threshold_percentile,
    )
    
    kept_indices, filtered_indices, stats = filter_obj.filter_dataset(
        dataset=dataset,
        batch_size=batch_size,
        tokenize_fn=tokenize_fn,
        save_path=save_path,
    )
    
    # Create filtered dataset
    filtered_dataset = [dataset[i] for i in kept_indices]
    
    return filtered_dataset, kept_indices, stats


if __name__ == "__main__":
    # Test uncertainty filtering
    logging.basicConfig(level=logging.INFO)
    
    # Mock dataset and model for testing
    from dataclasses import dataclass
    
    @dataclass
    class MockSample:
        code: str
        label: int
    
    # Create mock dataset
    dataset = [
        MockSample(code=f"def func{i}(): pass", label=0 if i < 50 else 1)
        for i in range(100)
    ]
    
    print(f"Created mock dataset with {len(dataset)} samples")
    print(f"Human samples: {sum(1 for s in dataset if s.label == 0)}")
    print(f"AI samples: {sum(1 for s in dataset if s.label == 1)}")
    
    # Note: Actual filtering requires a trained model
    print("\nTo use uncertainty filtering:")
    print("1. Train preliminary model (1 epoch)")
    print("2. Call apply_uncertainty_filtering() with the model")
    print("3. Use filtered dataset for final training")
