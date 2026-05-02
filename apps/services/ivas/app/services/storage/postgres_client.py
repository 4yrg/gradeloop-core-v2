"""PostgreSQL client for IVAS Service."""

import asyncpg
from json import dumps as json_dumps, loads as json_loads
from urllib.parse import urlparse, urlunparse
from uuid import UUID

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
        db_name = parsed.path.lstrip("/")

        logger.info(
            "postgres_connecting",
            host=parsed.hostname,
            port=parsed.port,
            database=db_name,
        )

        await self._ensure_database_exists(parsed, db_name)

        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=2,
            max_size=10,
        )
        logger.info("postgres_connected")

    async def _ensure_database_exists(self, parsed, db_name: str) -> None:
        """Check if database exists and create if missing."""
        admin_dsn = urlunparse(parsed._replace(path="/postgres"))
        try:
            conn = await asyncpg.connect(admin_dsn)
            try:
                exists = await conn.fetchval(
                    "SELECT 1 FROM pg_database WHERE datname = $1", db_name
                )
                if not exists:
                    logger.info(f"Database {db_name} does not exist, creating...")
                    # asyncpg doesn't support parameterized identifiers, so we use
                    # the connection's quote method to safely escape the name.
                    safe_name = await conn.fetchval("SELECT quote_ident($1)", db_name)
                    await conn.execute(f"CREATE DATABASE {safe_name}")
                    logger.info(f"Database {db_name} created successfully.")
            finally:
                await conn.close()
        except Exception as e:
            logger.warning(f"Failed to check/create database: {e}")

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

            # Add max_score column to question_instances if missing (migration)
            try:
                await conn.execute(
                    "ALTER TABLE question_instances ADD COLUMN IF NOT EXISTS max_score NUMERIC(4,1) DEFAULT 10.0"
                )
            except Exception:
                pass

            # Add 'grading' to the sessions status CHECK constraint
            try:
                await conn.execute(
                    "ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check"
                )
                await conn.execute(
                    "ALTER TABLE sessions ADD CONSTRAINT sessions_status_check "
                    "CHECK (status IN ('initializing', 'in_progress', 'paused', 'grading', 'completed', 'abandoned', 'grading_failed'))"
                )
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
    # Voice Auth Events
    # =========================================================================

    async def insert_voice_auth_event(
        self,
        session_id,
        similarity_score: float | None,
        is_match: bool | None,
        confidence: str | None,
        question_instance_id=None,
        audio_ref: str | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO voice_auth_events
                    (session_id, question_instance_id, similarity_score,
                     is_match, confidence, audio_ref)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                session_id, question_instance_id, similarity_score,
                is_match, confidence, audio_ref,
            )
            return dict(row) if row else {}

    async def list_voice_auth_events(self, session_id) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, session_id, question_instance_id, similarity_score,
                       is_match, confidence, audio_ref, checked_at
                FROM voice_auth_events
                WHERE session_id = $1
                ORDER BY checked_at ASC
                """,
                session_id,
            )
            return [dict(r) for r in rows]

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
        if isinstance(d.get("difficulty_distribution"), str):
            d["difficulty_distribution"] = json_loads(d["difficulty_distribution"])
        return d

    async def create_session(
        self,
        assignment_id: UUID,
        student_id: str,
        assignment_context: dict | None = None,
        difficulty_distribution: dict[int, int] | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO sessions (assignment_id, student_id, assignment_context, difficulty_distribution)
                VALUES ($1, $2, $3::jsonb, $4::jsonb)
                RETURNING *
                """,
                assignment_id,
                student_id,
                json_dumps(assignment_context or {}),
                json_dumps(difficulty_distribution or {}),
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

    async def update_session_metadata(
        self,
        session_id: UUID,
        metadata: dict,
    ) -> dict | None:
        """Replace the session's metadata JSONB column wholesale."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE sessions
                SET metadata = $2::jsonb
                WHERE id = $1
                RETURNING *
                """,
                session_id, json_dumps(metadata),
            )
            return self._parse_session_row(row) if row else None

    async def update_session_score(
        self,
        session_id: UUID,
        total_score: float,
        max_possible: float,
    ) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE sessions
                SET total_score = $2,
                    max_possible = $3
                WHERE id = $1
                RETURNING *
                """,
                session_id, total_score, max_possible,
            )
            return self._parse_session_row(row) if row else None

    async def delete_session(self, session_id: UUID) -> bool:
        """Delete a session and all related records (cascades)."""
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM sessions WHERE id = $1",
                session_id,
            )
            return result == "DELETE 1"

    # =========================================================================
    # Transcripts
    # =========================================================================

    async def save_transcript_turns(
        self,
        session_id: UUID,
        turns: list[dict],
    ) -> None:
        """Bulk upsert transcript turns for a session.

        Each turn is a dict with keys: turn_number, role, content.
        Safe to call with an empty list (no-op).
        Replaces any existing transcript turns for the session (idempotent).
        """
        if not turns:
            logger.info("save_transcripts_skipped_empty", session_id=str(session_id))
            return
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                try:
                    await conn.execute(
                        "DELETE FROM transcripts WHERE session_id = $1",
                        session_id,
                    )
                    # Use execute instead of executemany for better error handling
                    # executemany can fail silently on partial errors
                    for t in turns:
                        await conn.execute(
                            """
                            INSERT INTO transcripts (session_id, turn_number, role, content)
                            VALUES ($1, $2, $3, $4)
                            """,
                            session_id, t["turn_number"], t["role"], t["content"],
                        )
                    logger.info("save_transcripts_success", session_id=str(session_id), count=len(turns))
                except Exception as e:
                    logger.error("save_transcripts_failed", session_id=str(session_id), error=str(e))
                    raise

    async def list_transcripts(self, session_id: UUID) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM transcripts
                WHERE session_id = $1
                ORDER BY turn_number ASC
                """,
                session_id,
            )
            return [dict(r) for r in rows]

    # =========================================================================
    # Graded Q&A (question_instances + student_responses)
    # =========================================================================

    async def save_graded_qa(
        self,
        session_id: UUID,
        graded: list[dict],
        competency_metadata: dict[int, dict] | None = None,
    ) -> None:
        """Persist a list of graded Q&A items for a session.

        Each item is a dict with keys:
            question_text: str
            response_text: str | None
            score: float | None
            max_score: float | None
            score_justification: str | None
            sequence_num: int

        competency_metadata: optional dict mapping sequence_num → {competency_id, competency_name, difficulty}
        for competency tracking. If provided, question_instances are saved with competency info.
        """
        if not graded:
            return
        meta = competency_metadata or {}
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                # Remove any previously graded Q&A for this session (idempotency).
                await conn.execute(
                    """
                    DELETE FROM student_responses
                    WHERE session_id = $1
                    """,
                    session_id,
                )
                await conn.execute(
                    """
                    DELETE FROM question_instances
                    WHERE session_id = $1
                    """,
                    session_id,
                )
                for item in graded:
                    seq = item.get("sequence_num", 1)
                    cmeta = meta.get(seq, {})
                    qi = await conn.fetchrow(
                        """
                        INSERT INTO question_instances
                            (session_id, question_text, sequence_num, competency, difficulty, max_score)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING id
                        """,
                        session_id,
                        item["question_text"],
                        seq,
                        cmeta.get("competency_name"),
                        cmeta.get("difficulty"),
                        item.get("max_score", 10.0),
                    )
                    await conn.execute(
                        """
                        INSERT INTO student_responses
                            (question_instance_id, session_id, response_text,
                             score, score_justification)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        qi["id"],
                        session_id,
                        item.get("response_text"),
                        item.get("score"),
                        item.get("score_justification"),
                    )

    async def list_question_instances(self, session_id: UUID) -> list[dict]:
        """Return raw question_instances rows for a session, in plan order.

        Used by the regrade flow to reconstruct the original plan when the
        session metadata doesn't carry it.
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT sequence_num, question_text, competency, difficulty
                FROM question_instances
                WHERE session_id = $1
                ORDER BY sequence_num ASC
                """,
                session_id,
            )
            return [dict(r) for r in rows]

    async def list_graded_qa(self, session_id: UUID) -> list[dict]:
        """Return a list of graded Q&A rows (question joined with response).

        Rows are ordered by sequence_num and include per-question max_score.
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    qi.sequence_num,
                    qi.question_text,
                    qi.max_score,
                    sr.response_text,
                    sr.score,
                    sr.score_justification
                FROM question_instances qi
                LEFT JOIN student_responses sr
                    ON sr.question_instance_id = qi.id
                WHERE qi.session_id = $1
                ORDER BY qi.sequence_num ASC
                """,
                session_id,
            )
            return [dict(r) for r in rows]

    # =========================================================================
    # Assignments
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
                INSERT INTO assignments
                    (title, instructor_id, description, code_context, programming_language, course_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                title, instructor_id, description, code_context, programming_language, course_id,
            )
            return dict(row)

    async def list_assignments(
        self,
        instructor_id: str | None = None,
        course_id: str | None = None,
    ) -> list[dict]:
        conditions = []
        params: list = []
        if instructor_id:
            params.append(instructor_id)
            conditions.append(f"instructor_id = ${len(params)}")
        if course_id:
            params.append(course_id)
            conditions.append(f"course_id = ${len(params)}")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT * FROM assignments {where} ORDER BY created_at DESC", *params,
            )
            return [dict(r) for r in rows]

    async def get_assignment(self, assignment_id: UUID) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM assignments WHERE id = $1", assignment_id,
            )
            return dict(row) if row else None

    async def update_assignment(
        self, assignment_id: UUID, **fields: str | None,
    ) -> dict | None:
        if not fields:
            return await self.get_assignment(assignment_id)
        set_clauses = []
        params: list = []
        for i, (k, v) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{k} = ${i}")
            params.append(v)
        params.append(assignment_id)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE assignments SET {', '.join(set_clauses)}, updated_at = now() "
                f"WHERE id = ${len(params)} RETURNING *",
                *params,
            )
            return dict(row) if row else None

    async def delete_assignment(self, assignment_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM assignments WHERE id = $1", assignment_id,
            )
            return result == "DELETE 1"

    # =========================================================================
    # Grading Criteria
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
                INSERT INTO grading_criteria
                    (assignment_id, competency, description, max_score, weight, difficulty)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                assignment_id, competency, description, max_score, weight, difficulty,
            )
            return dict(row)

    async def list_criteria(self, assignment_id: UUID) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM grading_criteria WHERE assignment_id = $1 ORDER BY created_at ASC",
                assignment_id,
            )
            return [dict(r) for r in rows]

    async def update_criteria(
        self, criteria_id: UUID, **fields: str | float | int | None,
    ) -> dict | None:
        if not fields:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM grading_criteria WHERE id = $1", criteria_id,
                )
                return dict(row) if row else None
        set_clauses = []
        params: list = []
        for i, (k, v) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{k} = ${i}")
            params.append(v)
        params.append(criteria_id)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE grading_criteria SET {', '.join(set_clauses)} "
                f"WHERE id = ${len(params)} RETURNING *",
                *params,
            )
            return dict(row) if row else None

    async def delete_criteria(self, criteria_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM grading_criteria WHERE id = $1", criteria_id,
            )
            return result == "DELETE 1"

    # =========================================================================
    # Questions
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
                INSERT INTO questions
                    (assignment_id, criteria_id, question_text, competency, difficulty, expected_topics)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                assignment_id, criteria_id, question_text, competency, difficulty,
                expected_topics,
            )
            return dict(row)

    async def list_questions(
        self, assignment_id: UUID, status_filter: str | None = None,
    ) -> list[dict]:
        conditions = ["assignment_id = $1"]
        params: list = [assignment_id]
        if status_filter:
            params.append(status_filter)
            conditions.append(f"status = ${len(params)}")
        where = f"WHERE {' AND '.join(conditions)}"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT * FROM questions {where} ORDER BY created_at ASC",
                *params,
            )
            return [dict(r) for r in rows]

    async def update_question(
        self, question_id: UUID, **fields: str | float | int | list | None,
    ) -> dict | None:
        if not fields:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM questions WHERE id = $1", question_id,
                )
                return dict(row) if row else None
        set_clauses = []
        params: list = []
        for i, (k, v) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{k} = ${i}")
            params.append(v)
        params.append(question_id)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE questions SET {', '.join(set_clauses)} "
                f"WHERE id = ${len(params)} RETURNING *",
                *params,
            )
            return dict(row) if row else None

    async def delete_question(self, question_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM questions WHERE id = $1", question_id,
            )
            return result == "DELETE 1"

    async def bulk_update_question_status(
        self, question_ids: list[UUID], new_status: str,
    ) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE questions SET status = $1
                WHERE id = ANY($2::uuid[])
                """,
                new_status, question_ids,
            )
            # result is "UPDATE N" — extract N
            if result.startswith("UPDATE "):
                return int(result.split(" ")[1])
            return 0

    # =========================================================================
    # Competencies
    # =========================================================================

    async def upsert_competency(
        self,
        name: str,
        description: str | None = None,
        difficulty: int = 1,
        max_score: float = 10.0,
    ) -> dict:
        """Insert or update a competency by name. Returns the row."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO competencies (name, description, difficulty, max_score)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (name) DO UPDATE SET
                    description = EXCLUDED.description,
                    difficulty  = EXCLUDED.difficulty,
                    max_score   = EXCLUDED.max_score,
                    updated_at  = now()
                RETURNING *
                """,
                name, description, difficulty, max_score,
            )
            return dict(row)

    async def update_competency(
        self,
        competency_id: UUID,
        name: str,
        description: str | None = None,
        difficulty: int = 1,
        max_score: float = 10.0,
    ) -> dict | None:
        """Update a competency by ID. Returns the row or None if not found."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE competencies
                SET name = $2,
                    description = $3,
                    difficulty = $4,
                    max_score = $5,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                competency_id, name, description, difficulty, max_score,
            )
            return dict(row) if row else None

    async def list_competencies(self) -> list[dict]:
        """Return all competencies ordered by name."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM competencies ORDER BY name ASC"
            )
            return [dict(r) for r in rows]

    async def get_competency_by_name(self, name: str) -> dict | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM competencies WHERE name = $1", name,
            )
            return dict(row) if row else None

    async def delete_competency(self, competency_id: UUID) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM competencies WHERE id = $1", competency_id,
            )
            return result == "DELETE 1"

    # =========================================================================
    # Competency-Assignment linking
    # =========================================================================

    async def set_assignment_competencies(
        self,
        assignment_id: UUID,
        competency_entries: list[dict],
    ) -> list[dict]:
        """Replace all competency links for an assignment.

        competency_entries: [{competency_id: UUID, weight: float}, ...]
        """
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM competency_assignments WHERE assignment_id = $1",
                    assignment_id,
                )
                rows = []
                for entry in competency_entries:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO competency_assignments (assignment_id, competency_id, weight)
                        VALUES ($1, $2, $3)
                        RETURNING *
                        """,
                        assignment_id,
                        entry["competency_id"],
                        entry.get("weight", 1.0),
                    )
                    rows.append(dict(row))
                return rows

    async def list_assignment_competencies(self, assignment_id: UUID) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    ca.id           AS link_id,
                    c.id            AS competency_id,
                    c.name,
                    c.description,
                    c.difficulty,
                    c.max_score,
                    ca.weight
                FROM competency_assignments ca
                JOIN competencies c ON c.id = ca.competency_id
                WHERE ca.assignment_id = $1
                ORDER BY c.name ASC
                """,
                assignment_id,
            )
            return [dict(r) for r in rows]

    # =========================================================================
    # Competency scores
    # =========================================================================

    async def upsert_competency_score(
        self,
        student_id: str,
        competency_id: UUID,
        session_id: UUID | None,
        score: float,
        is_override: bool = False,
        override_by: str | None = None,
    ) -> dict:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO competency_scores
                    (student_id, competency_id, session_id, score, is_override, override_by, override_at)
                VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 THEN now() ELSE NULL END)
                ON CONFLICT (student_id, competency_id, session_id) DO UPDATE SET
                    score       = EXCLUDED.score,
                    is_override = EXCLUDED.is_override,
                    override_by = EXCLUDED.override_by,
                    override_at = CASE WHEN EXCLUDED.is_override THEN now() ELSE competency_scores.override_at END
                RETURNING *
                """,
                student_id, competency_id, session_id, score, is_override, override_by,
            )
            return dict(row)

    async def list_student_competency_scores(
        self,
        student_id: str,
    ) -> list[dict]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT cs.*, c.name AS competency_name, c.difficulty, c.max_score
                FROM competency_scores cs
                JOIN competencies c ON c.id = cs.competency_id
                WHERE cs.student_id = $1
                ORDER BY c.name ASC
                """,
                student_id,
            )
            return [dict(r) for r in rows]

    async def list_competency_scores_for_assignment(
        self,
        assignment_id: UUID,
    ) -> list[dict]:
        """Return competency scores aggregated per student for a given assignment.

        Groups by student + competency and averages the scores across sessions.
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    cs.student_id,
                    cs.competency_id,
                    c.name          AS competency_name,
                    c.difficulty,
                    c.max_score,
                    AVG(cs.score)   AS avg_score,
                    COUNT(cs.session_id) AS session_count,
                    BOOL_OR(cs.is_override) AS has_override
                FROM competency_scores cs
                JOIN competencies c ON c.id = cs.competency_id
                JOIN sessions s ON s.id = cs.session_id
                WHERE s.assignment_id = $1
                GROUP BY cs.student_id, cs.competency_id, c.name, c.difficulty, c.max_score
                ORDER BY cs.student_id, c.name
                """,
                assignment_id,
            )
            return [dict(r) for r in rows]

    async def list_students_by_competency(
        self,
        competency_id: UUID,
        assignment_id: UUID | None = None,
    ) -> list[dict]:
        """Return all students with their scores for a given competency.

        Optionally filter to a specific assignment.
        """
        async with self._pool.acquire() as conn:
            if assignment_id:
                rows = await conn.fetch(
                    """
                    SELECT
                        cs.student_id,
                        c.name          AS competency_name,
                        AVG(cs.score)   AS avg_score,
                        c.max_score,
                        COUNT(cs.session_id) AS session_count,
                        BOOL_OR(cs.is_override) AS has_override
                    FROM competency_scores cs
                    JOIN competencies c ON c.id = cs.competency_id
                    JOIN sessions s ON s.id = cs.session_id
                    WHERE cs.competency_id = $1 AND s.assignment_id = $2
                    GROUP BY cs.student_id, c.name, c.max_score
                    ORDER BY avg_score ASC NULLS LAST
                    """,
                    competency_id, assignment_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT
                        cs.student_id,
                        c.name          AS competency_name,
                        AVG(cs.score)   AS avg_score,
                        c.max_score,
                        COUNT(cs.session_id) AS session_count,
                        BOOL_OR(cs.is_override) AS has_override
                    FROM competency_scores cs
                    JOIN competencies c ON c.id = cs.competency_id
                    WHERE cs.competency_id = $1
                    GROUP BY cs.student_id, c.name, c.max_score
                    ORDER BY avg_score ASC NULLS LAST
                    """,
                    competency_id,
                )
            return [dict(r) for r in rows]

    async def override_competency_score(
        self,
        student_id: str,
        competency_id: UUID,
        new_score: float,
        override_by: str,
    ) -> dict:
        """Override the aggregated competency score for a student (instructor manual correction).

        Uses session_id = NULL as a sentinel for manual overrides.
        """
        async with self._pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id FROM competency_scores
                WHERE student_id = $1 AND competency_id = $2 AND session_id IS NULL
                """,
                student_id, competency_id,
            )
            if existing:
                row = await conn.fetchrow(
                    """
                    UPDATE competency_scores SET
                        score       = $2,
                        is_override = TRUE,
                        override_by = $3,
                        override_at = now()
                    WHERE id = $1
                    RETURNING *
                    """,
                    existing["id"], new_score, override_by,
                )
            else:
                row = await conn.fetchrow(
                    """
                    INSERT INTO competency_scores
                        (student_id, competency_id, session_id, score, is_override, override_by, override_at)
                    VALUES ($1, $2, NULL, $3, TRUE, $4, now())
                    RETURNING *
                    """,
                    student_id, competency_id, new_score, override_by,
                )
            return dict(row)


SCHEMA_SQL = """
-- =============================================================================
-- Viva Sessions
-- Assignment context is stored as JSONB to avoid cross-service FK dependencies
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id           UUID NOT NULL,
    assignment_context      JSONB DEFAULT '{}'::jsonb,
    student_id              TEXT NOT NULL,
    status                  TEXT DEFAULT 'initializing'
                            CHECK (status IN ('initializing', 'in_progress', 'paused', 'grading', 'completed', 'abandoned', 'grading_failed')),
    total_score             NUMERIC(5,2),
    max_possible            NUMERIC(5,2),
    difficulty_distribution JSONB DEFAULT '{}'::jsonb,
    started_at              TIMESTAMPTZ DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    metadata                JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS question_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    competency      TEXT,
    difficulty      INTEGER DEFAULT 3,
    sequence_num    INTEGER NOT NULL,
    max_score       NUMERIC(4,1) DEFAULT 10.0,
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

-- =============================================================================
-- Competencies (reusable, course/assignment-wide conceptual areas)
-- =============================================================================

-- Difficulty levels: 1=beginner, 2=intermediate, 3=advanced, 4=expert, 5=master
CREATE TABLE IF NOT EXISTS competencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                        -- e.g. "Loops", "Recursion"
    description     TEXT,
    difficulty      INTEGER DEFAULT 1
                        CHECK (difficulty BETWEEN 1 AND 5),
    max_score       NUMERIC(4,1) DEFAULT 10.0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name)
);

-- Which competencies are active for a given assignment + their weight
CREATE TABLE IF NOT EXISTS competency_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL,
    competency_id   UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    weight          NUMERIC(3,2) DEFAULT 1.0,  -- importance weight (0.5 = half weight)
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assignment_id, competency_id)
);

-- Per-student per-competency scores across all their viva sessions
-- Also stores instructor override so human judgment can correct AI marks
CREATE TABLE IF NOT EXISTS competency_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id              TEXT NOT NULL,
    competency_id           UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    session_id              UUID REFERENCES sessions(id) ON DELETE SET NULL,
    score                   NUMERIC(4,1),       -- raw score for this session
    is_override             BOOLEAN DEFAULT FALSE,  -- TRUE if manually set by instructor
    override_by             TEXT,               -- instructor who set the override
    override_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, competency_id, session_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_competencies_name ON competencies(name);
CREATE INDEX IF NOT EXISTS idx_competency_assignments_assignment ON competency_assignments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_competency_assignments_competency ON competency_assignments(competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_scores_student ON competency_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_competency_scores_competency ON competency_scores(competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_scores_session ON competency_scores(session_id);

-- =============================================================================
-- Assignments, Grading Criteria, and Questions
-- (IVAS-managed versions for viva setup — not shared with ACAFS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    description         TEXT,
    code_context        TEXT,
    programming_language TEXT DEFAULT 'python',
    course_id           TEXT,
    instructor_id       TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grading_criteria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    competency      TEXT NOT NULL,
    description     TEXT,
    max_score       NUMERIC(4,1) DEFAULT 10.0,
    weight          NUMERIC(3,2) DEFAULT 1.0,
    difficulty      INTEGER DEFAULT 3
                    CHECK (difficulty BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    criteria_id     UUID REFERENCES grading_criteria(id) ON DELETE SET NULL,
    question_text   TEXT NOT NULL,
    competency      TEXT,
    difficulty      INTEGER DEFAULT 3
                    CHECK (difficulty BETWEEN 1 AND 5),
    expected_topics TEXT[],
    status          TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'rejected')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_instructor ON assignments(instructor_id);
CREATE INDEX IF NOT EXISTS idx_grading_criteria_assignment ON grading_criteria(assignment_id);
CREATE INDEX IF NOT EXISTS idx_questions_assignment ON questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_questions_criteria ON questions(criteria_id);
"""
