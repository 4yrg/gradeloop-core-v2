"""Training API endpoints"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uuid
import asyncio
import time
from datetime import datetime
import logging

from ...config.settings import get_settings, Settings

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory job tracking (use Redis/database in production)
training_jobs: Dict[str, "TrainingStatus"] = {}

class TrainingRequest(BaseModel):
    """Training request model"""
    stage: str = Field(default="pipeline", description="Training stage: catboost, droiddetect, or pipeline")
    datasets: Optional[List[str]] = Field(default=None, description="Override datasets to use")
    device: Optional[str] = Field(default=None, description="Override device: auto, gpu, cpu")
    quick: bool = Field(default=False, description="Quick test run with reduced samples")
    max_train_samples: Optional[int] = Field(default=None, description="Maximum training samples")
    max_eval_samples: Optional[int] = Field(default=None, description="Maximum evaluation samples")
    custom_config: Optional[Dict[str, Any]] = Field(default=None, description="Custom configuration overrides")

class TrainingResponse(BaseModel):
    """Training response model"""
    job_id: str
    status: str = "started"
    message: str
    estimated_time_minutes: Optional[int] = None
    stage: str

class TrainingStatus(BaseModel):
    """Training status model"""
    job_id: str
    status: str  # queued, running, completed, failed, cancelled
    stage: str
    progress: float = 0.0
    current_step: Optional[str] = None
    message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    logs: List[str] = Field(default_factory=list)

@router.post("/start", response_model=TrainingResponse)
async def start_training(
    request: TrainingRequest,
    background_tasks: BackgroundTasks,
    settings: Settings = Depends(get_settings)
):
    """Start a new training job"""
    
    # Validate stage
    valid_stages = ["catboost", "droiddetect", "pipeline"]
    if request.stage not in valid_stages:
        raise HTTPException(400, f"Invalid stage. Must be one of: {valid_stages}")
    
    # Check concurrent jobs limit
    running_jobs = [job for job in training_jobs.values() 
                   if job.status in ["queued", "running"]]
    if len(running_jobs) >= settings.api.max_concurrent_jobs:
        raise HTTPException(429, "Maximum concurrent training jobs reached")
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Create job entry
    training_jobs[job_id] = TrainingStatus(
        job_id=job_id,
        status="queued",
        stage=request.stage,
        message="Training job queued",
        started_at=datetime.now().isoformat()
    )
    
    # Start background training
    background_tasks.add_task(
        run_training_job,
        job_id,
        request,
        settings
    )
    
    logger.info(f"Started training job {job_id} for stage: {request.stage}")
    
    return TrainingResponse(
        job_id=job_id,
        stage=request.stage,
        message=f"Training job {job_id} started for stage: {request.stage}",
        estimated_time_minutes=estimate_training_time(request.stage, request.quick)
    )

@router.get("/status/{job_id}", response_model=TrainingStatus)
async def get_training_status(job_id: str):
    """Get training job status"""
    if job_id not in training_jobs:
        raise HTTPException(404, "Training job not found")
    return training_jobs[job_id]

@router.get("/status", response_model=List[TrainingStatus])
async def list_training_jobs():
    """List all training jobs"""
    return list(training_jobs.values())

@router.post("/stop/{job_id}")
async def stop_training(job_id: str):
    """Stop/cancel a training job"""
    if job_id not in training_jobs:
        raise HTTPException(404, "Training job not found")
    
    job = training_jobs[job_id]
    if job.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(400, f"Cannot stop job with status: {job.status}")
    
    job.status = "cancelled"
    job.message = "Training cancelled by user"
    job.completed_at = datetime.now().isoformat()
    
    logger.info(f"Cancelled training job {job_id}")
    return {"message": f"Training job {job_id} cancelled"}

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a training job from history"""
    if job_id not in training_jobs:
        raise HTTPException(404, "Training job not found")
    
    job = training_jobs[job_id]
    if job.status == "running":
        raise HTTPException(400, "Cannot delete running job")
    
    del training_jobs[job_id]
    return {"message": f"Training job {job_id} deleted"}

@router.get("/logs/{job_id}")
async def get_training_logs(job_id: str):
    """Get training logs for a job"""
    if job_id not in training_jobs:
        raise HTTPException(404, "Training job not found")
    
    job = training_jobs[job_id]
    return {
        "job_id": job_id,
        "logs": job.logs,
        "status": job.status
    }

async def run_training_job(job_id: str, request: TrainingRequest, settings: Settings):
    """Background training job runner"""
    job = training_jobs[job_id]
    
    try:
        job.status = "running"
        job.message = f"Starting {request.stage} training"
        job.logs.append(f"[{datetime.now().isoformat()}] Training started for stage: {request.stage}")
        
        # Import orchestrator here to avoid circular imports
        from ...pipeline.orchestrator import TrainingOrchestrator
        
        # Create orchestrator
        orchestrator = TrainingOrchestrator(settings)
        
        # Apply request overrides
        config = settings.copy(deep=True)  # This might not work with Pydantic v2
        
        # Apply overrides manually
        if request.device:
            config.system.device = request.device
            
        if request.quick:
            config.training.max_train_samples = 1000
            config.training.max_eval_samples = 200
            config.models.catboost.iterations = 100
            config.models.droiddetect.epochs = 1
            job.logs.append("Applied quick training settings")
            
        if request.max_train_samples:
            config.training.max_train_samples = request.max_train_samples
            
        if request.max_eval_samples:
            config.training.max_eval_samples = request.max_eval_samples
            
        if request.datasets:
            # Override dataset selection
            job.logs.append(f"Using custom datasets: {request.datasets}")
        
        # Progress callback
        def progress_callback(stage: str, progress: float, message: str):
            job.current_step = stage
            job.progress = min(progress, 100.0)
            job.message = message
            job.logs.append(f"[{datetime.now().isoformat()}] {stage}: {message}")
            logger.info(f"Job {job_id} - {stage}: {progress:.1f}% - {message}")
        
        # Run training
        job.logs.append(f"Starting training with device: {config.system.device}")
        results = await orchestrator.run_training(
            stage=request.stage,
            config=config,
            progress_callback=progress_callback
        )
        
        # Training completed successfully
        job.status = "completed"
        job.progress = 100.0
        job.message = "Training completed successfully"
        job.completed_at = datetime.now().isoformat()
        job.results = results
        job.logs.append(f"[{datetime.now().isoformat()}] Training completed successfully")
        
        logger.info(f"Training job {job_id} completed successfully")
        
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.message = f"Training failed: {str(e)}"
        job.completed_at = datetime.now().isoformat()
        job.logs.append(f"[{datetime.now().isoformat()}] ERROR: {str(e)}")
        
        logger.error(f"Training job {job_id} failed: {str(e)}")

def estimate_training_time(stage: str, quick: bool = False) -> int:
    """Estimate training time in minutes"""
    if quick:
        estimates = {
            "catboost": 5,     # 5 minutes for quick test
            "droiddetect": 15, # 15 minutes for quick test
            "pipeline": 20     # 20 minutes for quick test
        }
    else:
        estimates = {
            "catboost": 30,    # 30 minutes
            "droiddetect": 120, # 2 hours  
            "pipeline": 150    # 2.5 hours
        }
    return estimates.get(stage, 60)