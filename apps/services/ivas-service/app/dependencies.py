"""FastAPI dependencies.

Separated from app.main to avoid circular imports — route modules need
get_db but main.py imports those same route modules at module level.
"""

from fastapi import HTTPException, status

from app.services.storage.postgres_client import PostgresClient

# Set by the lifespan in app.main after the postgres client is initialized.
postgres_client: PostgresClient | None = None


async def get_db() -> PostgresClient:
    """FastAPI dependency that yields the postgres client."""
    if postgres_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready.",
        )
    return postgres_client