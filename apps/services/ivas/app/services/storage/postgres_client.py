"""PostgreSQL client for IVAS Service."""

from json import dumps as json_dumps
from json import dumps as json_dumps, loads as json_loads
from urllib.parse import urlparse
from uuid import UUID

import asyncpg

from app.logging_config import get_logger

logger = get_logger(__name__)


class PostgresClient:
    """Async PostgreSQL client with connection pooling."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        """Create connection pool."""
        parsed = urlparse(self._dsn)
        logger.info(
            "postgres_connecting",
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path.lstrip("/"),
        )
        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=2,
            max_size=10,
        )
        logger.info("postgres_connected")

    async def close(self) -> None:
        """Close connection pool."""
        if self._pool:
            await self._pool.close()
            logger.info("postgres_disconnected")

    async def ping(self) -> bool:
        """Check database connectivity."""
        async with self._pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True

    async def ensure_tables(self) -> None:
        """Create tables if they don't exist. Runs legacy schema fixes first."""
        await self._migrate_legacy_schema()
        async with self._pool.acquire() as conn:
            await conn.execute(SCHEMA_SQL)
        logger.info("postgres_schema_ready")

    async def _migrate_legacy_schema(self) -> None:
        """Remove legacy FK constraints from old schema that referenced tables IVAS no longer owns.

        The old IVAS schema had duplicate assignment/question/grading_criteria tables
        with FK constraints. IVAS now only stores assignment_id as a plain UUID
        reference with assignment context in JSONB.
        """
        async with self._pool.acquire() as conn:
            # Drop FK constraints that reference now-removed tables
            for table_name, constraint_name in [
                ("sessions", "sessions_assignment_id_fkey"),
                ("question_instances", "question_instances_question_id_fkey"),
            ]:
                try:
                    await conn.execute(
                        f"ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {constraint_name}"
                    )
                except Exception:
                    pass
            # Drop orphaned tables that are no longer part of IVAS schema
            for table in ("assignments", "questions", "grading_criteria"):
                try:
                    await conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
                except Exception:
                    pass


    # =========================================================================
    # Voice Profiles
    # =========================================================================

    async def get_voice_profile(self, student_id: str) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM voice_profiles WHERE student_id = $1", student_id
            )
            return dict(row) if row else None

    async def upsert_voice_profile(
        self, student_id: str, embedding: bytes, samples_count: int
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO voice_profiles (student_id, embedding, samples_count)
                VALUES ($1, $2, $3)
                ON CONFLICT (student_id) DO UPDATE
                    SET embedding = EXCLUDED.embedding,
                        samples_count = EXCLUDED.samples_count,
                        updated_at = now()
                RETURNING *
                """,
                student_id, embedding, samples_count,
            )
            return dict(row)

    async def delete_voice_profile(self, student_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM voice_profiles WHERE student_id = $1", student_id
            )
            return result == "DELETE 1"

    # =========================================================================
    # Sessions CRUD
    # =========================================================================

    def _parse_session_row(self, row: asyncpg.Record) -> dict:
        """Convert asyncpg row to dict, parsing JSONB strings back to dicts."""
        d = dict(row)
        if isinstance(d.get("assignment_context"), str):
            d["assignment_context"] = json_loads(d["assignment_context"])
        if isinstance(d.get("metadata"), str):
            d["metadata"] = json_loads(d["metadata"])
        return d

    async def create_session(
        self,
        assignment_id: UUID,
        student_id: str,
        assignment_context: dict | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO sessions (assignment_id, student_id, assignment_context)
                VALUES ($1, $2, $3::jsonb)
                RETURNING *
                """,
                assignment_id, student_id, json_dumps(assignment_context or {}),
            )
            return self._parse_session_row(row)

    async def get_session(self, session_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
            return self._parse_session_row(row) if row else None

    async def list_sessions(
        self,
        student_id: str | None = None,
        assignment_id: UUID | None = None,
        status: str | None = None,
    ) -> list[dict]:
        conditions = []
        params: list = []
        if student_id:
            params.append(student_id)
            conditions.append(f"student_id = ${len(params)}")
        if assignment_id:
            params.append(assignment_id)
            conditions.append(f"assignment_id = ${len(params)}")
        if status:
            params.append(status)
            conditions.append(f"status = ${len(params)}")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT * FROM sessions {where} ORDER BY started_at DESC", *params
            )
            return [self._parse_session_row(r) for r in rows]

    async def update_session_status(self, session_id: UUID, status: str) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE sessions
                SET status = $2,
                    completed_at = CASE
                        WHEN $2 IN ('completed', 'abandoned') THEN now()
                        ELSE completed_at
                    END
                WHERE id = $1
                RETURNING *
                """,
                session_id, status,
            )
            return self._parse_session_row(row) if row else None


SCHEMA_SQL = """
-- =============================================================================
-- Viva Sessions
-- Assignment context is stored as JSONB to avoid cross-service FK dependencies
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id       UUID NOT NULL,
    assignment_context  JSONB DEFAULT '{}'::jsonb,
    student_id          TEXT NOT NULL,
    status              TEXT DEFAULT 'initializing'
                        CHECK (status IN ('initializing', 'in_progress', 'paused', 'completed', 'abandoned')),
    total_score         NUMERIC(5,2),
    max_possible        NUMERIC(5,2),
    started_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS question_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    competency      TEXT,
    difficulty      INTEGER DEFAULT 3,
    sequence_num    INTEGER NOT NULL,
    asked_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_instance_id UUID NOT NULL REFERENCES question_instances(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    response_text   TEXT,
    score           NUMERIC(4,1),
    score_justification TEXT,
    evidence_quotes TEXT[],
    misconceptions  TEXT[],
    feedback_text   TEXT,
    input_classification TEXT CHECK (input_classification IN (
        'evaluate', 'teach_and_skip', 'explain_and_reask',
        'clarify_relevance', 'warn_and_reask'
    )),
    audio_ref       TEXT,
    responded_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Voice Authentication
-- =============================================================================

CREATE TABLE IF NOT EXISTS voice_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      TEXT NOT NULL UNIQUE,
    embedding       BYTEA NOT NULL,
    samples_count   INTEGER DEFAULT 0,
    enrolled_at     TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_auth_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_instance_id UUID REFERENCES question_instances(id),
    similarity_score NUMERIC(5,4),
    is_match        BOOLEAN,
    confidence      TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    audio_ref       TEXT,
    checked_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Transcripts
-- =============================================================================

CREATE TABLE IF NOT EXISTS transcripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_number     INTEGER NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('examiner', 'student')),
    content         TEXT NOT NULL,
    audio_ref       TEXT,
    timestamp       TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_assignment ON sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_question_instances_session ON question_instances(session_id);
CREATE INDEX IF NOT EXISTS idx_student_responses_session ON student_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_student ON voice_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_voice_auth_events_session ON voice_auth_events(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
"""
