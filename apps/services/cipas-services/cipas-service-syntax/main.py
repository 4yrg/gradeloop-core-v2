"""
Clone Detection Service - Main Entry Point

Run the FastAPI server:
    python main.py

Or with uvicorn directly:
    uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
"""

import uvicorn

from src.api.main import app

if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
