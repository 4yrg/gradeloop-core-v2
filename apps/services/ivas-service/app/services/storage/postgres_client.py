"""PostgreSQL client for IVAS Service."""

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
        """Create tables if they don't exist."""
        async with self._pool.acquire() as conn:
            await conn.execute(SCHEMA_SQL)
        logger.info("postgres_schema_ready")

    # =========================================================================
    # Assignments CRUD
    # =========================================================================

    async def create_assignment(
        self,
        title: str,
        instructor_id: str,
        description: str | None = None,
        code_context: str | None = None,
        programming_language: str = "python",
        course_id: str | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO assignments (title, description, code_context, programming_language,
                                         course_id, instructor_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                title, description, code_context, programming_language, course_id, instructor_id,
            )
            return dict(row)

    async def get_assignment(self, assignment_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM assignments WHERE id = $1", assignment_id)
            return dict(row) if row else None

    async def list_assignments(
        self, instructor_id: str | None = None, course_id: str | None = None
    ) -> list[dict]:
        async with self._pool.acquire() as conn:
            if instructor_id and course_id:
                rows = await conn.fetch(
                    "SELECT * FROM assignments WHERE instructor_id = $1 AND course_id = $2 ORDER BY created_at DESC",
                    instructor_id, course_id,
                )
            elif instructor_id:
                rows = await conn.fetch(
                    "SELECT * FROM assignments WHERE instructor_id = $1 ORDER BY created_at DESC",
                    instructor_id,
                )
            elif course_id:
                rows = await conn.fetch(
                    "SELECT * FROM assignments WHERE course_id = $1 ORDER BY created_at DESC",
                    course_id,
                )
            else:
                rows = await conn.fetch("SELECT * FROM assignments ORDER BY created_at DESC")
            return [dict(r) for r in rows]

    async def update_assignment(self, assignment_id: UUID, **fields) -> dict | None:
        if not fields:
            return await self.get_assignment(assignment_id)
        sets = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields))
        sets += f", updated_at = now()"
        sql = f"UPDATE assignments SET {sets} WHERE id = $1 RETURNING *"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, assignment_id, *fields.values())
            return dict(row) if row else None

    async def delete_assignment(self, assignment_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM assignments WHERE id = $1", assignment_id)
            return result == "DELETE 1"

    # =========================================================================
    # Grading Criteria CRUD
    # =========================================================================

    async def create_criteria(
        self,
        assignment_id: UUID,
        competency: str,
        description: str | None = None,
        max_score: float = 10.0,
        weight: float = 1.0,
        difficulty: int = 3,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO grading_criteria (assignment_id, competency, description,
                                              max_score, weight, difficulty)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                assignment_id, competency, description, max_score, weight, difficulty,
            )
            return dict(row)

    async def list_criteria(self, assignment_id: UUID) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM grading_criteria WHERE assignment_id = $1 ORDER BY created_at",
                assignment_id,
            )
            return [dict(r) for r in rows]

    async def get_criteria(self, criteria_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM grading_criteria WHERE id = $1", criteria_id)
            return dict(row) if row else None

    async def update_criteria(self, criteria_id: UUID, **fields) -> dict | None:
        if not fields:
            return await self.get_criteria(criteria_id)
        sets = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields))
        sql = f"UPDATE grading_criteria SET {sets} WHERE id = $1 RETURNING *"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, criteria_id, *fields.values())
            return dict(row) if row else None

    async def delete_criteria(self, criteria_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM grading_criteria WHERE id = $1", criteria_id)
            return result == "DELETE 1"

    # =========================================================================
    # Questions CRUD
    # =========================================================================

    async def create_question(
        self,
        assignment_id: UUID,
        question_text: str,
        criteria_id: UUID | None = None,
        competency: str | None = None,
        difficulty: int = 3,
        expected_topics: list[str] | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO questions (assignment_id, criteria_id, question_text,
                                       competency, difficulty, expected_topics)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                assignment_id, criteria_id, question_text,
                competency, difficulty, expected_topics,
            )
            return dict(row)

    async def list_questions(
        self, assignment_id: UUID, status_filter: str | None = None
    ) -> list[dict]:
        async with self._pool.acquire() as conn:
            if status_filter:
                rows = await conn.fetch(
                    "SELECT * FROM questions WHERE assignment_id = $1 AND status = $2 ORDER BY created_at",
                    assignment_id, status_filter,
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM questions WHERE assignment_id = $1 ORDER BY created_at",
                    assignment_id,
                )
            return [dict(r) for r in rows]

    async def get_question(self, question_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM questions WHERE id = $1", question_id)
            return dict(row) if row else None

    async def update_question(self, question_id: UUID, **fields) -> dict | None:
        if not fields:
            return await self.get_question(question_id)
        sets = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields))
        sql = f"UPDATE questions SET {sets} WHERE id = $1 RETURNING *"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, question_id, *fields.values())
            return dict(row) if row else None

    async def delete_question(self, question_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM questions WHERE id = $1", question_id)
            return result == "DELETE 1"

    async def bulk_update_question_status(
        self, question_ids: list[UUID], new_status: str
    ) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE questions SET status = $1 WHERE id = ANY($2)",
                new_status, question_ids,
            )
            return int(result.split()[-1])

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

    async def create_session(self, assignment_id: UUID, student_id: str) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO sessions (assignment_id, student_id)
                VALUES ($1, $2)
                RETURNING *
                """,
                assignment_id, student_id,
            )
            return dict(row)

    async def get_session(self, session_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
            return dict(row) if row else None

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
            return [dict(r) for r in rows]

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
            return dict(row) if row else None


SCHEMA_SQL = """
-- =============================================================================
-- Assignments & Question Bank
-- =============================================================================

CREATE TABLE IF NOT EXISTS assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    code_context    TEXT,
    programming_language TEXT DEFAULT 'python',
    course_id       TEXT,
    instructor_id   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grading_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    competency      TEXT NOT NULL,
    description     TEXT,
    max_score       NUMERIC(4,1) DEFAULT 10.0,
    weight          NUMERIC(3,2) DEFAULT 1.0,
    difficulty      INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    criteria_id     UUID REFERENCES grading_criteria(id) ON DELETE SET NULL,
    question_text   TEXT NOT NULL,
    competency      TEXT,
    difficulty      INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    expected_topics TEXT[],
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Viva Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id),
    student_id      TEXT NOT NULL,
    status          TEXT DEFAULT 'initializing'
                    CHECK (status IN ('initializing', 'in_progress', 'paused', 'completed', 'abandoned')),
    total_score     NUMERIC(5,2),
    max_possible    NUMERIC(5,2),
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS question_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id     UUID REFERENCES questions(id),
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
CREATE INDEX IF NOT EXISTS idx_questions_assignment ON questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grading_criteria_assignment ON grading_criteria(assignment_id);
"""
