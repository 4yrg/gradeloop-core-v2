"""
Model loader utility for DroidDetect-Base.
Implements Singleton pattern to ensure model is loaded only once.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from huggingface_hub import hf_hub_download
from transformers import AutoModel, AutoTokenizer

# Constants from the model architecture
TEXT_EMBEDDING_DIM = 768  # ModernBERT-base hidden size
PROJECTION_DIM = 256       # Both DroidDetect-Base and Large use 256-dim projection
NUM_CLASSES = 4

# Base model for DroidDetect-Base
BASE_MODEL_NAME = "answerdotai/ModernBERT-base"
MODEL_NAME = "project-droid/DroidDetect-Base"

LABEL_MAPPING = {
    0: "Human-written",
    1: "AI-generated",
    2: "AI-refined",
    3: "AI-generated-adversarial",
}


class TLModel(nn.Module):
    """
    Custom model class for DroidDetect-Large.

    Architecture:
    - Text encoder (ModernBERT-large)
    - Projection layer (768 -> 128)
    - Classification head (128 -> 4 classes)
    """

    def __init__(
        self,
        text_encoder: nn.Module,
        projection_dim: int = PROJECTION_DIM,
        num_classes: int = NUM_CLASSES,
    ):
        super().__init__()
        self.text_encoder = text_encoder
        self.num_classes = num_classes

        # Projection layer
        self.text_projection = nn.Linear(TEXT_EMBEDDING_DIM, projection_dim)

        # Classification head
        self.classifier = nn.Linear(projection_dim, num_classes)

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> dict:
        """Forward pass through the model."""
        # Get encoder outputs
        encoder_output = self.text_encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

        # Mean pooling over sequence dimension
        sentence_embeddings = encoder_output.last_hidden_state.mean(dim=1)

        # Project and classify
        projected_text = F.relu(self.text_projection(sentence_embeddings))
        logits = self.classifier(projected_text)

        return {"logits": logits, "fused_embedding": projected_text}


def load_droiddetect_weights(model: TLModel, device: torch.device) -> TLModel:
    """
    Load DroidDetect-Large weights into the model.

    The weights are stored in pytorch_model.bin and need to be mapped
    to the custom TLModel structure.
    """
    # Download the weights file
    weights_path = hf_hub_download(
        repo_id=MODEL_NAME,
        filename="pytorch_model.bin",
    )

    # Load state dict
    state_dict = torch.load(weights_path, map_location=device, weights_only=True)

    # The state dict from DroidDetect contains:
    # - text_encoder.* (ModernBERT weights)
    # - text_projection.* (projection layer weights)
    # - classifier.* (classification head weights)

    # Create a new state dict mapped to our model structure
    new_state_dict = {}
    for key, value in state_dict.items():
        if key.startswith("text_encoder."):
            # Remove prefix for encoder keys
            new_key = key
        elif key.startswith("text_projection."):
            new_key = key
        elif key.startswith("classifier."):
            new_key = key
        else:
            # Keep as-is for any other keys
            new_key = key
        new_state_dict[new_key] = value

    # Load the state dict
    model.load_state_dict(new_state_dict, strict=False)

    return model


class ModelLoader:
    """
    Singleton class for loading and managing the DroidDetect-Base model.

    The model performs 4-class classification:
    - Human-written (label 0)
    - AI-generated (label 1)
    - AI-refined (label 2)
    - AI-generated-adversarial (label 3)
    """

    _instance = None
    _model = None
    _tokenizer = None
    _device = None
    _is_loaded = False

    # Model configuration
    LABELS = [
        "Human-written",
        "AI-generated",
        "AI-refined",
        "AI-generated-adversarial",
    ]
    MAX_TOKENS = 512  # Model performs best on inputs up to 512 tokens

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        # Only initialize once
        if not self._is_loaded:
            self._device = self._get_device()

    def _get_device(self) -> torch.device:
        """Get the device for inference (CPU-only build)."""
        device = torch.device("cpu")
        print("[ModelLoader] Using CPU (CPU-only build)")
        return device

    def load_model(self) -> None:
        """Load the DroidDetect-Large model and tokenizer."""
        if self._is_loaded:
            print("[ModelLoader] Model already loaded")
            return

        print(f"[ModelLoader] Loading model: {MODEL_NAME}")

        # Load tokenizer from DroidDetect
        print("[ModelLoader] Loading tokenizer...")
        self._tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
        )

        # Load base text encoder (ModernBERT-large)
        print("[ModelLoader] Loading base encoder (ModernBERT-base)...")
        text_encoder = AutoModel.from_pretrained(
            BASE_MODEL_NAME,
            trust_remote_code=True,
        )

        # Wrap in custom TLModel
        print("[ModelLoader] Building custom model architecture...")
        self._model = TLModel(text_encoder=text_encoder)

        # Load DroidDetect weights
        print("[ModelLoader] Loading DroidDetect weights...")
        self._model = load_droiddetect_weights(self._model, self._device)

        # Move to device
        self._model.to(self._device)

        # Set to evaluation mode
        self._model.eval()

        self._is_loaded = True
        print("[ModelLoader] Model loaded successfully")

    @property
    def model(self) -> TLModel:
        """Get the loaded model."""
        if not self._is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        return self._model

    @property
    def tokenizer(self):
        """Get the loaded tokenizer."""
        if not self._is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        return self._tokenizer

    @property
    def device(self) -> torch.device:
        """Get the device being used."""
        return self._device

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded."""
        return self._is_loaded

    @property
    def labels(self) -> list:
        """Get the classification labels."""
        return self.LABELS

    @property
    def label_mapping(self) -> dict:
        """Get the label mapping."""
        return LABEL_MAPPING

    @property
    def max_tokens(self) -> int:
        """Get the maximum effective token count."""
        return self.MAX_TOKENS


# Global singleton instance
_model_loader: ModelLoader | None = None


def get_model_loader() -> ModelLoader:
    """Get the singleton ModelLoader instance."""
    global _model_loader
    if _model_loader is None:
        _model_loader = ModelLoader()
    return _model_loader


def load_model() -> ModelLoader:
    """Load the model and return the loader instance."""
    loader = get_model_loader()
    loader.load_model()
    return loader
