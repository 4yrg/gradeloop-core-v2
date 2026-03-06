"""
Configuration management using Pydantic Settings and YAML
Provides centralized configuration for all CIPAS-AI components
"""

import yaml
from pathlib import Path
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from typing import List, Dict, Optional, Any
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class DatasetConfig(BaseModel):
    """Dataset configuration"""
    base_path: str = Field(default="../../../../datasets")
    available: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    default_training: List[str] = Field(default_factory=list)
    evaluation_dataset: str = "aicd-bench"

class CatBoostConfig(BaseModel):
    """CatBoost Stage 1 configuration"""
    iterations: int = 2000
    learning_rate: float = 0.05
    depth: int = 8
    l2_leaf_reg: float = 3.0
    random_strength: float = 1.0
    bagging_temperature: float = 1.0
    border_count: int = 128
    early_stopping_rounds: int = 100
    eval_metric: str = "AUC"
    device: str = "gpu"
    random_seed: int = 42
    verbose: bool = False
    task_type: str = "GPU"   # GPU or CPU (passed to CatBoost)
    devices: str = "0"       # GPU device index

class DroidDetectConfig(BaseModel):
    """DroidDetect Stage 2 configuration"""
    model_name: str = "modernbert-base"
    droiddetect_repo: str = "project-droid/DroidDetect-Large-Binary"
    max_length: int = 2048
    epochs: int = 3
    batch_size: int = 8
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2.0e-5
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    max_grad_norm: float = 1.0

class ModernBertConfig(BaseModel):
    """ModernBERT standalone configuration"""
    model_name: str = "answerdotai/ModernBERT-base"
    num_classes: int = 2
    max_length: int = 1024

class ModelsConfig(BaseModel):
    """All model configurations"""
    catboost: CatBoostConfig = Field(default_factory=CatBoostConfig)
    droiddetect: DroidDetectConfig = Field(default_factory=DroidDetectConfig)
    modernbert: ModernBertConfig = Field(default_factory=ModernBertConfig)

class QualityFilterConfig(BaseModel):
    """Code quality filtering configuration"""
    enabled: bool = True
    ast_depth_min: int = 2
    ast_depth_max: int = 31
    line_count_min: int = 6
    line_count_max: int = 300

class FastPathConfig(BaseModel):
    """Fast-path threshold configuration"""
    high_threshold: float = 0.95  # P_AI > 0.95 → fast-path AI exit
    low_threshold: float = 0.05   # P_AI < 0.05 → fast-path Human exit

class QuantizationConfig(BaseModel):
    """Model quantization configuration"""
    use_4bit: bool = False
    use_8bit: bool = False

class MCDropoutConfig(BaseModel):
    """MC Dropout configuration"""
    enabled: bool = True
    noise_fraction: float = 0.1
    passes: int = 10
    rate: float = 0.1

class TrainingConfig(BaseModel):
    """Training configuration"""
    max_train_samples: Optional[int] = None
    max_dev_samples: Optional[int] = None
    max_eval_samples: Optional[int] = None
    quality_filter: QualityFilterConfig = Field(default_factory=QualityFilterConfig)
    fast_path: FastPathConfig = Field(default_factory=FastPathConfig)
    mixed_precision: bool = True
    quantization: QuantizationConfig = Field(default_factory=QuantizationConfig)
    mc_dropout: MCDropoutConfig = Field(default_factory=MCDropoutConfig)

class OutputConfig(BaseModel):
    """Output configuration"""
    models_dir: str = "models"
    catboost_model: str = "catboost_classifier.cbm"
    results_dir: str = "results"
    save_plots: bool = True
    save_metrics: bool = True
    plot_format: str = "png"
    save_steps: int = 500
    eval_steps: int = 100

class SystemConfig(BaseModel):
    """System configuration"""
    random_seed: int = 42
    device: str = "auto"  # auto, gpu, cpu
    num_workers: int = 4

class APIConfig(BaseModel):
    """API configuration"""
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False
    max_concurrent_jobs: int = 2
    cors_origins: List[str] = Field(default_factory=lambda: ["*"])

class LoggingConfig(BaseModel):
    """Logging configuration"""
    level: str = "INFO"
    format: str = "%(asctime)s  %(levelname)-8s  %(message)s"

class FeaturesConfig(BaseModel):
    """Feature extraction configuration"""
    token_histogram_bins: int = 232
    ngram_size: int = 2
    ngram_bins: int = 475

class GrammarConfig(BaseModel):
    """Tree-sitter grammar configuration"""
    base_path: str = "models"
    languages: Dict[str, str] = Field(default_factory=lambda: {
        "python": "tree-sitter-python.so",
        "java": "tree-sitter-java.so",
        "c": "tree-sitter-c.so",
        "cpp": "tree-sitter-cpp.so",
        "javascript": "tree-sitter-javascript.so",
        "go": "tree-sitter-go.so",
        "csharp": "tree-sitter-c-sharp.so"
    })

class CLITrainConfig(BaseModel):
    """CLI training run settings (controlled via config.yaml cli.train)"""
    model: str = "pipeline"           # pipeline | catboost | droiddetect
    dataset: Optional[str] = None     # null = all default_training datasets
    max_samples: Optional[int] = None # null = no limit
    verbose: bool = False

class CLIEvaluateConfig(BaseModel):
    """CLI evaluation run settings (controlled via config.yaml cli.evaluate)"""
    stage: str = "pipeline"           # pipeline | catboost | droiddetect
    dataset: Optional[str] = None     # null = datasets.evaluation_dataset
    model_dir: Optional[str] = None   # null = output.models_dir
    max_samples: Optional[int] = None # null = no limit
    batch_size: int = 8
    output_file: Optional[str] = None # null = auto-generated in results_dir
    verbose: bool = False

class CLIConfig(BaseModel):
    """CLI run configuration (train + evaluate)"""
    train: CLITrainConfig = Field(default_factory=CLITrainConfig)
    evaluate: CLIEvaluateConfig = Field(default_factory=CLIEvaluateConfig)

class Settings(BaseSettings):
    """Main settings class with environment variable support"""
    
    # Core configurations (loaded from YAML)
    datasets: DatasetConfig = Field(default_factory=DatasetConfig)
    models: ModelsConfig = Field(default_factory=ModelsConfig)
    training: TrainingConfig = Field(default_factory=TrainingConfig)
    output: OutputConfig = Field(default_factory=OutputConfig)
    system: SystemConfig = Field(default_factory=SystemConfig)
    api: APIConfig = Field(default_factory=APIConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    features: FeaturesConfig = Field(default_factory=FeaturesConfig)
    grammar: GrammarConfig = Field(default_factory=GrammarConfig)
    cli: CLIConfig = Field(default_factory=CLIConfig)
    
    # Environment variables
    config_file: str = Field(default="config.yaml", env="CIPAS_AI_CONFIG_FILE")
    redis_url: str = Field(default="redis://localhost:6379", env="CIPAS_AI_REDIS_URL")
    log_level: str = Field(default="INFO", env="CIPAS_AI_LOG_LEVEL")
    
    class Config:
        env_prefix = "CIPAS_AI_"
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._load_yaml_config()
    
    def _load_yaml_config(self):
        """Load configuration from YAML file"""
        config_path = Path(self.config_file)
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    yaml_data = yaml.safe_load(f)
                
                logger.info(f"Loading configuration from {config_path}")
                
                # Update configurations from YAML
                if 'datasets' in yaml_data:
                    self.datasets = DatasetConfig(**yaml_data['datasets'])
                if 'models' in yaml_data:
                    self.models = ModelsConfig(**yaml_data['models'])
                if 'training' in yaml_data:
                    self.training = TrainingConfig(**yaml_data['training'])
                if 'output' in yaml_data:
                    self.output = OutputConfig(**yaml_data['output'])
                if 'system' in yaml_data:
                    self.system = SystemConfig(**yaml_data['system'])
                if 'api' in yaml_data:
                    self.api = APIConfig(**yaml_data['api'])
                if 'logging' in yaml_data:
                    self.logging = LoggingConfig(**yaml_data['logging'])
                if 'features' in yaml_data:
                    self.features = FeaturesConfig(**yaml_data['features'])
                if 'grammar' in yaml_data:
                    self.grammar = GrammarConfig(**yaml_data['grammar'])
                if 'cli' in yaml_data:
                    cli_data = yaml_data['cli']
                    self.cli = CLIConfig(
                        train=CLITrainConfig(**cli_data.get('train', {})),
                        evaluate=CLIEvaluateConfig(**cli_data.get('evaluate', {})),
                    )
                    
            except Exception as e:
                logger.warning(f"Failed to load YAML config: {e}. Using defaults.")
        else:
            logger.warning(f"Config file {config_path} not found. Using defaults.")
    
    def get_dataset_path(self, dataset_name: str, split: str) -> Optional[str]:
        """Get path for a specific dataset and split"""
        if dataset_name not in self.datasets.available:
            return None
        
        splits = self.datasets.available[dataset_name]
        if split not in splits:
            return None
            
        return str(Path(self.datasets.base_path) / splits[split])

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

def load_config(config_path: str = "config.yaml") -> Settings:
    """Load configuration from a specific YAML file"""
    settings = Settings(config_file=config_path)
    return settings
    return settings