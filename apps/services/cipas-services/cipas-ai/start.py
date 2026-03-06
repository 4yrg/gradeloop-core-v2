#!/usr/bin/env python3
"""
Start the CIPAS-AI FastAPI service
Usage: python start.py [--host 0.0.0.0] [--port 8000] [--reload]
"""

import argparse
import uvicorn
import sys
from pathlib import Path

# Add the cipas_ai package to path
sys.path.insert(0, str(Path(__file__).parent))

from cipas_ai.main import app
from cipas_ai.config.settings import get_settings

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Start CIPAS-AI FastAPI service")
    
    parser.add_argument(
        "--host", 
        type=str, 
        default=None,
        help="Host to bind to (default: from config)"
    )
    
    parser.add_argument(
        "--port", 
        type=int, 
        default=None,
        help="Port to bind to (default: from config)"
    )
    
    parser.add_argument(
        "--reload", 
        action="store_true",
        help="Enable auto-reload for development"
    )
    
    parser.add_argument(
        "--workers", 
        type=int, 
        default=1,
        help="Number of worker processes (default: 1)"
    )
    
    return parser.parse_args()

def main():
    """Main function to start the FastAPI server"""
    args = parse_args()
    
    # Load settings
    settings = get_settings()
    
    # Use command line args or fall back to config
    host = args.host or settings.api.host
    port = args.port or settings.api.port
    
    print(f"🚀 Starting CIPAS-AI service on {host}:{port}")
    print(f"📚 API Documentation: http://{host}:{port}/docs")
    print(f"🔧 Configuration: {settings.system.device} mode")
    
    # Start the server
    uvicorn.run(
        "cipas_ai.main:app",
        host=host,
        port=port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        log_level="info"
    )

if __name__ == "__main__":
    main()