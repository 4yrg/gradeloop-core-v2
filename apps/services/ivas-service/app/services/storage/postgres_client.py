"""PostgreSQL client for IVAS Service."""

from urllib.parse import urlparse

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
