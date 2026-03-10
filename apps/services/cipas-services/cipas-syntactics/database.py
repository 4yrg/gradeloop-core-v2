"""
Database connection and session management for CIPAS Syntactics.

- asyncpg pool      → used for all runtime queries (low overhead, native async)
- SQLAlchemy engine → used only for schema creation via run_migrations()
"""

import asyncpg
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gradeloop"
)

# ── asyncpg runtime pool ────────────────────────────────────────────────────
# Connection pool (initialized on startup)
_pool: asyncpg.Pool | None = None


async def init_db_pool() -> None:
    """Initialize the database connection pool."""
    global _pool
    if _pool is None:
        logger.info("Initializing database connection pool...")
        _pool = await asyncpg.create_pool(
            DATABASE_URL, min_size=2, max_size=10, command_timeout=60
        )
        logger.info("Database connection pool initialized.")


async def close_db_pool() -> None:
    """Close the database connection pool."""
    global _pool
    if _pool is not None:
        logger.info("Closing database connection pool...")
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed.")


def get_pool() -> asyncpg.Pool:
    """Get the global connection pool."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db_pool() first.")
    return _pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a database connection from the pool."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def get_db_transaction() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a database connection with an active transaction."""
    async with get_db_connection() as conn:
        async with conn.transaction():
            yield conn
