"""
Database connection and session management for CIPAS Syntactics.

- asyncpg pool      → used for all runtime queries (low overhead, native async)
- SQLAlchemy engine → used only for schema creation via run_migrations()
"""

import json
import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from urllib.parse import urlparse, urlunparse

import asyncpg

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv("CIPAS_SYN_DATABASE_URL", os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gradeloop"))

# ── asyncpg runtime pool ────────────────────────────────────────────────────
# Connection pool (initialized on startup)
_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Register JSON codecs so JSONB columns are returned as Python dicts."""
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
        format="text",
    )
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
        format="text",
    )


async def _ensure_database_exists(db_url: str) -> None:
    """Check if database exists and create if missing."""
    parsed = urlparse(db_url)
    db_name = parsed.path.lstrip("/")
    admin_dsn = urlunparse(parsed._replace(path="/postgres"))

    try:
        conn = await asyncpg.connect(admin_dsn)
        try:
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                logger.info(f"Database {db_name} does not exist, creating...")
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"Database {db_name} created successfully.")
        finally:
            await conn.close()
    except Exception as e:
        logger.warning(f"Failed to check/create database: {e}")


async def init_db_pool() -> None:
    """Initialize the database connection pool."""
    global _pool
    if _pool is None:
        logger.info("Initializing database connection pool...")
        await _ensure_database_exists(DATABASE_URL)
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
            init=_init_connection,
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
