"""
Additional methods for ModelEngine to complete the 3-stage pipeline implementation.
This file contains the missing methods that need to be added to model_engine.py
"""

import time
import logging

logger = logging.getLogger(__name__)

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