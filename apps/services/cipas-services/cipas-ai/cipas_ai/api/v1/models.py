"""Model management endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from pathlib import Path
import json
from datetime import datetime

from ...config.settings import get_settings, Settings

router = APIRouter()

class ModelInfo(BaseModel):
    """Model information"""
    name: str
    type: str  # catboost, droiddetect, modernbert
    path: str
    size_mb: float
    created: str
    config: Dict[str, Any]
    status: str  # available, training, error

class ModelsListResponse(BaseModel):
    """Models list response"""
    models: List[ModelInfo]
    total: int
    models_dir: str

@router.get("/list", response_model=ModelsListResponse)
async def list_models(settings: Settings = Depends(get_settings)):
    """List all available trained models"""
    
    models_dir = Path(settings.output.models_dir)
    models = []
    
    if models_dir.exists():
        # Look for CatBoost models
        catboost_model = models_dir / settings.output.catboost_model
        if catboost_model.exists():
            try:
                stat = catboost_model.stat()
                models.append(ModelInfo(
                    name="catboost_classifier",
                    type="catboost",
                    path=str(catboost_model),
                    size_mb=round(stat.st_size / (1024**2), 2),
                    created=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    config=settings.models.catboost.dict(),
                    status="available"
                ))
            except Exception as e:
                models.append(ModelInfo(
                    name="catboost_classifier",
                    type="catboost", 
                    path=str(catboost_model),
                    size_mb=0.0,
                    created="",
                    config={},
                    status="error"
                ))
        
        # Look for DroidDetect models
        for model_dir in models_dir.glob("droiddetect_*"):
            if model_dir.is_dir():
                config_file = model_dir / "config.json"
                try:
                    config = {}
                    if config_file.exists():
                        with open(config_file) as f:
                            config = json.load(f)
                    
                    # Calculate directory size
                    size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file())
                    
                    models.append(ModelInfo(
                        name=model_dir.name,
                        type="droiddetect",
                        path=str(model_dir),
                        size_mb=round(size / (1024**2), 2),
                        created=datetime.fromtimestamp(model_dir.stat().st_ctime).isoformat(),
                        config=config,
                        status="available"
                    ))
                except Exception:
                    models.append(ModelInfo(
                        name=model_dir.name,
                        type="droiddetect",
                        path=str(model_dir),
                        size_mb=0.0,
                        created="",
                        config={},
                        status="error"
                    ))
    
    return ModelsListResponse(
        models=models,
        total=len(models),
        models_dir=str(models_dir)
    )

@router.get("/info/{model_name}")
async def get_model_info(
    model_name: str,
    settings: Settings = Depends(get_settings)
):
    """Get detailed information about a specific model"""
    
    models_dir = Path(settings.output.models_dir)
    
    # Handle different model types
    if model_name == "catboost_classifier":
        model_path = models_dir / settings.output.catboost_model
        if not model_path.exists():
            raise HTTPException(404, f"CatBoost model not found: {model_path}")
        
        try:
            import catboost
            model = catboost.CatBoostClassifier()
            model.load_model(str(model_path))
            
            return {
                "name": model_name,
                "type": "catboost",
                "path": str(model_path),
                "iterations": model.get_param("iterations"),
                "feature_count": model.get_feature_importance().shape[0] if hasattr(model, 'get_feature_importance') else "unknown",
                "classes": model.classes_.tolist() if hasattr(model, 'classes_') else ["Human-written", "AI-generated"],
                "config": settings.models.catboost.dict()
            }
        except Exception as e:
            raise HTTPException(500, f"Error loading CatBoost model: {str(e)}")
    
    else:
        # Look for DroidDetect or other models
        model_dir = models_dir / model_name
        if not model_dir.exists():
            raise HTTPException(404, f"Model not found: {model_name}")
        
        config_file = model_dir / "config.json"
        config = {}
        if config_file.exists():
            try:
                with open(config_file) as f:
                    config = json.load(f)
            except Exception:
                pass
        
        return {
            "name": model_name,
            "type": "droiddetect",  # or detect from config
            "path": str(model_dir),
            "config": config,
            "files": [f.name for f in model_dir.iterdir() if f.is_file()]
        }

@router.delete("/delete/{model_name}")
async def delete_model(
    model_name: str,
    settings: Settings = Depends(get_settings)
):
    """Delete a trained model"""
    
    models_dir = Path(settings.output.models_dir)
    
    if model_name == "catboost_classifier":
        model_path = models_dir / settings.output.catboost_model
        if model_path.exists():
            model_path.unlink()
            return {"message": f"Deleted CatBoost model: {model_name}"}
        else:
            raise HTTPException(404, f"CatBoost model not found: {model_name}")
    
    else:
        model_dir = models_dir / model_name
        if model_dir.exists() and model_dir.is_dir():
            import shutil
            shutil.rmtree(model_dir)
            return {"message": f"Deleted model directory: {model_name}"}
        else:
            raise HTTPException(404, f"Model not found: {model_name}")

@router.get("/config")
async def get_model_configs(settings: Settings = Depends(get_settings)):
    """Get model configuration templates"""
    
    return {
        "catboost": settings.models.catboost.dict(),
        "droiddetect": settings.models.droiddetect.dict(),
        "modernbert": settings.models.modernbert.dict()
    }