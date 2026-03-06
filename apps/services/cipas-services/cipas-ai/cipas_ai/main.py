"""
CIPAS-AI FastAPI Application
Main entry point for the AI detection service
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import traceback
import time

from .config.settings import get_settings
from .api.v1 import health, train, evaluate, models

# Configure logging
def setup_logging():
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level),
        format=settings.logging.format
    )

setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    settings = get_settings()
    logger.info("🚀 Starting CIPAS-AI service...")
    logger.info(f"Configuration: {settings.system.device} mode, API on {settings.api.host}:{settings.api.port}")
    logger.info(f"Models directory: {settings.output.models_dir}")
    logger.info(f"Results directory: {settings.output.results_dir}")
    
    # Initialize any global resources here if needed
    yield
    
    logger.info("🛑 Shutting down CIPAS-AI service...")

# Create FastAPI app with lifespan management
def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()
    
    app = FastAPI(
        title="CIPAS-AI",
        description="Code Intelligence and Plagiarism Assessment System - AI Detection API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        logger.info(
            f"{request.method} {request.url.path} - "
            f"{response.status_code} - {process_time:.3f}s"
        )
        return response

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Global exception on {request.url.path}: {exc}")
        logger.error(traceback.format_exc())
        
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "type": "server_error",
                "path": str(request.url.path)
            }
        )

    # Include API routers
    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(train.router, prefix="/api/v1/train", tags=["training"])
    app.include_router(evaluate.router, prefix="/api/v1/evaluate", tags=["evaluation"])
    app.include_router(models.router, prefix="/api/v1/models", tags=["models"])

    @app.get("/")
    async def root():
        """Root endpoint with service information"""
        settings = get_settings()
        return {
            "service": "CIPAS-AI Detection Service",
            "version": "2.0.0",
            "status": "running",
            "device": settings.system.device,
            "endpoints": {
                "docs": "/docs",
                "health": "/api/v1/health",
                "train": "/api/v1/train",
                "evaluate": "/api/v1/evaluate",
                "models": "/api/v1/models"
            }
        }

    return app

# Create app instance
app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "cipas_ai.main:app",
        host=settings.api.host,
        port=settings.api.port,
        reload=settings.api.reload,
        log_level=settings.log_level.lower()
    )