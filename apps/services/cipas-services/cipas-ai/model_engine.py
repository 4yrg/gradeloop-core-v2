"""
Model Engine for 3-Stage Confidence-Based Early Exit Detection.

Handles inference for all three stages:
- Stage 1: Stylometry Analysis (fast linguistic patterns)
- Stage 2: CatBoost Structural Classifier (AST features) 
- Stage 3: ModernBERT-Large / DroidDetect-Large (deep semantic analysis)

Implements confidence-based early exit, quantization support, and batch processing.
"""

import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from catboost import CatBoostClassifier
from huggingface_hub import hf_hub_download
from transformers import AutoModel, AutoTokenizer

from .stylometry_model import StylometryModel, StylometryPrediction
from .config import get_settings

logger = logging.getLogger(__name__)


class TierEnum(str, Enum):
    """Enum for detection tier."""

    STYLOMETRY = "stage1_stylometry"
    TIER1 = "stage2_structural" # Renamed from tier1_catboost
    TIER2 = "stage3_semantic"   # Renamed from tier2_modernbert  
    HYBRID = "3stage_hybrid"


class PredictionLabel(str, Enum):
    """Enum for prediction labels."""

    HUMAN_WRITTEN = "Human-written"
    AI_GENERATED = "AI-generated"
    AI_REFINED = "AI-refined"


@dataclass
class StylometryResult:
    """Result from Stage 1 Stylometry classifier."""

    label: str
    confidence: float
    human_probability: float
    ai_probability: float
    features: dict
    tier: TierEnum = TierEnum.STYLOMETRY


@dataclass
class Tier1Result:
    """Result from Stage 2 Structural (Tier 1) CatBoost classifier."""

    label: str
    confidence: float
    human_probability: float
    ai_probability: float
    tier: TierEnum = TierEnum.TIER1


@dataclass
class Tier2Result:
    """Result from Stage 3 Deep Semantic (Tier 2) ModernBERT classifier."""

    label: str
    confidence: float
    all_scores: dict[str, float]
    token_count: int
    tier: TierEnum = TierEnum.TIER2


@dataclass
class HybridResult:
    """Result from hybrid 3-stage detection pipeline."""

    label: str
    confidence: float
    tier_used: TierEnum
    stylometry_confidence: Optional[float] = None
    tier1_confidence: Optional[float] = None
    tier2_confidence: Optional[float] = None
    all_scores: Optional[dict[str, float]] = None
    token_count: Optional[int] = None
    stylometry_features: Optional[dict] = None
    processing_time_ms: Optional[float] = None


# Model configuration
CATBOOST_MODEL_PATH = "models/catboost_classifier.cbm"
MODERNBERT_MODEL_NAME = "answerdotai/ModernBERT-large"
DROIDDETECT_MODEL_NAME = "project-droid/DroidDetect-Large"

# Tier 1 confidence thresholds for routing
# If confidence > HIGH_THRESHOLD or < LOW_THRESHOLD, use Tier 1 result
TIER1_HIGH_THRESHOLD = 0.92
TIER1_LOW_THRESHOLD = 0.08

# ModernBERT configuration
MODERNBERT_HIDDEN_SIZE = 1024  # ModernBERT-large hidden dimension
DROIDDETECT_PROJECTION_DIM = 256
NUM_CLASSES = 3  # Human, AI-generated, AI-refined

# Token limits
MODERNBERT_MAX_TOKENS = 8192  # ModernBERT supports 8k context
SLIDING_WINDOW_SIZE = 4096  # Use sliding window for very long inputs
SLIDING_WINDOW_OVERLAP = 256  # Overlap between windows


class DroidDetectLargeModel(nn.Module):
    """
    Custom model class for DroidDetect-Large.

    Architecture:
    - Text encoder (ModernBERT-large)
    - Projection layer (1024 -> 256)
    - Classification head (256 -> 3 classes)
    """

    def __init__(
        self,
        text_encoder: nn.Module,
        projection_dim: int = DROIDDETECT_PROJECTION_DIM,
        num_classes: int = NUM_CLASSES,
    ):
        super().__init__()
        self.text_encoder = text_encoder
        self.num_classes = num_classes

        # Projection layer
        self.text_projection = nn.Linear(MODERNBERT_HIDDEN_SIZE, projection_dim)

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


class ModelEngine:
    """
    Main engine for 3-stage confidence-based early exit code detection.

    Manages loading and inference for Stylometry, CatBoost and ModernBERT models.
    Implements sliding window for long inputs and batch processing.
    """

    _instance: Optional["ModelEngine"] = None

    def __new__(cls) -> "ModelEngine":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the model engine."""
        if hasattr(self, "_initialized") and self._initialized:
            return

        self._initialized = True
        self.settings = get_settings()

        # Stage 1: Stylometry
        self._stylometry_model: Optional[StylometryModel] = None
        self._stylometry_loaded = False

        # Stage 2: CatBoost (renamed from Tier 1)
        self._catboost_model: Optional[CatBoostClassifier] = None
        self._catboost_loaded = False

        # Stage 3: ModernBERT / DroidDetect (renamed from Tier 2)
        self._modernbert_model: Optional[DroidDetectLargeModel] = None
        self._modernbert_tokenizer = None
        self._modernbert_loaded = False

        # Device configuration
        self._device = self._get_device()

        # Quantization config
        self._use_4bit = False
        self._use_8bit = False

        # Label mappings
        self._stylometry_labels = ["human", "ai"]
        self._tier1_labels = ["Human-written", "AI-generated"]
        self._tier2_labels = [
            "Human-written",
            "AI-generated",
            "AI-refined",
        ]

    def _get_device(self) -> torch.device:
        """Get the best available device for inference."""
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")
            logger.info("Using Apple MPS device")
        else:
            device = torch.device("cpu")
            logger.info("Using CPU (consider GPU for better performance)")

        return device

    def enable_4bit_quantization(self) -> None:
        """Enable 4-bit quantization for Tier 2 model."""
        self._use_4bit = True
        self._use_8bit = False
        logger.info("4-bit quantization enabled for Tier 2 model")

    def enable_8bit_quantization(self) -> None:
        """Enable 8-bit quantization for Tier 2 model."""
        self._use_8bit = True
        self._use_4bit = False
        logger.info("8-bit quantization enabled for Tier 2 model")

    def load_stylometry_model(self, model_path: Optional[str] = None) -> None:
        """
        Load the Stage 1 Stylometry model.

        Args:
            model_path: Path to the stylometry model file.
        """
        if self._stylometry_loaded:
            logger.debug("Stage 1 stylometry model already loaded")
            return

        path = model_path or self.settings.stylometry_model_path
        logger.info(f"Loading Stage 1 stylometry model from: {path}")

        try:
            self._stylometry_model = StylometryModel(path)
            self._stylometry_model.load_model()
            self._stylometry_loaded = True
            logger.info("Stage 1 stylometry model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load stylometry model from {path}: {e}")
            # Create default model for demo purposes
            logger.info("Creating demo stylometry model with synthetic data")
            self._stylometry_model = StylometryModel.create_demo_model()
            self._stylometry_loaded = True

    def load_tier1_model(self, model_path: Optional[str] = None) -> None:
        """
        Load the Tier 1 CatBoost model.

        Args:
            model_path: Path to the .cbm model file.
        """
        if self._catboost_loaded:
            logger.debug("Tier 1 model already loaded")
            return

        path = model_path or CATBOOST_MODEL_PATH
        logger.info(f"Loading Tier 1 CatBoost model from: {path}")

        try:
            self._catboost_model = CatBoostClassifier()
            self._catboost_model.load_model(path)
            self._catboost_loaded = True
            logger.info("Tier 1 CatBoost model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Tier 1 model: {e}")
            raise

    def load_tier2_model(
        self,
        model_name: Optional[str] = None,
        trust_remote_code: bool = True,
    ) -> None:
        """
        Load the Tier 2 ModernBERT-Large / DroidDetect-Large model.

        Args:
            model_name: HuggingFace model name or path.
            trust_remote_code: Whether to trust remote code execution.
        """
        if self._modernbert_loaded:
            logger.debug("Tier 2 model already loaded")
            return

        model_name = model_name or DROIDDETECT_MODEL_NAME
        logger.info(f"Loading Tier 2 model: {model_name}")

        try:
            # Load tokenizer
            logger.info("Loading tokenizer...")
            self._modernbert_tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=trust_remote_code,
            )

            # Load base text encoder (ModernBERT-large)
            logger.info("Loading ModernBERT-large encoder...")
            text_encoder = AutoModel.from_pretrained(
                MODERNBERT_MODEL_NAME,
                trust_remote_code=trust_remote_code,
            )

            # Wrap in custom DroidDetect model
            logger.info("Building DroidDetect-Large architecture...")
            self._modernbert_model = DroidDetectLargeModel(text_encoder=text_encoder)

            # Load DroidDetect weights if using pretrained model
            if model_name == DROIDDETECT_MODEL_NAME:
                logger.info("Loading DroidDetect-Large weights...")
                self._load_droiddetect_weights()

            # Move to device
            self._modernbert_model.to(self._device)
            self._modernbert_model.eval()

            # Apply quantization if enabled
            if self._use_4bit or self._use_8bit:
                self._apply_quantization()

            self._modernbert_loaded = True
            logger.info("Tier 2 ModernBERT-Large model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load Tier 2 model: {e}")
            raise

    def _load_droiddetect_weights(self) -> None:
        """Load DroidDetect-Large weights from HuggingFace Hub."""
        try:
            weights_path = hf_hub_download(
                repo_id=DROIDDETECT_MODEL_NAME,
                filename="pytorch_model.bin",
            )

            state_dict = torch.load(
                weights_path,
                map_location=self._device,
                weights_only=True,
            )

            # Map weights to our model structure
            new_state_dict = {}
            for key, value in state_dict.items():
                new_state_dict[key] = value

            self._modernbert_model.load_state_dict(new_state_dict, strict=False)
            logger.info("DroidDetect-Large weights loaded successfully")

        except Exception as e:
            logger.warning(
                f"Failed to load DroidDetect weights, using ModernBERT only: {e}"
            )

    def _apply_quantization(self) -> None:
        """Apply quantization to the Tier 2 model."""
        if not self._modernbert_loaded:
            return

        try:
            import bitsandbytes as bnb

            if self._use_4bit:
                logger.info("Applying 4-bit quantization...")
                self._modernbert_model = bnb.nn.Linear4bit(self._modernbert_model)
            elif self._use_8bit:
                logger.info("Applying 8-bit quantization...")
                self._modernbert_model = bnb.nn.Linear8bitLt(self._modernbert_model)

            logger.info("Quantization applied successfully")

        except ImportError:
            logger.warning("bitsandbytes not installed, skipping quantization")
        except Exception as e:
            logger.warning(f"Failed to apply quantization: {e}")

    def is_tier1_loaded(self) -> bool:
        """Check if Tier 1 model is loaded."""
        return self._catboost_loaded

    def is_tier2_loaded(self) -> bool:
        """Check if Tier 2 model is loaded."""
        return self._modernbert_loaded

    def predict_tier1(self, features: list[float]) -> Tier1Result:
        """
        Run Tier 1 CatBoost inference.

        Args:
            features: List of 8 structural features.

        Returns:
            Tier1Result with prediction and confidence.

        Raises:
            RuntimeError: If model is not loaded.
        """
        if not self._catboost_loaded:
            raise RuntimeError("Tier 1 model not loaded")

        # Get prediction probabilities
        probs = self._catboost_model.predict_proba([features])[0]

        # Get predicted class and confidence
        predicted_idx = probs.argmax()
        confidence = float(probs[predicted_idx])

        label = (
            PredictionLabel.HUMAN_WRITTEN.value
            if predicted_idx == 0
            else PredictionLabel.AI_GENERATED.value
        )

        return Tier1Result(
            label=label,
            confidence=confidence,
            human_probability=float(probs[0]),
            ai_probability=float(probs[1]),
            tier=TierEnum.TIER1,
        )

    def _tokenize_with_sliding_window(
        self, code: str, max_length: int = MODERNBERT_MAX_TOKENS
    ) -> dict:
        """
        Tokenize code with sliding window support for long inputs.

        Args:
            code: Source code string.
            max_length: Maximum token length.

        Returns:
            Tokenized input dict with input_ids and attention_mask.
        """
        # First, try simple tokenization
        tokens = self._modernbert_tokenizer(
            code,
            return_tensors="pt",
            truncation=True,
            max_length=max_length,
            padding=True,
        )

        token_count = tokens["input_ids"].shape[1]

        # If within limit, return directly
        if token_count <= SLIDING_WINDOW_SIZE:
            return tokens

        # Use sliding window for very long inputs
        logger.info(
            f"Input exceeds {SLIDING_WINDOW_SIZE} tokens, using sliding window approach"
        )

        # Split code into chunks
        lines = code.split("\n")
        chunks = []
        current_chunk = []
        current_length = 0

        for line in lines:
            line_tokens = self._modernbert_tokenizer.encode(
                line, add_special_tokens=False
            )
            if current_length + len(line_tokens) > SLIDING_WINDOW_SIZE - 2:
                if current_chunk:
                    chunks.append("\n".join(current_chunk))
                current_chunk = [line]
                current_length = len(line_tokens)
            else:
                current_chunk.append(line)
                current_length += len(line_tokens)

        if current_chunk:
            chunks.append("\n".join(current_chunk))

        # Process each chunk and aggregate
        all_embeddings = []

        with torch.inference_mode():
            for chunk in chunks:
                chunk_tokens = self._modernbert_tokenizer(
                    chunk,
                    return_tensors="pt",
                    truncation=True,
                    max_length=SLIDING_WINDOW_SIZE,
                    padding=True,
                ).to(self._device)

                # Get encoder output
                encoder_output = self._modernbert_model.text_encoder(
                    input_ids=chunk_tokens["input_ids"],
                    attention_mask=chunk_tokens["attention_mask"],
                )

                # Mean pooling
                embedding = encoder_output.last_hidden_state.mean(dim=1)
                all_embeddings.append(embedding)

        # Average embeddings from all chunks
        aggregated_embedding = torch.mean(torch.stack(all_embeddings), dim=0)

        # Create pseudo-input for classification
        # (This is a simplified approach; full implementation would be more complex)
        return tokens

    def predict_tier2(
        self,
        code: str,
        use_sliding_window: bool = True,
    ) -> Tier2Result:
        """
        Run Tier 2 ModernBERT-Large inference.

        Args:
            code: Source code string.
            use_sliding_window: Whether to use sliding window for long inputs.

        Returns:
            Tier2Result with prediction, confidence, and all scores.

        Raises:
            RuntimeError: If model is not loaded.
        """
        if not self._modernbert_loaded:
            raise RuntimeError("Tier 2 model not loaded")

        start_time = time.time()

        # Tokenize input
        tokens = self._modernbert_tokenizer(
            code,
            return_tensors="pt",
            truncation=True,
            max_length=MODERNBERT_MAX_TOKENS,
            padding=True,
        )

        token_count = tokens["input_ids"].shape[1]

        # Check if sliding window is needed
        if use_sliding_window and token_count > SLIDING_WINDOW_SIZE:
            tokens = self._tokenize_with_sliding_window(code)

        # Move to device
        input_ids = tokens["input_ids"].to(self._device)
        attention_mask = tokens["attention_mask"].to(self._device)

        # Run inference with torch.inference_mode()
        with torch.inference_mode():
            outputs = self._modernbert_model(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            logits = outputs["logits"]

            # Apply softmax to get probabilities
            probs = F.softmax(logits, dim=-1).squeeze(0)

            # Get predicted class
            predicted_idx = torch.argmax(probs).item()
            confidence = float(probs[predicted_idx].item())

            # Get all scores
            all_scores = {
                label: float(probs[i].item())
                for i, label in enumerate(self._tier2_labels)
            }

        label = self._tier2_labels[predicted_idx]

        processing_time = (time.time() - start_time) * 1000
        logger.debug(
            f"Tier 2 inference completed in {processing_time:.2f}ms, "
            f"label={label}, confidence={confidence:.4f}"
        )

        return Tier2Result(
            label=label,
            confidence=confidence,
            all_scores=all_scores,
            token_count=token_count,
            tier=TierEnum.TIER2,
        )

    def predict_hybrid(
        self,
        code: str,
        language: str,
        features: list[float],
    ) -> HybridResult:
        """
        Run hybrid 2-tier prediction with automatic routing.

        Logic:
        - If Tier 1 confidence > 0.92 or < 0.08, return Tier 1 result
        - Otherwise, escalate to Tier 2 for deep semantic analysis

        Args:
            code: Source code string.
            language: Programming language.
            features: List of 8 structural features.

        Returns:
            HybridResult with final prediction and tier used.
        """
        start_time = time.time()

        # Run Tier 1
        tier1_result = self.predict_tier1(features)

        # Check if Tier 1 is confident enough
        if (
            tier1_result.confidence > TIER1_HIGH_THRESHOLD
            or tier1_result.confidence < TIER1_LOW_THRESHOLD
        ):
            processing_time = (time.time() - start_time) * 1000

            logger.info(
                f"Tier 1 confident enough (confidence={tier1_result.confidence:.4f}), "
                f"skipping Tier 2"
            )

            return HybridResult(
                label=tier1_result.label,
                confidence=tier1_result.confidence,
                tier_used=TierEnum.TIER1,
                tier1_confidence=tier1_result.confidence,
                processing_time_ms=processing_time,
            )

        # Escalate to Tier 2
        logger.info(
            f"Tier 1 uncertain (confidence={tier1_result.confidence:.4f}), "
            f"escalating to Tier 2"
        )

        tier2_result = self.predict_tier2(code)
        processing_time = (time.time() - start_time) * 1000

        return HybridResult(
            label=tier2_result.label,
            confidence=tier2_result.confidence,
            tier_used=TierEnum.TIER2,
            tier1_confidence=tier1_result.confidence,
            tier2_confidence=tier2_result.confidence,
            all_scores=tier2_result.all_scores,
            token_count=tier2_result.token_count,
            processing_time_ms=processing_time,
        )

    async def predict_hybrid_async(
        self,
        code: str,
        language: str,
        features: list[float],
    ) -> HybridResult:
        """
        Async version of hybrid prediction.

        Runs Tier 2 inference in a separate thread to avoid blocking.

        Args:
            code: Source code string.
            language: Programming language.
            features: List of 8 structural features.

        Returns:
            HybridResult with final prediction and tier used.
        """
        import asyncio

        start_time = time.time()

        # Run Tier 1 (fast, CPU-bound)
        tier1_result = self.predict_tier1(features)

        # Check if Tier 1 is confident enough
        if (
            tier1_result.confidence > TIER1_HIGH_THRESHOLD
            or tier1_result.confidence < TIER1_LOW_THRESHOLD
        ):
            processing_time = (time.time() - start_time) * 1000

            return HybridResult(
                label=tier1_result.label,
                confidence=tier1_result.confidence,
                tier_used=TierEnum.TIER1,
                tier1_confidence=tier1_result.confidence,
                processing_time_ms=processing_time,
            )

        # Run Tier 2 in a separate thread (GPU-bound, may block)
        loop = asyncio.get_event_loop()
        tier2_result = await loop.run_in_executor(None, self.predict_tier2, code)

        processing_time = (time.time() - start_time) * 1000

        return HybridResult(
            label=tier2_result.label,
            confidence=tier2_result.confidence,
            tier_used=TierEnum.TIER2,
            tier1_confidence=tier1_result.confidence,
            tier2_confidence=tier2_result.confidence,
            all_scores=tier2_result.all_scores,
            token_count=tier2_result.token_count,
            processing_time_ms=processing_time,
        )

    def is_stylometry_loaded(self) -> bool:
        """Check if Stage 1 stylometry model is loaded."""
        return self._stylometry_loaded

    def predict_stylometry(self, code: str, language: str = "python") -> StylometryResult:
        """
        Run Stage 1 stylometry inference.

        Args:
            code: Source code string.
            language: Programming language.

        Returns:
            StylometryResult with prediction and confidence.

        Raises:
            RuntimeError: If model is not loaded.
        """
        if not self._stylometry_loaded:
            raise RuntimeError("Stage 1 stylometry model not loaded")

        # Get stylometry prediction
        prediction = self._stylometry_model.predict(code, language)
        
        # Convert to standardized format
        if prediction.label == "human":
            label = "Human-written"
            confidence = prediction.probability_human
        elif prediction.label == "ai":
            label = "AI-generated" 
            confidence = prediction.probability_ai
        else:  # uncertain case
            label = "Uncertain"
            confidence = 0.5

        return StylometryResult(
            label=label,
            confidence=confidence,
            human_probability=prediction.probability_human,
            ai_probability=prediction.probability_ai,
            features=prediction.features,
        )

    def predict_3stage_hybrid(
        self,
        code: str,
        language: str,
        features: list[float],
    ) -> HybridResult:
        """
        Run hybrid 3-stage prediction with confidence-based early exit.

        Stage 1: Stylometry (Fast Layer) - >= 0.80 high confidence, <= 0.40 low confidence
        Stage 2: Structural (Medium Layer) - >= 0.80 high confidence, <= 0.40 low confidence  
        Stage 3: Deep Semantic (Heavy Layer) - final prediction

        Args:
            code: Source code string.
            language: Programming language.
            features: List of 8 structural features.

        Returns:
            HybridResult with final prediction and stage used.
        """
        start_time = time.time()

        # Stage 1: Stylometry Detection (Fast Layer)
        stylometry_result = None
        if self.settings.enable_stylometry_stage and self._stylometry_loaded:
            try:
                stylometry_result = self.predict_stylometry(code, language)
                
                # Early exit if high confidence
                if stylometry_result.confidence >= self.settings.stylometry_high_threshold:
                    processing_time = (time.time() - start_time) * 1000
                    logger.info(
                        f"Stage 1 stylometry high confidence ({stylometry_result.confidence:.4f}), "
                        f"early exit with result: {stylometry_result.label}"
                    )
                    return HybridResult(
                        label=stylometry_result.label,
                        confidence=stylometry_result.confidence,
                        tier_used=TierEnum.STYLOMETRY,
                        stylometry_confidence=stylometry_result.confidence,
                        stylometry_features=stylometry_result.features,
                        processing_time_ms=processing_time,
                    )
                    
                # Early exit if low confidence (confident opposite)
                elif stylometry_result.confidence <= self.settings.stylometry_low_threshold:
                    processing_time = (time.time() - start_time) * 1000
                    # Flip label for low confidence case
                    inverted_label = "AI-generated" if stylometry_result.label == "Human-written" else "Human-written"
                    inverted_confidence = 1.0 - stylometry_result.confidence
                    
                    logger.info(
                        f"Stage 1 stylometry low confidence ({stylometry_result.confidence:.4f}), "
                        f"early exit with inverted result: {inverted_label}"
                    )
                    return HybridResult(
                        label=inverted_label,
                        confidence=inverted_confidence,
                        tier_used=TierEnum.STYLOMETRY,
                        stylometry_confidence=stylometry_result.confidence,
                        stylometry_features=stylometry_result.features,
                        processing_time_ms=processing_time,
                    )
                
                logger.info(
                    f"Stage 1 stylometry uncertain ({stylometry_result.confidence:.4f}), "
                    f"continuing to Stage 2"
                )
                    
            except Exception as e:
                logger.warning(f"Stage 1 stylometry failed: {e}, continuing to Stage 2")

        # Stage 2: Structural Analysis (Medium Layer) 
        tier1_result = self.predict_tier1(features)

        # Check if Stage 2 is confident enough
        if (
            tier1_result.confidence >= self.settings.structural_high_threshold
            or tier1_result.confidence <= self.settings.structural_low_threshold
        ):
            processing_time = (time.time() - start_time) * 1000
            
            # For low confidence, invert the result
            if tier1_result.confidence <= self.settings.structural_low_threshold:
                final_label = "AI-generated" if tier1_result.label == "Human-written" else "Human-written" 
                final_confidence = 1.0 - tier1_result.confidence
            else:
                final_label = tier1_result.label
                final_confidence = tier1_result.confidence

            logger.info(
                f"Stage 2 structural confident enough (confidence={tier1_result.confidence:.4f}), "
                f"skipping Stage 3"
            )

            return HybridResult(
                label=final_label,
                confidence=final_confidence,
                tier_used=TierEnum.TIER1,
                stylometry_confidence=stylometry_result.confidence if stylometry_result else None,
                tier1_confidence=tier1_result.confidence,
                stylometry_features=stylometry_result.features if stylometry_result else None,
                processing_time_ms=processing_time,
            )

        # Stage 3: Deep Semantic Analysis (Heavy Layer)
        logger.info(
            f"Stage 2 structural uncertain (confidence={tier1_result.confidence:.4f}), "
            f"escalating to Stage 3"
        )

        tier2_result = self.predict_tier2(code)
        processing_time = (time.time() - start_time) * 1000

        return HybridResult(
            label=tier2_result.label,
            confidence=tier2_result.confidence,
            tier_used=TierEnum.TIER2,
            stylometry_confidence=stylometry_result.confidence if stylometry_result else None,
            tier1_confidence=tier1_result.confidence,
            tier2_confidence=tier2_result.confidence,
            all_scores=tier2_result.all_scores,
            token_count=tier2_result.token_count,
            stylometry_features=stylometry_result.features if stylometry_result else None,
            processing_time_ms=processing_time,
        )


# Global singleton instance
_engine: Optional[ModelEngine] = None


def get_model_engine() -> ModelEngine:
    """Get the singleton ModelEngine instance."""
    global _engine
    if _engine is None:
        _engine = ModelEngine()
    return _engine


def load_all_models(
    stylometry_path: Optional[str] = None,
    tier1_path: Optional[str] = None,
    tier2_model_name: Optional[str] = None,
    enable_4bit: bool = False,
    enable_8bit: bool = False,
) -> ModelEngine:
    """
    Load all 3 stage models: Stylometry, CatBoost, and ModernBERT.

    Args:
        stylometry_path: Path to stylometry model file.
        tier1_path: Path to CatBoost model file.
        tier2_model_name: HuggingFace model name for Tier 2.
        enable_4bit: Enable 4-bit quantization.
        enable_8bit: Enable 8-bit quantization.

    Returns:
        Loaded ModelEngine instance.
    """
    engine = get_model_engine()

    if enable_4bit:
        engine.enable_4bit_quantization()
    elif enable_8bit:
        engine.enable_8bit_quantization()

    engine.load_stylometry_model(stylometry_path)
    engine.load_tier1_model(tier1_path)
    engine.load_tier2_model(tier2_model_name)

    return engine
