import os
from pathlib import Path
from dotenv import load_dotenv

def load_root_env():
    """Find project root and load environment variables."""
    # Start from current working directory or file location
    path = Path.cwd()
    root = None
    
    # Traverse up to find root marker
    for parent in [path] + list(path.parents):
        if (parent / "turbo.json").exists() or (parent / "package.json").exists():
            root = parent
            break
            
    if root:
        app_env = os.getenv("APP_ENV", "development")
        # Load environment-specific file first, then base .env
        load_dotenv(root / f".env.{app_env}")
        load_dotenv(root / ".env")
        return root
    else:
        # Fallback to local .env if root not found
        load_dotenv()
        return None
