#!/usr/bin/env python3
"""
unixcoder_detector.py
─────────────────────
UniXcoder-based AI code detector model with multi-modal input support.

Implements DroidDetect architecture:
- UniXcoder-base (microsoft/unixcoder-base) as backbone with [Enc] mode
- Multi-modal input: [Enc] + docstring + raw_code + flattened_AST
- Binary classification head (human vs. AI-generated)
- Embedding projection layer for triplet loss
- Dropout for MC Dropout-based uncertainty estimation
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer, PreTrainedModel

logger = logging.getLogger(__name__)


class UniXcoderDetector(nn.Module):
    """UniXcoder-based AI code detector with multi-modal inputs."""
    
    ENC_TOKEN = "[Enc]"  # UniXcoder encoder-only mode prefix
    SEP_TOKEN = "<SEP>"  # Separator for multi-modal inputs
    
    def __init__(
        self,
        model_name: str = "microsoft/unixcoder-base",
        num_classes: int = 2,
        embedding_dim: int = 256,
        dropout: float = 0.1,
        max_length: int = 512,
    ):
        """Initialize UniXcoder detector.
        
        Args:
            model_name: UniXcoder model name (base or large)
            num_classes: Number of output classes (2 for binary)
            embedding_dim: Dimension for embedding projection (for triplet loss)
            dropout: Dropout rate for MC Dropout
            max_length: Maximum sequence length
        """
        super().__init__()
        
        self.model_name = model_name
        self.num_classes = num_classes
        self.embedding_dim = embedding_dim
        self.max_length = max_length
        
        logger.info(f"Loading UniXcoder model: {model_name}")
        
        # Load UniXcoder backbone
        self.unixcoder = AutoModel.from_pretrained(model_name, trust_remote_code=True)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        
        # Get hidden size from model config
        self.hidden_size = self.unixcoder.config.hidden_size
        
        # Classification head
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(self.hidden_size, num_classes)
        
        # Embedding projection for triplet loss
        self.embedding_proj = nn.Sequential(
            nn.Linear(self.hidden_size, embedding_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(embedding_dim, embedding_dim),
        )
        
        logger.info(
            f"Model initialized: {model_name} "
            f"(hidden_size={self.hidden_size}, classes={num_classes})"
        )
    
    def format_input(
        self,
        code: str,
        docstring: Optional[str] = None,
        ast_sequence: Optional[str] = None,
    ) -> str:
        """Format multi-modal input for UniXcoder.
        
        Args:
            code: Raw source code
            docstring: Optional docstring/comment
            ast_sequence: Optional flattened AST sequence
        
        Returns:
            Formatted input string: [Enc] {docstring} <SEP> {code} <SEP> {ast}
        """
        parts = [self.ENC_TOKEN]
        
        if docstring:
            parts.append(docstring.strip())
            parts.append(self.SEP_TOKEN)
        
        parts.append(code.strip())
        
        if ast_sequence:
            parts.append(self.SEP_TOKEN)
            parts.append(ast_sequence.strip())
        
        return " ".join(parts)
    
    def tokenize(
        self,
        texts: list[str],
        padding: bool = True,
        truncation: bool = True,
        return_tensors: str = "pt",
    ) -> dict:
        """Tokenize input texts.
        
        Args:
            texts: List of formatted input strings
            padding: Whether to pad sequences
            truncation: Whether to truncate sequences
            return_tensors: Return PyTorch tensors
        
        Returns:
            Tokenized inputs (input_ids, attention_mask)
        """
        return self.tokenizer(
            texts,
            padding=padding,
            truncation=truncation,
            max_length=self.max_length,
            return_tensors=return_tensors,
        )
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        return_embeddings: bool = False,
    ) -> dict:
        """Forward pass through UniXcoder detector.
        
        Args:
            input_ids: Token IDs [batch_size, seq_len]
            attention_mask: Attention mask [batch_size, seq_len]
            return_embeddings: Whether to return projected embeddings for triplet loss
        
        Returns:
            Dictionary containing:
                - logits: Classification logits [batch_size, num_classes]
                - embeddings: Projected embeddings [batch_size, embedding_dim] (if return_embeddings=True)
                - hidden_states: Final hidden states [batch_size, hidden_size]
        """
        # Get UniXcoder outputs
        outputs = self.unixcoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_hidden_states=True,
        )
        
        # Use [CLS] token representation (first token)
        # For UniXcoder, this is the pooled representation
        if hasattr(outputs, 'pooler_output') and outputs.pooler_output is not None:
            hidden_states = outputs.pooler_output
        else:
            # Fallback: use [CLS] token from last hidden state
            hidden_states = outputs.last_hidden_state[:, 0, :]
        
        # Apply dropout
        hidden_states = self.dropout(hidden_states)
        
        # Classification logits
        logits = self.classifier(hidden_states)
        
        result = {
            "logits": logits,
            "hidden_states": hidden_states,
        }
        
        # Project embeddings for triplet loss (if requested)
        if return_embeddings:
            embeddings = self.embedding_proj(hidden_states)
            # L2 normalize embeddings for triplet loss
            embeddings = F.normalize(embeddings, p=2, dim=1)
            result["embeddings"] = embeddings
        
        return result
    
    def predict(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Make predictions (inference mode).
        
        Args:
            input_ids: Token IDs
            attention_mask: Attention mask
        
        Returns:
            Tuple of (predicted_labels, probabilities)
        """
        self.eval()
        with torch.no_grad():
            outputs = self.forward(input_ids, attention_mask, return_embeddings=False)
            logits = outputs["logits"]
            probabilities = F.softmax(logits, dim=-1)
            predicted_labels = torch.argmax(logits, dim=-1)
        
        return predicted_labels, probabilities
    
    def predict_with_uncertainty(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        num_samples: int = 20,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Make predictions with MC Dropout uncertainty estimation.
        
        Args:
            input_ids: Token IDs
            attention_mask: Attention mask
            num_samples: Number of forward passes for MC Dropout
        
        Returns:
            Tuple of (predicted_labels, mean_probabilities, uncertainty)
        """
        self.train()  # Enable dropout
        
        all_probabilities = []
        
        with torch.no_grad():
            for _ in range(num_samples):
                outputs = self.forward(input_ids, attention_mask, return_embeddings=False)
                logits = outputs["logits"]
                probabilities = F.softmax(logits, dim=-1)
                all_probabilities.append(probabilities)
        
        # Stack all samples [num_samples, batch_size, num_classes]
        all_probabilities = torch.stack(all_probabilities)
        
        # Calculate mean and std
        mean_probabilities = all_probabilities.mean(dim=0)
        std_probabilities = all_probabilities.std(dim=0)
        
        # Uncertainty: use entropy or variance
        uncertainty = std_probabilities.mean(dim=-1)  # Average std across classes
        
        predicted_labels = torch.argmax(mean_probabilities, dim=-1)
        
        return predicted_labels, mean_probabilities, uncertainty
    
    def get_num_parameters(self) -> int:
        """Get total number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)
    
    def freeze_backbone(self):
        """Freeze UniXcoder backbone (for fine-tuning only the head)."""
        for param in self.unixcoder.parameters():
            param.requires_grad = False
        logger.info("UniXcoder backbone frozen")
    
    def unfreeze_backbone(self):
        """Unfreeze UniXcoder backbone."""
        for param in self.unixcoder.parameters():
            param.requires_grad = True
        logger.info("UniXcoder backbone unfrozen")


def create_unixcoder_detector(
    model_name: str = "microsoft/unixcoder-base",
    num_classes: int = 2,
    embedding_dim: int = 256,
    dropout: float = 0.1,
    max_length: int = 512,
    device: Optional[torch.device] = None,
) -> UniXcoderDetector:
    """Factory function to create UniXcoder detector.
    
    Args:
        model_name: UniXcoder model name
        num_classes: Number of output classes
        embedding_dim: Embedding dimension for triplet loss
        dropout: Dropout rate
        max_length: Maximum sequence length
        device: Device to load model on
    
    Returns:
        UniXcoderDetector model
    """
    model = UniXcoderDetector(
        model_name=model_name,
        num_classes=num_classes,
        embedding_dim=embedding_dim,
        dropout=dropout,
        max_length=max_length,
    )
    
    if device:
        model = model.to(device)
    
    logger.info(f"Model has {model.get_num_parameters():,} trainable parameters")
    
    return model


if __name__ == "__main__":
    # Test model creation
    logging.basicConfig(level=logging.INFO)
    
    # Create model
    model = create_unixcoder_detector(
        model_name="microsoft/unixcoder-base",
        num_classes=2,
        device=torch.device("cuda" if torch.cuda.is_available() else "cpu"),
    )
    
    # Test forward pass
    sample_code = """
    def hello_world():
        print("Hello, World!")
        return 42
    """
    
    formatted_input = model.format_input(
        code=sample_code,
        docstring="A simple hello world function",
        ast_sequence="FunctionDef hello_world Call print Str Return Num",
    )
    
    print(f"\nFormatted input:\n{formatted_input}\n")
    
    # Tokenize
    inputs = model.tokenize([formatted_input])
    
    # Forward pass
    outputs = model.forward(
        input_ids=inputs["input_ids"].to(model.unixcoder.device),
        attention_mask=inputs["attention_mask"].to(model.unixcoder.device),
        return_embeddings=True,
    )
    
    print(f"Logits shape: {outputs['logits'].shape}")
    print(f"Embeddings shape: {outputs['embeddings'].shape}")
    print(f"Hidden states shape: {outputs['hidden_states'].shape}")
    
    # Test prediction
    pred_labels, probs = model.predict(
        input_ids=inputs["input_ids"].to(model.unixcoder.device),
        attention_mask=inputs["attention_mask"].to(model.unixcoder.device),
    )
    
    print(f"\nPredicted label: {pred_labels.item()}")
    print(f"Probabilities: {probs[0].tolist()}")
