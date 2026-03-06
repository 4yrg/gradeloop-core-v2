"""Evaluation API endpoints"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid
import time
from datetime import datetime
from pathlib import Path
import logging

from ...config.settings import get_settings, Settings

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory evaluation job tracking
evaluation_jobs: Dict[str, "EvaluationStatus"] = {}

class EvaluationRequest(BaseModel):
    """Evaluation request model"""
    dataset: str = Field(default="aicd-bench", description="Dataset to evaluate on")
    model_dir: Optional[str] = Field(default=None, description="Directory containing trained models")
    max_samples: Optional[int] = Field(default=None, description="Maximum samples to evaluate")
    batch_size: Optional[int] = Field(default=8, description="Batch size for evaluation")
    save_results: bool = Field(default=True, description="Save results to file")
    stage: str = Field(default="pipeline", description="Which model to evaluate: catboost, droiddetect, or pipeline")

class EvaluationResponse(BaseModel):
    """Evaluation response model"""
    job_id: str
    status: str
    dataset: str
    stage: str
    message: str

class EvaluationStatus(BaseModel):
    """Evaluation status model"""
    job_id: str
    status: str  # queued, running, completed, failed
    dataset: str
    stage: str
    progress: float = 0.0
    message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    output_file: Optional[str] = None

class QuickEvaluationRequest(BaseModel):
    """Quick evaluation request for immediate processing"""
    code_samples: List[str] = Field(description="Code samples to classify")
    stage: str = Field(default="pipeline", description="Which model to use")

class QuickEvaluationResponse(BaseModel):
    """Quick evaluation response"""
    predictions: List[Dict[str, Any]]
    processing_time_ms: float

@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(
    request: EvaluationRequest,
    background_tasks: BackgroundTasks,
    settings: Settings = Depends(get_settings)
):
    """Run model evaluation on a dataset"""
    
    # Validate dataset
    if request.dataset not in settings.datasets.available and request.dataset != "aicd-bench":
        available = list(settings.datasets.available.keys()) + ["aicd-bench"]
        raise HTTPException(400, f"Invalid dataset. Available: {available}")
    
    # Validate stage
    valid_stages = ["catboost", "droiddetect", "pipeline"]
    if request.stage not in valid_stages:
        raise HTTPException(400, f"Invalid stage. Must be one of: {valid_stages}")
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Create job entry
    evaluation_jobs[job_id] = EvaluationStatus(
        job_id=job_id,
        status="queued",
        dataset=request.dataset,
        stage=request.stage,
        message="Evaluation job queued",
        started_at=datetime.now().isoformat()
    )
    
    # Start background evaluation
    background_tasks.add_task(
        run_evaluation_job,
        job_id,
        request,
        settings
    )
    
    logger.info(f"Started evaluation job {job_id} for dataset: {request.dataset}")
    
    return EvaluationResponse(
        job_id=job_id,
        status="started",
        dataset=request.dataset,
        stage=request.stage,
        message=f"Evaluation job {job_id} started for dataset: {request.dataset}"
    )

@router.get("/status/{job_id}", response_model=EvaluationStatus)
async def get_evaluation_status(job_id: str):
    """Get evaluation job status"""
    if job_id not in evaluation_jobs:
        raise HTTPException(404, "Evaluation job not found")
    return evaluation_jobs[job_id]

@router.get("/status", response_model=List[EvaluationStatus])
async def list_evaluation_jobs():
    """List all evaluation jobs"""
    return list(evaluation_jobs.values())

@router.post("/quick", response_model=QuickEvaluationResponse)
async def quick_evaluation(
    request: QuickEvaluationRequest,
    settings: Settings = Depends(get_settings)
):
    """Quick evaluation of code samples (synchronous)"""
    
    start_time = time.time()
    
    try:
        # Import here to avoid circular imports
        from ...pipeline.orchestrator import EvaluationOrchestrator
        
        orchestrator = EvaluationOrchestrator(settings)
        
        # Load models
        models = await orchestrator.load_models(stage=request.stage)
        
        # Evaluate samples
        predictions = []
        for i, code in enumerate(request.code_samples):
            try:
                result = await orchestrator.predict_single(code, models, stage=request.stage)
                predictions.append({
                    "sample_id": i,
                    "prediction": result["prediction"],
                    "confidence": result["confidence"],
                    "probabilities": result["probabilities"],
                    "stage_used": result.get("stage_used", request.stage),
                    "processing_time_ms": result.get("processing_time_ms", 0)
                })
            except Exception as e:
                predictions.append({
                    "sample_id": i,
                    "error": str(e),
                    "prediction": None,
                    "confidence": 0.0
                })
        
        processing_time = (time.time() - start_time) * 1000
        
        return QuickEvaluationResponse(
            predictions=predictions,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        raise HTTPException(500, f"Evaluation failed: {str(e)}")

@router.get("/datasets")
async def list_datasets(settings: Settings = Depends(get_settings)):
    """List available evaluation datasets"""
    
    # Check which datasets actually exist
    available_datasets = []
    
    for name, paths in settings.datasets.available.items():
        dataset_exists = False
        for split, path in paths.items():
            full_path = Path(settings.datasets.base_path) / path
            if full_path.exists():
                dataset_exists = True
                break
        
        available_datasets.append({
            "name": name,
            "splits": list(paths.keys()),
            "exists": dataset_exists
        })
    
    return {
        "available_datasets": available_datasets,
        "default_evaluation": settings.datasets.evaluation_dataset,
        "datasets_base_path": settings.datasets.base_path
    }

@router.delete("/jobs/{job_id}")
async def delete_evaluation_job(job_id: str):
    """Delete evaluation job from history"""
    if job_id not in evaluation_jobs:
        raise HTTPException(404, "Evaluation job not found")
    
    job = evaluation_jobs[job_id]
    if job.status == "running":
        raise HTTPException(400, "Cannot delete running job")
    
    del evaluation_jobs[job_id]
    return {"message": f"Evaluation job {job_id} deleted"}

async def run_evaluation_job(job_id: str, request: EvaluationRequest, settings: Settings):
    """Background evaluation job runner"""
    job = evaluation_jobs[job_id]
    
    try:
        job.status = "running"
        job.message = f"Starting evaluation on {request.dataset}"
        
        # Import orchestrator
        from ...pipeline.orchestrator import EvaluationOrchestrator
        
        orchestrator = EvaluationOrchestrator(settings)
        
        # Progress callback
        def progress_callback(progress: float, message: str):
            job.progress = min(progress, 100.0)
            job.message = message
            logger.info(f"Evaluation job {job_id}: {progress:.1f}% - {message}")
        
        # Run evaluation
        results = await orchestrator.run_evaluation(
            dataset=request.dataset,
            model_dir=request.model_dir,
            max_samples=request.max_samples,
            batch_size=request.batch_size,
            save_results=request.save_results,
            stage=request.stage,
            progress_callback=progress_callback
        )
        
        # Evaluation completed
        job.status = "completed"
        job.progress = 100.0
        job.message = "Evaluation completed successfully"
        job.completed_at = datetime.now().isoformat()
        job.results = results["metrics"]
        job.output_file = results.get("output_file")
        
        logger.info(f"Evaluation job {job_id} completed successfully")
        
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.message = f"Evaluation failed: {str(e)}"
        job.completed_at = datetime.now().isoformat()
        
        logger.error(f"Evaluation job {job_id} failed: {str(e)}")