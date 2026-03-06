#!/usr/bin/env python3
"""
multitask_loss.py
─────────────────
Multi-task loss function combining CrossEntropy and Triplet Loss.

Implements DroidDetect training objective:
    Total Loss = CrossEntropyLoss + α * TripletLoss

where α is a weight parameter (typically 0.1) to encourage the model
to push human and machine code embeddings further apart in vector space.

Uses Batch-Hard Triplet Mining for efficient training.
"""

from __future__ import annotations

import logging
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)


class BatchHardTripletLoss(nn.Module):
    """Batch-Hard Triplet Loss with online mining.
    
    For each anchor in the batch:
    - Select hardest positive (same class, most dissimilar)
    - Select hardest negative (different class, most similar)
    
    This encourages the model to create well-separated embedding spaces.
    """
    
    def __init__(self, margin: float = 0.2, squared: bool = False):
        """Initialize Batch-Hard Triplet Loss.
        
        Args:
            margin: Margin for triplet loss
            squared: Whether to use squared Euclidean distance
        """
        super().__init__()
        self.margin = margin
        self.squared = squared
        logger.info(f"Initialized Batch-Hard Triplet Loss (margin={margin}, squared={squared})")
    
    def _pairwise_distances(self, embeddings: torch.Tensor) -> torch.Tensor:
        """Compute pairwise distances between all embeddings.
        
        Args:
            embeddings: [batch_size, embedding_dim]
        
        Returns:
            Pairwise distance matrix [batch_size, batch_size]
        """
        # Compute dot product
        dot_product = torch.matmul(embeddings, embeddings.t())
        
        # Get squared L2 norms
        square_norm = torch.diag(dot_product)
        
        # Compute squared Euclidean distances
        # ||a - b||^2 = ||a||^2 - 2<a,b> + ||b||^2
        distances = square_norm.unsqueeze(0) - 2.0 * dot_product + square_norm.unsqueeze(1)
        distances = torch.clamp(distances, min=0.0)
        
        # For numerical stability
        if not self.squared:
            # Add small epsilon before sqrt
            mask = (distances == 0.0).float()
            distances = distances + mask * 1e-16
            distances = torch.sqrt(distances)
            # Correct the epsilon added
            distances = distances * (1.0 - mask)
        
        return distances
    
    def forward(self, embeddings: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        """Compute Batch-Hard Triplet Loss.
        
        Args:
            embeddings: L2-normalized embeddings [batch_size, embedding_dim]
            labels: Class labels [batch_size]
        
        Returns:
            Scalar triplet loss
        """
        # Compute pairwise distances
        pairwise_dist = self._pairwise_distances(embeddings)
        
        # Create masks for positive and negative pairs
        labels = labels.unsqueeze(1)
        positive_mask = (labels == labels.t()).float()
        negative_mask = (labels != labels.t()).float()
        
        # For each anchor, find hardest positive
        # Hardest positive = most dissimilar same-class sample
        # Mask out self-comparisons (distance = 0)
        positive_mask_no_self = positive_mask - torch.eye(
            positive_mask.size(0), device=positive_mask.device
        )
        
        # Get distances to positives (set non-positives to 0)
        anchor_positive_dist = pairwise_dist * positive_mask_no_self
        
        # Get hardest positive per anchor (max distance to positive)
        hardest_positive_dist, _ = torch.max(anchor_positive_dist, dim=1)
        
        # For each anchor, find hardest negative
        # Hardest negative = most similar different-class sample
        # Add large value to positive pairs to exclude them from min
        max_anchor_negative_dist = torch.max(pairwise_dist, dim=1, keepdim=True)[0]
        anchor_negative_dist = pairwise_dist + max_anchor_negative_dist * positive_mask
        
        # Get hardest negative per anchor (min distance to negative)
        hardest_negative_dist, _ = torch.min(anchor_negative_dist, dim=1)
        
        # Compute triplet loss
        # Loss = max(d(a,p) - d(a,n) + margin, 0)
        triplet_loss = F.relu(hardest_positive_dist - hardest_negative_dist + self.margin)
        
        # Average over batch (only count non-zero losses for stability)
        num_valid = (triplet_loss > 0).sum().float()
        if num_valid > 0:
            triplet_loss = triplet_loss.sum() / num_valid
        else:
            triplet_loss = triplet_loss.mean()
        
        return triplet_loss


class DroidDetectLoss(nn.Module):
    """Combined loss function for DroidDetect training.
    
    Combines:
    1. CrossEntropyLoss for classification
    2. Batch-Hard Triplet Loss for embedding space separation
    
    Total Loss = CrossEntropyLoss + α * TripletLoss
    """
    
    def __init__(
        self,
        num_classes: int = 2,
        alpha: float = 0.1,
        class_weights: Optional[torch.Tensor] = None,
        triplet_margin: float = 0.2,
        triplet_squared: bool = False,
    ):
        """Initialize DroidDetect multi-task loss.
        
        Args:
            num_classes: Number of classification classes
            alpha: Weight for triplet loss (typically 0.1)
            class_weights: Optional class weights for imbalanced data
            triplet_margin: Margin for triplet loss
            triplet_squared: Whether to use squared distance in triplet loss
        """
        super().__init__()
        
        self.num_classes = num_classes
        self.alpha = alpha
        
        # CrossEntropy for classification
        self.ce_loss = nn.CrossEntropyLoss(weight=class_weights)
        
        # Batch-Hard Triplet Loss for embeddings
        self.triplet_loss = BatchHardTripletLoss(
            margin=triplet_margin,
            squared=triplet_squared,
        )
        
        logger.info(
            f"Initialized DroidDetect Loss (alpha={alpha}, "
            f"margin={triplet_margin}, classes={num_classes})"
        )
    
    def forward(
        self,
        logits: torch.Tensor,
        embeddings: torch.Tensor,
        labels: torch.Tensor,
    ) -> dict:
        """Compute combined loss.
        
        Args:
            logits: Classification logits [batch_size, num_classes]
            embeddings: L2-normalized embeddings [batch_size, embedding_dim]
            labels: Ground truth labels [batch_size]
        
        Returns:
            Dictionary containing:
                - total_loss: Combined loss
                - ce_loss: CrossEntropy loss
                - triplet_loss: Triplet loss
        """
        # CrossEntropy loss
        ce_loss = self.ce_loss(logits, labels)
        
        # Triplet loss
        triplet_loss = self.triplet_loss(embeddings, labels)
        
        # Combined loss
        total_loss = ce_loss + self.alpha * triplet_loss
        
        return {
            "total_loss": total_loss,
            "ce_loss": ce_loss,
            "triplet_loss": triplet_loss,
        }


class FocalLoss(nn.Module):
    """Focal Loss for handling class imbalance (alternative to class weights).
    
    Can be used instead of CrossEntropy if dataset is heavily imbalanced.
    """
    
    def __init__(
        self,
        alpha: Optional[torch.Tensor] = None,
        gamma: float = 2.0,
        reduction: str = "mean",
    ):
        """Initialize Focal Loss.
        
        Args:
            alpha: Class weights [num_classes]
            gamma: Focusing parameter (default: 2.0)
            reduction: Reduction method ("mean" or "sum")
        """
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction
    
    def forward(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        """Compute Focal Loss.
        
        Args:
            logits: Model predictions [batch_size, num_classes]
            labels: Ground truth [batch_size]
        
        Returns:
            Focal loss
        """
        ce_loss = F.cross_entropy(logits, labels, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = (1 - pt) ** self.gamma * ce_loss
        
        if self.alpha is not None:
            alpha_t = self.alpha[labels]
            focal_loss = alpha_t * focal_loss
        
        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        else:
            return focal_loss


def create_droiddetect_loss(
    num_classes: int = 2,
    alpha: float = 0.1,
    class_weights: Optional[torch.Tensor] = None,
    triplet_margin: float = 0.2,
    device: Optional[torch.device] = None,
) -> DroidDetectLoss:
    """Factory function to create DroidDetect loss.
    
    Args:
        num_classes: Number of classes
        alpha: Weight for triplet loss
        class_weights: Optional class weights (will be moved to device)
        triplet_margin: Margin for triplet loss
        device: Device to move loss to
    
    Returns:
        DroidDetectLoss instance
    """
    if class_weights is not None and device is not None:
        class_weights = class_weights.to(device)
    
    loss_fn = DroidDetectLoss(
        num_classes=num_classes,
        alpha=alpha,
        class_weights=class_weights,
        triplet_margin=triplet_margin,
    )
    
    if device:
        loss_fn = loss_fn.to(device)
    
    return loss_fn


if __name__ == "__main__":
    # Test loss functions
    logging.basicConfig(level=logging.INFO)
    
    batch_size = 8
    num_classes = 2
    embedding_dim = 256
    
    # Create dummy data
    logits = torch.randn(batch_size, num_classes)
    embeddings = F.normalize(torch.randn(batch_size, embedding_dim), p=2, dim=1)
    labels = torch.randint(0, num_classes, (batch_size,))
    
    print(f"Logits shape: {logits.shape}")
    print(f"Embeddings shape: {embeddings.shape}")
    print(f"Labels: {labels.tolist()}")
    
    # Create loss function
    loss_fn = create_droiddetect_loss(
        num_classes=num_classes,
        alpha=0.1,
        triplet_margin=0.2,
    )
    
    # Compute loss
    loss_dict = loss_fn(logits, embeddings, labels)
    
    print(f"\nLoss breakdown:")
    print(f"  Total Loss: {loss_dict['total_loss'].item():.4f}")
    print(f"  CE Loss: {loss_dict['ce_loss'].item():.4f}")
    print(f"  Triplet Loss: {loss_dict['triplet_loss'].item():.4f}")
    print(f"  Triplet contribution: {(loss_dict['triplet_loss'].item() * 0.1):.4f}")
