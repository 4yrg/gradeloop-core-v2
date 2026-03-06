"""Training and evaluation orchestration pipeline"""

import asyncio
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

from ..config.settings import Settings

logger = logging.getLogger(__name__)

class TrainingOrchestrator:
    """Orchestrates model training pipeline"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.models_dir = Path(settings.output.models_dir)
        self.models_dir.mkdir(exist_ok=True)
        
    async def run_training(
        self,
        dataset: str,
        model_type: str,
        config_overrides: Dict[str, Any] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """Run training pipeline for specified model type"""
        
        if progress_callback:
            progress_callback(5.0, f"Starting training for {model_type}")
        
        # Load dataset
        train_data, test_data = await self._load_dataset(dataset, progress_callback)
        
        if progress_callback:
            progress_callback(20.0, f"Dataset loaded: {len(train_data)} training samples")
        
        # Select trainer based on model type
        if model_type == "catboost":
            from ..trainers.catboost import CatBoostTrainer
            trainer = CatBoostTrainer(self.settings, config_overrides)
        elif model_type == "droiddetect":
            from ..trainers.droiddetect import DroidDetectTrainer
            trainer = DroidDetectTrainer(self.settings, config_overrides)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Train model
        model, training_history = await trainer.train(
            train_data, 
            test_data, 
            progress_callback=lambda p, m: progress_callback(20 + (p * 0.6), m) if progress_callback else None
        )
        
        if progress_callback:
            progress_callback(80.0, "Saving trained model")
        
        # Save model
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_filename = f"{model_type}_{dataset}_{timestamp}.joblib"
        model_path = self.models_dir / model_filename
        
        await self._save_model(model, model_path, {
            "model_type": model_type,
            "dataset": dataset,
            "timestamp": timestamp,
            "training_samples": len(train_data),
            "test_samples": len(test_data) if test_data is not None else 0,
            "config": trainer.get_config(),
            "history": training_history
        })
        
        if progress_callback:
            progress_callback(90.0, "Evaluating model performance")
        
        # Quick evaluation on test set
        metrics = {}
        if test_data is not None:
            metrics = await trainer.evaluate(model, test_data)
        
        if progress_callback:
            progress_callback(100.0, "Training completed successfully")
        
        return {
            "model_path": str(model_path),
            "model_type": model_type,
            "dataset": dataset,
            "training_samples": len(train_data),
            "test_samples": len(test_data) if test_data is not None else 0,
            "metrics": metrics,
            "training_history": training_history,
            "config": trainer.get_config()
        }
    
    async def _load_dataset(self, dataset: str, progress_callback=None) -> tuple:
        """Load training dataset"""
        
        if progress_callback:
            progress_callback(10.0, f"Loading dataset: {dataset}")
        
        if dataset == "synthetic":
            # Generate synthetic data for testing
            train_data = pd.DataFrame({
                'code': [f"def function_{i}():\n    return {i}" for i in range(1000)],
                'label': np.random.randint(0, 2, 1000)
            })
            test_data = pd.DataFrame({
                'code': [f"def test_{i}():\n    return {i}" for i in range(200)],
                'label': np.random.randint(0, 2, 200)
            })
            return train_data, test_data
            
        # Load from configured datasets
        if dataset not in self.settings.datasets.available:
            raise ValueError(f"Dataset {dataset} not configured")
        
        dataset_config = self.settings.datasets.available[dataset]
        base_path = Path(self.settings.datasets.base_path)
        
        train_data = None
        test_data = None
        
        # Load train split
        if "train" in dataset_config:
            train_path = base_path / dataset_config["train"]
            if train_path.exists():
                train_data = await self._load_data_file(train_path)
                if progress_callback:
                    progress_callback(15.0, f"Loaded training data: {len(train_data)} samples")
        
        # Load test split
        if "test" in dataset_config:
            test_path = base_path / dataset_config["test"]
            if test_path.exists():
                test_data = await self._load_data_file(test_path)
                if progress_callback:
                    progress_callback(18.0, f"Loaded test data: {len(test_data)} samples")
        
        if train_data is None:
            raise ValueError(f"No training data found for dataset: {dataset}")
        
        return train_data, test_data
    
    async def _load_data_file(self, file_path: Path) -> pd.DataFrame:
        """Load data file based on extension"""
        
        if file_path.suffix == '.csv':
            return pd.read_csv(file_path)
        elif file_path.suffix == '.jsonl':
            return pd.read_json(file_path, lines=True)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
    
    async def _save_model(self, model, model_path: Path, metadata: Dict[str, Any]):
        """Save trained model with metadata"""
        
        # Save model
        joblib.dump(model, model_path)
        
        # Save metadata
        metadata_path = model_path.with_suffix('.json')
        import json
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        logger.info(f"Model saved to {model_path}")
        logger.info(f"Metadata saved to {metadata_path}")


class EvaluationOrchestrator:
    """Orchestrates model evaluation pipeline"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.models_dir = Path(settings.output.models_dir)
        
    async def run_evaluation(
        self,
        dataset: str,
        model_dir: Optional[str] = None,
        max_samples: Optional[int] = None,
        batch_size: int = 8,
        save_results: bool = True,
        stage: str = "pipeline",
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """Run evaluation pipeline"""
        
        if progress_callback:
            progress_callback(5.0, f"Starting evaluation on {dataset}")
        
        # Load models
        models = await self.load_models(model_dir, stage)
        
        if progress_callback:
            progress_callback(15.0, f"Models loaded for stage: {stage}")
        
        # Load evaluation dataset
        eval_data = await self._load_evaluation_dataset(dataset, max_samples, progress_callback)
        
        if progress_callback:
            progress_callback(25.0, f"Dataset loaded: {len(eval_data)} samples")
        
        # Run evaluation
        results = await self._evaluate_models(
            models, eval_data, stage, batch_size, progress_callback
        )
        
        if progress_callback:
            progress_callback(90.0, "Computing final metrics")
        
        # Compute metrics
        metrics = await self._compute_metrics(results["predictions"], results["ground_truth"])
        
        results["metrics"] = metrics
        results["dataset"] = dataset
        results["stage"] = stage
        results["total_samples"] = len(eval_data)
        
        # Save results if requested
        if save_results:
            output_file = await self._save_results(results, dataset, stage)
            results["output_file"] = output_file
        
        if progress_callback:
            progress_callback(100.0, "Evaluation completed")
        
        return results
    
    async def load_models(self, model_dir: Optional[str] = None, stage: str = "pipeline") -> Dict[str, Any]:
        """Load trained models for evaluation"""
        
        models_base = Path(model_dir) if model_dir else self.models_dir
        
        models = {}
        
        if stage in ["catboost", "pipeline"]:
            # Load CatBoost model
            catboost_models = list(models_base.glob("catboost_*.joblib"))
            if catboost_models:
                latest_catboost = max(catboost_models, key=lambda x: x.stat().st_mtime)
                models["catboost"] = joblib.load(latest_catboost)
                logger.info(f"Loaded CatBoost model: {latest_catboost}")
        
        if stage in ["droiddetect", "pipeline"]:
            # Load DroidDetect model
            droiddetect_models = list(models_base.glob("droiddetect_*.joblib"))
            if droiddetect_models:
                latest_droiddetect = max(droiddetect_models, key=lambda x: x.stat().st_mtime)
                models["droiddetect"] = joblib.load(latest_droiddetect)
                logger.info(f"Loaded DroidDetect model: {latest_droiddetect}")
        
        if not models:
            raise ValueError(f"No trained models found for stage: {stage}")
        
        return models
    
    async def predict_single(
        self, 
        code: str, 
        models: Dict[str, Any], 
        stage: str = "pipeline"
    ) -> Dict[str, Any]:
        """Predict on single code sample"""
        
        start_time = time.time()
        
        if stage == "catboost" and "catboost" in models:
            prediction_proba = models["catboost"].predict_proba([code])
            prediction = int(np.argmax(prediction_proba[0]))
            confidence = float(np.max(prediction_proba[0]))
            probabilities = prediction_proba[0].tolist()
            stage_used = "catboost"
            
        elif stage == "droiddetect" and "droiddetect" in models:
            prediction_proba = models["droiddetect"].predict_proba([code])
            prediction = int(np.argmax(prediction_proba[0]))
            confidence = float(np.max(prediction_proba[0]))
            probabilities = prediction_proba[0].tolist()
            stage_used = "droiddetect"
            
        elif stage == "pipeline":
            # Implement pipeline logic (use fast/slow path based on confidence)
            if "catboost" in models:
                prediction_proba = models["catboost"].predict_proba([code])
                confidence = float(np.max(prediction_proba[0]))
                
                # Check if we need slow path
                if confidence < self.settings.models.catboost.fast_path_threshold:
                    if "droiddetect" in models:
                        prediction_proba = models["droiddetect"].predict_proba([code])
                        stage_used = "droiddetect"
                    else:
                        stage_used = "catboost"
                else:
                    stage_used = "catboost"
                
                prediction = int(np.argmax(prediction_proba[0]))
                confidence = float(np.max(prediction_proba[0]))
                probabilities = prediction_proba[0].tolist()
                
            else:
                raise ValueError("No models available for pipeline prediction")
        
        else:
            raise ValueError(f"Invalid stage or missing models: {stage}")
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "prediction": prediction,
            "confidence": confidence,
            "probabilities": probabilities,
            "stage_used": stage_used,
            "processing_time_ms": processing_time
        }
    
    async def _load_evaluation_dataset(
        self, 
        dataset: str, 
        max_samples: Optional[int], 
        progress_callback=None
    ) -> pd.DataFrame:
        """Load evaluation dataset"""
        
        if progress_callback:
            progress_callback(10.0, f"Loading evaluation dataset: {dataset}")
        
        if dataset == "aicd-bench":
            # Load AICD benchmark test set
            test_path = Path(self.settings.datasets.base_path) / "aicd-bench" / "T1_test.csv"
            if not test_path.exists():
                raise ValueError(f"AICD benchmark test file not found: {test_path}")
            
            data = pd.read_csv(test_path)
            
        elif dataset in self.settings.datasets.available:
            # Load configured dataset
            dataset_config = self.settings.datasets.available[dataset]
            base_path = Path(self.settings.datasets.base_path)
            
            # Try to load test split, fall back to validation or train
            for split in ["test", "validation", "train"]:
                if split in dataset_config:
                    data_path = base_path / dataset_config[split]
                    if data_path.exists():
                        if data_path.suffix == '.csv':
                            data = pd.read_csv(data_path)
                        elif data_path.suffix == '.jsonl':
                            data = pd.read_json(data_path, lines=True)
                        break
            else:
                raise ValueError(f"No evaluation data found for dataset: {dataset}")
        
        else:
            raise ValueError(f"Unknown dataset: {dataset}")
        
        # Limit samples if requested
        if max_samples and len(data) > max_samples:
            data = data.head(max_samples)
            if progress_callback:
                progress_callback(15.0, f"Limited to {max_samples} samples")
        
        return data
    
    async def _evaluate_models(
        self, 
        models: Dict[str, Any], 
        eval_data: pd.DataFrame, 
        stage: str,
        batch_size: int,
        progress_callback=None
    ) -> Dict[str, Any]:
        """Evaluate models on dataset"""
        
        predictions = []
        ground_truth = []
        
        # Determine code and label columns
        code_col = "code" if "code" in eval_data.columns else eval_data.columns[0]
        label_col = "label" if "label" in eval_data.columns else eval_data.columns[-1]
        
        total_samples = len(eval_data)
        
        for i in range(0, total_samples, batch_size):
            batch = eval_data.iloc[i:i+batch_size]
            
            for _, row in batch.iterrows():
                code = row[code_col]
                true_label = row[label_col]
                
                # Get prediction
                try:
                    result = await self.predict_single(code, models, stage)
                    predictions.append(result["prediction"])
                    ground_truth.append(true_label)
                except Exception as e:
                    logger.warning(f"Prediction failed for sample {len(predictions)}: {e}")
                    predictions.append(0)  # Default prediction
                    ground_truth.append(true_label)
                
                # Update progress
                if progress_callback and len(predictions) % 50 == 0:
                    progress = 25 + (len(predictions) / total_samples) * 60
                    progress_callback(
                        progress, 
                        f"Evaluated {len(predictions)}/{total_samples} samples"
                    )
        
        return {
            "predictions": predictions,
            "ground_truth": ground_truth
        }
    
    async def _compute_metrics(self, predictions: List[int], ground_truth: List[int]) -> Dict[str, Any]:
        """Compute evaluation metrics"""
        
        accuracy = accuracy_score(ground_truth, predictions)
        precision, recall, f1, support = precision_recall_fscore_support(
            ground_truth, predictions, average='weighted'
        )
        
        # Detailed classification report
        report = classification_report(
            ground_truth, predictions, 
            output_dict=True, 
            zero_division=0
        )
        
        return {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "support": int(sum(support)),
            "classification_report": report
        }
    
    async def _save_results(self, results: Dict[str, Any], dataset: str, stage: str) -> str:
        """Save evaluation results to file"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"evaluation_{stage}_{dataset}_{timestamp}.json"
        
        results_dir = Path(self.settings.output.results_dir)
        results_dir.mkdir(exist_ok=True)
        
        output_path = results_dir / filename
        
        import json
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Results saved to {output_path}")
        return str(output_path)