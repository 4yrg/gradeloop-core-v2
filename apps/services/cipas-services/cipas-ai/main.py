"""
FastAPI microservice for AI-generated code detection.
Uses the DroidDetect-Large model for 4-class classification.
"""

from contextlib import asynccontextmanager

import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from model_loader import ModelLoader, get_model_loader

# --- Request/Response Models ---


class DetectRequest(BaseModel):
    """Request model for code detection."""

    code_snippet: str = Field(
        ...,
        description="The code snippet to analyze",
        min_length=1,
        max_length=50000,  # Reasonable upper limit
    )
    language: str | None = Field(
        default=None, description="Optional programming language hint", max_length=50
    )


class DetectResponse(BaseModel):
    """Response model for code detection."""

    predicted_label: str = Field(..., description="The predicted classification label")
    confidence_score: float = Field(
        ...,
        description="Confidence score for the predicted label (0.0 to 1.0)",
        ge=0.0,
        le=1.0,
    )
    is_adversarial: bool = Field(
        ..., description="True if the code appears to be AI-refined/adversarial"
    )
    all_scores: dict[str, float] = Field(
        ..., description="Confidence scores for all classes"
    )
    token_count: int | None = Field(
        default=None, description="Estimated token count of the input (if within range)"
    )
    warning: str | None = Field(
        default=None, description="Warning message if input exceeds recommended length"
    )


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="Service status")
    model_loaded: bool = Field(..., description="Whether the model is loaded")
    device: str | None = Field(default=None, description="Device being used")


# --- Lifespan Context Manager ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for model preloading."""
    # Startup: Load the model
    print("[Startup] Loading DroidDetect-Large model...")
    loader = get_model_loader()
    loader.load_model()
    print("[Startup] Model ready")
    yield
    # Shutdown: Cleanup if needed
    print("[Shutdown] Cleaning up...")


# --- FastAPI Application ---

app = FastAPI(
    title="CIPAS AI - Code Detection Service",
    description="AI-generated code detection using DroidDetect-Large model",
    version="0.1.0",
    lifespan=lifespan,
)


# --- Helper Functions ---


def preprocess_code(code: str) -> str:
    """Basic code preprocessing."""
    return code.strip()


def tokenize_input(code: str, tokenizer, max_length: int = 512) -> dict:
    """Tokenize the input code."""
    return tokenizer(
        code,
        return_tensors="pt",
        truncation=True,
        max_length=max_length,
        padding=True,
    )


def get_prediction(logits: torch.Tensor) -> tuple[str, float, dict[str, float], int]:
    """
    Process model logits to get predictions.

    Returns:
        - predicted_label: The class with highest probability
        - confidence_score: Probability of the predicted class
        - all_scores: Dictionary of all class probabilities
        - predicted_class_idx: Index of predicted class
    """
    # Apply softmax to get probabilities
    probs = F.softmax(logits, dim=-1).squeeze(0)

    # Get predicted class
    predicted_idx = torch.argmax(probs).item()
    confidence = probs[predicted_idx].item()

    # Get all scores
    loader = get_model_loader()
    all_scores = {
        label: float(probs[i].item()) for i, label in enumerate(loader.labels)
    }

    return loader.labels[predicted_idx], confidence, all_scores, predicted_idx


# --- Endpoints ---


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint to monitor model readiness.
    """
    loader = get_model_loader()
    return HealthResponse(
        status="healthy" if loader.is_loaded else "starting",
        model_loaded=loader.is_loaded,
        device=str(loader.device) if loader.is_loaded else None,
    )


@app.post("/detect", response_model=DetectResponse)
async def detect_code(request: DetectRequest):
    """
    Detect whether code is human-written, AI-generated, AI-refined, or adversarial.

    The DroidDetect-Large model is specifically trained to detect:
    - Human-written code
    - AI-generated code
    - AI-refined code (human-edited AI code)
    - AI-generated adversarial code (code designed to look human)
    """
    loader = get_model_loader()

    # Check if model is loaded
    if not loader.is_loaded:
        raise HTTPException(
            status_code=503, detail="Model not loaded. Please wait for initialization."
        )

    # Preprocess the code
    code = preprocess_code(request.code_snippet)

    # Tokenize to check length
    tokens = loader.tokenizer(code, return_tensors="pt")
    token_count = tokens["input_ids"].shape[1]

    warning = None
    if token_count > loader.max_tokens:
        warning = (
            f"Input exceeds recommended length of {loader.max_tokens} tokens "
            f"(got {token_count}). Model performance may be degraded. "
            "Consider splitting large code snippets."
        )

    # Move tokens to device
    input_ids = tokens["input_ids"].to(loader.device)
    attention_mask = tokens["attention_mask"].to(loader.device)

    # Run inference
    with torch.no_grad():
        outputs = loader.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        logits = outputs["logits"]

    # Get predictions
    predicted_label, confidence, all_scores, predicted_idx = get_prediction(logits)

    # Determine if adversarial
    # Consider adversarial if AI-refined or AI-generated-adversarial has high probability
    adversarial_threshold = 0.5
    is_adversarial = (
        all_scores.get("AI-refined", 0) >= adversarial_threshold
        or all_scores.get("AI-generated-adversarial", 0) >= adversarial_threshold
    )

    return DetectResponse(
        predicted_label=predicted_label,
        confidence_score=round(confidence, 4),
        is_adversarial=is_adversarial,
        all_scores={k: round(v, 4) for k, v in all_scores.items()},
        token_count=token_count,
        warning=warning,
    )


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "CIPAS AI - Code Detection Service",
        "version": "0.1.0",
        "model": "project-droid/DroidDetect-Large",
        "endpoints": {
            "health": "/health",
            "detect": "/detect (POST)",
        },
    }
