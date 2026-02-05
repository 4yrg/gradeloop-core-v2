"""
Example: Integrating Vault secrets into a Python service (FastAPI)
"""

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from redis import Redis

# Add shared libs to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../shared/libs/py"))

from secrets import VaultClient


# Application state
class AppState:
    """Global application state."""
    vault_client: VaultClient = None
    db_engine = None
    redis_client: Redis = None
    jwt_secret: str = None


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - runs on startup and shutdown."""
    
    # Startup
    print("🚀 Starting application...")
    
    # Initialize Vault client
    print("🔐 Initializing Vault client...")
    state.vault_client = VaultClient()
    
    # Get database configuration
    print("📊 Retrieving database configuration...")
    db_config = state.vault_client.get_database_config()
    state.db_engine = create_engine(db_config.url())
    
    # Test database connection
    with state.db_engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"✅ Database connection established: {result.scalar()}")
    
    # Get Redis configuration
    print("📦 Retrieving Redis configuration...")
    redis_config = state.vault_client.get_redis_config()
    state.redis_client = Redis.from_url(redis_config.url())
    
    # Test Redis connection
    state.redis_client.ping()
    print("✅ Redis connection established")
    
    # Get JWT configuration
    print("🔑 Retrieving JWT configuration...")
    jwt_config = state.vault_client.get_jwt_config()
    state.jwt_secret = jwt_config.secret
    print(f"✅ JWT configuration loaded (algorithm: {jwt_config.algorithm})")
    
    # Get service-specific configuration
    service_name = os.getenv("SERVICE_NAME", "cipas")
    print(f"⚙️  Retrieving configuration for service: {service_name}")
    try:
        service_config = state.vault_client.get_secret_map(f"services/{service_name}")
        print(f"✅ Service configuration loaded: {service_config}")
    except Exception as e:
        print(f"⚠️  Warning: Failed to get service config: {e}")
    
    print("✅ Application started successfully!")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down application...")
    if state.vault_client:
        state.vault_client.close()
    if state.db_engine:
        state.db_engine.dispose()
    if state.redis_client:
        state.redis_client.close()
    print("✅ Cleanup complete")


# Create FastAPI application
app = FastAPI(
    title="GradeLoop Service",
    description="Example service with Vault integration",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check database
        with state.db_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        # Check Redis
        state.redis_client.ping()
        
        return {
            "status": "healthy",
            "database": "connected",
            "redis": "connected",
            "vault": "connected",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")


@app.get("/api/assignments")
async def get_assignments():
    """Example endpoint using database."""
    try:
        with state.db_engine.connect() as conn:
            result = conn.execute(text("SELECT id, title FROM assignments LIMIT 10"))
            assignments = [{"id": row[0], "title": row[1]} for row in result]
        
        return {"assignments": assignments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Example endpoint showing configuration (non-sensitive)."""
    return {
        "service_name": os.getenv("SERVICE_NAME", "unknown"),
        "vault_addr": os.getenv("VAULT_ADDR", "not set"),
        "jwt_algorithm": "HS256",  # Don't expose the actual secret!
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )
