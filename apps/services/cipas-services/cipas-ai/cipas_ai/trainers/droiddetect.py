"""DroidDetect model trainer for deep learning-based code classification"""

import logging
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer, AutoModel
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, Callable, Tuple, List
from sklearn.metrics import accuracy_score, classification_report
import asyncio
from pathlib import Path

from ..config.settings import Settings

logger = logging.getLogger(__name__)

class CodeDataset(Dataset):
    """Dataset for code classification"""
    
    def __init__(self, codes: List[str], labels: List[int], tokenizer, max_length: int = 512):
        self.codes = codes
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.codes)
    
    def __getitem__(self, idx):
        code = str(self.codes[idx])
        label = self.labels[idx]
        
        # Tokenize code
        encoding = self.tokenizer(
            code,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class DroidDetectModel(nn.Module):
    """DroidDetect neural network model"""
    
    def __init__(self, model_name: str, num_classes: int, dropout_rate: float = 0.3):
        super().__init__()
        
        self.backbone = AutoModel.from_pretrained(model_name)
        self.dropout = nn.Dropout(dropout_rate)
        self.classifier = nn.Linear(self.backbone.config.hidden_size, num_classes)
        
    def forward(self, input_ids, attention_mask):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        # Use pooler_output when available (BERT-family); fall back to CLS token
        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            pooled_output = outputs.pooler_output
        else:
            pooled_output = outputs.last_hidden_state[:, 0, :]
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        return logits

class DroidDetectTrainer:
    """DroidDetect model trainer"""
    
    def __init__(self, settings: Settings, config_overrides: Optional[Dict[str, Any]] = None):
        self.settings = settings
        self.config = self._merge_config(config_overrides)
        device_str = settings.system.device
        if device_str == "auto":
            device_str = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device_str)
        self.tokenizer = None
        self.model = None
        
    def _merge_config(self, overrides: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge base config with overrides"""
        base_config = {
            "model_name": self.settings.models.droiddetect.model_name,
            "max_length": self.settings.models.droiddetect.max_length,
            "batch_size": self.settings.models.droiddetect.batch_size,
            "learning_rate": self.settings.models.droiddetect.learning_rate,
            "epochs": self.settings.models.droiddetect.epochs,
            "warmup_steps": self.settings.models.droiddetect.warmup_steps,
            "weight_decay": self.settings.models.droiddetect.weight_decay,
            "dropout_rate": self.settings.models.droiddetect.dropout_rate,
            "early_stopping_patience": self.settings.models.droiddetect.early_stopping_patience,
            "save_steps": self.settings.models.droiddetect.save_steps,
            "eval_steps": self.settings.models.droiddetect.eval_steps
        }
        
        if overrides:
            base_config.update(overrides)
        
        return base_config
    
    def get_config(self) -> Dict[str, Any]:
        """Get current training configuration"""
        return self.config.copy()
    
    async def train(
        self,
        train_data: pd.DataFrame,
        test_data: Optional[pd.DataFrame] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Tuple[Any, Dict[str, Any]]:
        """Train DroidDetect model"""
        
        if progress_callback:
            progress_callback(5.0, "Initializing tokenizer and model")
        
        # Initialize tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(self.config["model_name"])
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Prepare data
        X_train, y_train = self._prepare_data(train_data)
        X_test, y_test = None, None
        if test_data is not None:
            X_test, y_test = self._prepare_data(test_data)
        
        # Determine number of classes
        num_classes = len(np.unique(y_train))
        
        if progress_callback:
            progress_callback(15.0, f"Creating model with {num_classes} classes")
        
        # Initialize model
        self.model = DroidDetectModel(
            model_name=self.config["model_name"],
            num_classes=num_classes,
            dropout_rate=self.config["dropout_rate"]
        ).to(self.device)
        
        # Create datasets and dataloaders
        train_dataset = CodeDataset(X_train, y_train, self.tokenizer, self.config["max_length"])
        train_loader = DataLoader(
            train_dataset, 
            batch_size=self.config["batch_size"], 
            shuffle=True
        )
        
        test_loader = None
        if X_test is not None:
            test_dataset = CodeDataset(X_test, y_test, self.tokenizer, self.config["max_length"])
            test_loader = DataLoader(
                test_dataset, 
                batch_size=self.config["batch_size"], 
                shuffle=False
            )
        
        if progress_callback:
            progress_callback(20.0, "Setting up optimizer and training loop")
        
        # Setup optimizer and loss function
        optimizer = optim.AdamW(
            self.model.parameters(),
            lr=self.config["learning_rate"],
            weight_decay=self.config["weight_decay"]
        )
        
        criterion = nn.CrossEntropyLoss()
        
        # Training loop
        training_history = {
            "train_losses": [],
            "train_accuracies": [],
            "eval_losses": [],
            "eval_accuracies": [],
            "best_eval_accuracy": 0.0,
            "epochs_completed": 0
        }
        
        best_model_state = None
        patience_counter = 0
        
        total_steps = len(train_loader) * self.config["epochs"]
        current_step = 0
        
        for epoch in range(self.config["epochs"]):
            # Free any unreferenced GPU memory before each epoch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            if progress_callback:
                progress_callback(
                    20 + (epoch / self.config["epochs"]) * 60,
                    f"Training epoch {epoch + 1}/{self.config['epochs']}"
                )
            
            # Training phase
            train_loss, train_acc = await self._train_epoch(
                train_loader, criterion, optimizer, progress_callback, epoch
            )
            
            training_history["train_losses"].append(train_loss)
            training_history["train_accuracies"].append(train_acc)
            training_history["epochs_completed"] = epoch + 1
            
            # Evaluation phase
            if test_loader is not None:
                eval_loss, eval_acc = await self._evaluate_epoch(test_loader, criterion)
                training_history["eval_losses"].append(eval_loss)
                training_history["eval_accuracies"].append(eval_acc)
                
                # Check for improvement
                if eval_acc > training_history["best_eval_accuracy"]:
                    training_history["best_eval_accuracy"] = eval_acc
                    best_model_state = self.model.state_dict().copy()
                    patience_counter = 0
                else:
                    patience_counter += 1
                
                logger.info(
                    f"Epoch {epoch + 1}: train_loss={train_loss:.4f}, "
                    f"train_acc={train_acc:.4f}, eval_loss={eval_loss:.4f}, eval_acc={eval_acc:.4f}"
                )
                
                # Early stopping
                if patience_counter >= self.config["early_stopping_patience"]:
                    logger.info(f"Early stopping after {epoch + 1} epochs")
                    break
            else:
                logger.info(f"Epoch {epoch + 1}: train_loss={train_loss:.4f}, train_acc={train_acc:.4f}")
        
        # Load best model if available
        if best_model_state is not None:
            self.model.load_state_dict(best_model_state)
        
        if progress_callback:
            progress_callback(90.0, "Training completed, creating model wrapper")
        
        # Create wrapper model
        wrapper_model = DroidDetectModelWrapper(
            self.model, 
            self.tokenizer, 
            self.config["max_length"],
            self.device
        )
        
        if progress_callback:
            progress_callback(100.0, "DroidDetect training completed successfully")
        
        return wrapper_model, training_history
    
    async def _train_epoch(
        self, 
        train_loader: DataLoader, 
        criterion: nn.Module, 
        optimizer: optim.Optimizer,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        epoch: int = 0
    ) -> Tuple[float, float]:
        """Train for one epoch"""
        
        self.model.train()
        total_loss = 0
        correct_predictions = 0
        total_predictions = 0
        
        for batch_idx, batch in enumerate(train_loader):
            input_ids = batch['input_ids'].to(self.device)
            attention_mask = batch['attention_mask'].to(self.device)
            labels = batch['labels'].to(self.device)
            
            optimizer.zero_grad()
            
            logits = self.model(input_ids, attention_mask)
            loss = criterion(logits, labels)
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
            _, predicted = torch.max(logits, 1)
            correct_predictions += (predicted == labels).sum().item()
            total_predictions += labels.size(0)
            
            # Progress update
            if progress_callback and batch_idx % 10 == 0:
                batch_progress = (batch_idx / len(train_loader)) * 100
                progress_callback(
                    20 + (epoch / self.config["epochs"]) * 60 + (batch_progress / self.config["epochs"]),
                    f"Epoch {epoch + 1}: batch {batch_idx}/{len(train_loader)}"
                )
        
        avg_loss = total_loss / len(train_loader)
        accuracy = correct_predictions / total_predictions
        
        return avg_loss, accuracy
    
    async def _evaluate_epoch(self, test_loader: DataLoader, criterion: nn.Module) -> Tuple[float, float]:
        """Evaluate for one epoch"""
        
        self.model.eval()
        total_loss = 0
        correct_predictions = 0
        total_predictions = 0
        
        with torch.no_grad():
            for batch in test_loader:
                input_ids = batch['input_ids'].to(self.device)
                attention_mask = batch['attention_mask'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                logits = self.model(input_ids, attention_mask)
                loss = criterion(logits, labels)
                
                total_loss += loss.item()
                
                _, predicted = torch.max(logits, 1)
                correct_predictions += (predicted == labels).sum().item()
                total_predictions += labels.size(0)
        
        avg_loss = total_loss / len(test_loader)
        accuracy = correct_predictions / total_predictions
        
        return avg_loss, accuracy
    
    async def evaluate(self, model: Any, test_data: pd.DataFrame) -> Dict[str, Any]:
        """Evaluate trained model"""
        
        X_test, y_test = self._prepare_data(test_data)
        
        # Get predictions
        predictions = []
        probabilities = []
        
        model.model.eval()
        with torch.no_grad():
            for code in X_test:
                pred_proba = model.predict_proba([code])
                predictions.append(int(np.argmax(pred_proba[0])))
                probabilities.append(pred_proba[0].tolist())
        
        # Compute metrics
        accuracy = accuracy_score(y_test, predictions)
        report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
        
        return {
            "accuracy": float(accuracy),
            "classification_report": report,
            "predictions": predictions,
            "probabilities": probabilities,
            "test_samples": len(y_test)
        }
    
    def _prepare_data(self, data: pd.DataFrame) -> Tuple[List[str], List[int]]:
        """Prepare data for training/evaluation"""
        
        # Determine column names
        code_col = "code" if "code" in data.columns else data.columns[0]
        label_col = "label" if "label" in data.columns else data.columns[-1]
        
        # Extract code and labels
        codes = data[code_col].astype(str).tolist()
        labels = data[label_col].tolist()
        
        return codes, labels

class DroidDetectModelWrapper:
    """Wrapper for DroidDetect model to provide consistent interface"""
    
    def __init__(self, model: DroidDetectModel, tokenizer, max_length: int, device):
        self.model = model
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.device = device
    
    def predict(self, X: List[str]) -> np.ndarray:
        """Predict labels for code samples"""
        probabilities = self.predict_proba(X)
        return np.argmax(probabilities, axis=1)
    
    def predict_proba(self, X: List[str]) -> np.ndarray:
        """Predict probabilities for code samples"""
        self.model.eval()
        
        probabilities = []
        
        with torch.no_grad():
            for code in X:
                # Tokenize
                encoding = self.tokenizer(
                    str(code),
                    truncation=True,
                    padding='max_length',
                    max_length=self.max_length,
                    return_tensors='pt'
                )
                
                input_ids = encoding['input_ids'].to(self.device)
                attention_mask = encoding['attention_mask'].to(self.device)
                
                # Forward pass
                logits = self.model(input_ids, attention_mask)
                
                # Apply softmax to get probabilities
                probs = torch.softmax(logits, dim=1)
                probabilities.append(probs.cpu().numpy()[0])
        
        return np.array(probabilities)