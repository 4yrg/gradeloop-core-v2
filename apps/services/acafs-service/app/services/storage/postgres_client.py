"""PostgreSQL client for AST blueprint persistence."""

import json
from contextlib import asynccontextmanager
from typing import Optional
from uuid import UUID

import asyncpg

from app.logging_config import get_logger
from app.schemas import ASTBlueprint

logger = get_logger(__name__)


class PostgresClient:
    """Async PostgreSQL client for ACAFS data persistence."""

    def __init__(self, dsn: str):
        """Initialize PostgreSQL client.
        
        Args:
            dsn: PostgreSQL connection string
        """
        self.dsn = dsn
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        """Initialize connection pool."""
        self._pool = await asyncpg.create_pool(
            self.dsn,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        logger.info("postgres_pool_created")

    async def close(self) -> None:
        """Close connection pool."""
        if self._pool:
            await self._pool.close()
            logger.info("postgres_pool_closed")

    async def ensure_tables(self) -> None:
        """Ensure required tables exist."""
        async with self._get_connection() as conn:
            # Create acafs_results table for storing AST blueprints
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS acafs_results (
                    id SERIAL PRIMARY KEY,
                    submission_id UUID NOT NULL UNIQUE,
                    assignment_id UUID NOT NULL,
                    language VARCHAR(50) NOT NULL,
                    ast_blueprint JSONB NOT NULL,
                    extraction_status VARCHAR(50) DEFAULT 'success',
                    parse_failure JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            # Create index for faster lookups
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_acafs_submission_id 
                ON acafs_results(submission_id)
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_acafs_assignment_id 
                ON acafs_results(assignment_id)
            """)
            
            logger.info("acafs_tables_ensured")

    @asynccontextmanager
    async def _get_connection(self):
        """Get a connection from the pool."""
        if not self._pool:
            raise RuntimeError("PostgreSQL pool not initialized. Call connect() first.")
        
        async with self._pool.acquire() as conn:
            yield conn

    async def store_ast_blueprint(
        self,
        submission_id: UUID,
        assignment_id: UUID,
        language: str,
        blueprint: ASTBlueprint,
    ) -> None:
        """Store AST blueprint in database.
        
        Args:
            submission_id: UUID of the submission
            assignment_id: UUID of the assignment
            language: Programming language
            blueprint: AST blueprint to store
        """
        async with self._get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO acafs_results 
                    (submission_id, assignment_id, language, ast_blueprint, extraction_status)
                VALUES ($1, $2, $3, $4, 'success')
                ON CONFLICT (submission_id) 
                DO UPDATE SET
                    ast_blueprint = EXCLUDED.ast_blueprint,
                    language = EXCLUDED.language,
                    extraction_status = EXCLUDED.extraction_status,
                    updated_at = NOW()
                """,
                submission_id,
                assignment_id,
                language,
                json.dumps(blueprint.model_dump()),
            )
            logger.info(
                "ast_blueprint_stored",
                submission_id=str(submission_id),
                language=language,
            )

    async def store_parse_failure(
        self,
        submission_id: UUID,
        assignment_id: UUID,
        language: str,
        failure_reason: str,
        error_details: Optional[dict] = None,
    ) -> None:
        """Store parse failure information.
        
        Args:
            submission_id: UUID of the submission
            assignment_id: UUID of the assignment
            language: Programming language attempted
            failure_reason: High-level failure description
            error_details: Additional error context
        """
        parse_failure = {
            "reason": failure_reason,
            "details": error_details or {},
        }
        
        async with self._get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO acafs_results 
                    (submission_id, assignment_id, language, ast_blueprint, extraction_status, parse_failure)
                VALUES ($1, $2, $3, '{}', 'parse_failed', $4)
                ON CONFLICT (submission_id) 
                DO UPDATE SET
                    extraction_status = EXCLUDED.extraction_status,
                    parse_failure = EXCLUDED.parse_failure,
                    updated_at = NOW()
                """,
                submission_id,
                assignment_id,
                language,
                json.dumps(parse_failure),
            )
            logger.info(
                "parse_failure_stored",
                submission_id=str(submission_id),
                language=language,
                reason=failure_reason,
            )

    async def get_ast_blueprint(self, submission_id: UUID) -> Optional[ASTBlueprint]:
        """Retrieve AST blueprint by submission ID.
        
        Args:
            submission_id: UUID of the submission
            
        Returns:
            ASTBlueprint if found, None otherwise
        """
        async with self._get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT ast_blueprint 
                FROM acafs_results 
                WHERE submission_id = $1 AND extraction_status = 'success'
                """,
                submission_id,
            )
            
            if row:
                return ASTBlueprint.model_validate_json(row["ast_blueprint"])
            return None

    async def get_rubric_config(self, assignment_id: UUID) -> Optional[dict]:
        """Retrieve rubric configuration for an assignment.
        
        Args:
            assignment_id: UUID of the assignment
            
        Returns:
            Rubric configuration dict if found, None otherwise
        """
        async with self._get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT rubric_config, rubric_version
                FROM assignments
                WHERE id = $1 AND is_active = true
                """,
                assignment_id,
            )
            
            if row and row["rubric_config"]:
                import json
                config = json.loads(row["rubric_config"])
                config["version"] = row["rubric_version"]
                return config
            return None

    async def store_evaluation_results(
        self,
        submission_id: UUID,
        criteria_breakdown: dict,
        total_score: int,
        rubric_version_id: int = 1,
    ) -> None:
        """Store evaluation results including criteria breakdown.
        
        Args:
            submission_id: UUID of the submission
            criteria_breakdown: Scoring breakdown per dimension
            total_score: Final computed score
            rubric_version_id: Version of rubric used
        """
        import json
        
        async with self._get_connection() as conn:
            await conn.execute(
                """
                UPDATE submissions
                SET criteria_breakdown = $1,
                    total_score = $2,
                    rubric_version_id = $3,
                    updated_at = NOW()
                WHERE id = $4
                """,
                json.dumps(criteria_breakdown),
                total_score,
                rubric_version_id,
                submission_id,
            )
            logger.info(
                "evaluation_results_stored",
                submission_id=str(submission_id),
                total_score=total_score,
            )

    async def store_acafs_evaluation(
        self,
        submission_id: UUID,
        assignment_id: UUID,
        criteria_breakdown: dict,
        total_score: int,
        semantic_feedback: Optional[dict] = None,
    ) -> None:
        """Store complete ACAFS evaluation results.
        
        Args:
            submission_id: UUID of the submission
            assignment_id: UUID of the assignment
            criteria_breakdown: Scoring breakdown per dimension
            total_score: Final computed score
            semantic_feedback: Optional LLM-generated feedback
        """
        import json
        
        async with self._get_connection() as conn:
            # Create acafs_evaluations table if not exists
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS acafs_evaluations (
                    id SERIAL PRIMARY KEY,
                    submission_id UUID NOT NULL UNIQUE,
                    assignment_id UUID NOT NULL,
                    criteria_breakdown JSONB NOT NULL,
                    total_score INTEGER NOT NULL,
                    semantic_feedback JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            await conn.execute(
                """
                INSERT INTO acafs_evaluations 
                    (submission_id, assignment_id, criteria_breakdown, total_score, semantic_feedback)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (submission_id) 
                DO UPDATE SET
                    criteria_breakdown = EXCLUDED.criteria_breakdown,
                    total_score = EXCLUDED.total_score,
                    semantic_feedback = EXCLUDED.semantic_feedback,
                    updated_at = NOW()
                """,
                submission_id,
                assignment_id,
                json.dumps(criteria_breakdown),
                total_score,
                json.dumps(semantic_feedback) if semantic_feedback else None,
            )
            logger.info(
                "acafs_evaluation_stored",
                submission_id=str(submission_id),
                total_score=total_score,
            )
