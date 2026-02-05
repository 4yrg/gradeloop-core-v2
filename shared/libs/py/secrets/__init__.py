"""
GradeLoop Secrets Client (Python)

A Python library for securely retrieving secrets from HashiCorp Vault.
"""

from .client import VaultClient, Config, DatabaseConfig, JWTConfig, RedisConfig

__version__ = "1.0.0"
__all__ = [
    "VaultClient",
    "Config",
    "DatabaseConfig",
    "JWTConfig",
    "RedisConfig",
]
