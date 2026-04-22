"""
Database Client Module
PostgreSQL persistence for biometric templates, auth events, and session archives
"""

import json
import os
import pickle
from contextlib import contextmanager
from datetime import datetime, timedelta

import numpy as np
import psycopg2
import psycopg2.pool
from psycopg2 import extras
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


class DatabaseClient:
    """
    PostgreSQL client for keystroke service persistence
    Uses connection pooling for concurrent access
    """

    def __init__(self, database_url: str = None, min_conn: int = 2, max_conn: int = 10):
        """
        Initialize database connection pool

        Args:
            database_url: PostgreSQL connection string (from env if not provided)
            min_conn: Minimum connections in pool
            max_conn: Maximum connections in pool
        """
        self.database_url = (
            database_url or os.getenv("KEYSTROKE_DATABASE_URL") or os.getenv("DATABASE_URL")
        )

        if not self.database_url:
            print("⚠️  DATABASE_URL not configured - database features disabled")
            self.pool = None
            self.enabled = False
            return

        try:
            self._ensure_database_exists()

            # Create connection pool
            self.pool = psycopg2.pool.ThreadedConnectionPool(min_conn, max_conn, self.database_url)
            self.enabled = True
            print(f"✅ Database connection pool initialized ({min_conn}-{max_conn} connections)")

            # Run schema initialization
            self._initialize_schema()

        except Exception as e:
            print(f"❌ Failed to initialize database: {e}")
            self.pool = None
            self.enabled = False

    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        if not self.enabled:
            raise RuntimeError("Database not enabled")

        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            self.pool.putconn(conn)

    def _ensure_database_exists(self):
        """Check if database exists and create if missing."""
        from urllib.parse import urlparse, urlunparse

        parsed = urlparse(self.database_url)
        db_name = parsed.path.lstrip("/")
        admin_dsn = urlunparse(parsed._replace(path="/postgres"))

        try:
            conn = psycopg2.connect(admin_dsn)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                exists = cursor.fetchone()
                if not exists:
                    print(f"ℹ️ Database {db_name} does not exist, creating...")
                    cursor.execute(f'CREATE DATABASE "{db_name}"')
                    print(f"✅ Database {db_name} created successfully.")
            conn.close()
        except Exception as e:
            print(f"⚠️ Failed to check/create database: {e}")

    def _initialize_schema(self):
        """Initialize database schema and run idempotent migrations"""
        try:
            schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
            if not os.path.exists(schema_path):
                print("⚠️  schema.sql not found - run manually")
                return

            with open(schema_path) as f:
                schema_sql = f.read()

            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    # schema.sql uses CREATE TABLE IF NOT EXISTS and ALTER TABLE
                    # ADD COLUMN IF NOT EXISTS throughout, so it is fully idempotent
                    # and safe to execute on every startup — fresh or existing DB.
                    cursor.execute(schema_sql)
            print("✅ Database schema initialised / migrations applied")
        except Exception as e:
            print(f"⚠️  Schema initialization error: {e}")

    # ==================== User Biometrics ====================

    def save_template(
        self,
        user_id: str,
        phase: str,
        template: np.ndarray,
        template_std: np.ndarray = None,
        sample_count: int = 1,
        metadata: dict = None,
    ) -> bool:
        """
        Save or update user biometric template for a specific enrollment phase

        Args:
            user_id: User identifier
            phase: Enrollment phase ('baseline', 'transcription', 'stress', 'cognitive')
            template: 128-dim numpy array embedding
            template_std: Standard deviation vector (optional)
            sample_count: Number of sequences used
            metadata: Additional metadata (device info, etc.)

        Returns:
            True if successful
        """
        if not self.enabled:
            return False

        try:
            # Serialize numpy arrays
            template_bytes = pickle.dumps(template)
            std_bytes = pickle.dumps(template_std) if template_std is not None else None
            metadata_json = json.dumps(metadata) if metadata else None

            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO user_biometrics
                            (user_id, enrollment_phase, template_data, template_std,
                             sample_count, metadata, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (user_id, enrollment_phase)
                        DO UPDATE SET
                            template_data = EXCLUDED.template_data,
                            template_std = EXCLUDED.template_std,
                            sample_count = EXCLUDED.sample_count,
                            metadata = EXCLUDED.metadata,
                            updated_at = EXCLUDED.updated_at
                    """,
                        (
                            user_id,
                            phase,
                            template_bytes,
                            std_bytes,
                            sample_count,
                            metadata_json,
                            datetime.now(),
                        ),
                    )

            print(f"✅ Saved {phase} template for user {user_id}")
            return True

        except Exception as e:
            print(f"❌ Error saving template: {e}")
            return False

    def load_templates(self, user_id: str) -> dict[str, dict]:
        """
        Load all enrollment phase templates for a user

        Args:
            user_id: User identifier

        Returns:
            Dict of {phase: {template, std, sample_count, created_at}}
        """
        if not self.enabled:
            return {}

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute(
                        """
                        SELECT enrollment_phase, template_data, template_std,
                               sample_count, created_at, updated_at
                        FROM user_biometrics
                        WHERE user_id = %s AND is_active = TRUE
                    """,
                        (user_id,),
                    )

                    rows = cursor.fetchall()

                    templates = {}
                    for row in rows:
                        templates[row["enrollment_phase"]] = {
                            "template": pickle.loads(row["template_data"]),
                            "std": (
                                pickle.loads(row["template_std"]) if row["template_std"] else None
                            ),
                            "sample_count": row["sample_count"],
                            "created_at": row["created_at"],
                            "updated_at": row["updated_at"],
                        }

                    return templates

        except Exception as e:
            print(f"❌ Error loading templates: {e}")
            return {}

    def load_all_templates(self) -> dict[str, dict[str, dict]]:
        """
        Load all user templates (for service initialization)

        Returns:
            Dict of {user_id: {phase: {template, std, ...}}}
        """
        if not self.enabled:
            return {}

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute("""
                        SELECT user_id, enrollment_phase, template_data, template_std, sample_count
                        FROM user_biometrics
                        WHERE is_active = TRUE
                    """)

                    rows = cursor.fetchall()

                    all_templates = {}
                    for row in rows:
                        user_id = row["user_id"]
                        phase = row["enrollment_phase"]

                        if user_id not in all_templates:
                            all_templates[user_id] = {}

                        all_templates[user_id][phase] = {
                            "template": pickle.loads(row["template_data"]),
                            "std": (
                                pickle.loads(row["template_std"]) if row["template_std"] else None
                            ),
                            "sample_count": row["sample_count"],
                        }

                    print(f"✅ Loaded templates for {len(all_templates)} users")
                    return all_templates

        except Exception as e:
            print(f"❌ Error loading all templates: {e}")
            return {}

    def get_enrolled_users(self) -> list[str]:
        """Get list of all enrolled users"""
        if not self.enabled:
            return []

        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT DISTINCT user_id
                        FROM user_biometrics
                        WHERE is_active = TRUE
                    """)
                    return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"❌ Error getting enrolled users: {e}")
            return []

    # ==================== Enrollment Progress ====================

    def update_enrollment_progress(self, user_id: str, phase: str) -> bool:
        """
        Update enrollment progress for a user

        Args:
            user_id: User identifier
            phase: Completed phase name
        """
        if not self.enabled:
            return False

        try:
            phase_mapping = {
                "baseline": "baseline_complete",
                "transcription": "transcription_complete",
                "stress": "stress_complete",
                "cognitive": "cognitive_complete",
            }

            column = phase_mapping.get(phase)
            if not column:
                return False

            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Insert or update progress
                    cursor.execute(
                        f"""
                        INSERT INTO enrollment_progress (user_id, {column}, {column[:-9]}_completed_at, total_sessions)
                        VALUES (%s, TRUE, %s, 1)
                        ON CONFLICT (user_id) DO UPDATE SET
                            {column} = TRUE,
                            {column[:-9]}_completed_at = %s,
                            total_sessions = enrollment_progress.total_sessions + 1
                    """,
                        (user_id, datetime.now(), datetime.now()),
                    )

                    # Update per-phase enrollment_complete flag based solely on
                    # config-required phases. We read REQUIRED_PHASES from env
                    # (same source as main.py) so the DB flag stays in sync even
                    # when the config changes.
                    import json as _json
                    import os as _os

                    _config_path = _os.path.join(
                        _os.path.dirname(__file__), "enrollment_tasks.json"
                    )
                    try:
                        with open(_config_path) as _f:
                            _cfg = _json.load(_f)
                        _required = _cfg.get("enrollment_instructions", {}).get(
                            "phases_required", ["baseline", "transcription", "stress", "cognitive"]
                        )
                    except Exception:
                        _required = ["baseline", "transcription", "stress", "cognitive"]

                    # Build a dynamic WHERE clause that only checks required phases
                    _phase_checks = " AND ".join(f"{p}_complete" for p in _required)
                    cursor.execute(
                        f"""
                        UPDATE enrollment_progress
                        SET enrollment_complete = TRUE,
                            enrollment_completed_at = %s
                        WHERE user_id = %s
                          AND {_phase_checks}
                          AND enrollment_complete = FALSE
                    """,
                        (datetime.now(), user_id),
                    )

            return True

        except Exception as e:
            print(f"❌ Error updating enrollment progress: {e}")
            return False

    def get_enrollment_progress(self, user_id: str) -> dict | None:
        """Get enrollment progress for a user"""
        if not self.enabled:
            return None

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute(
                        """
                        SELECT * FROM enrollment_progress WHERE user_id = %s
                    """,
                        (user_id,),
                    )
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print(f"❌ Error getting enrollment progress: {e}")
            return None

    # ==================== Authentication Events ====================

    def log_auth_event(
        self,
        user_id: str,
        session_id: str,
        offset_seconds: int,
        similarity_score: float,
        risk_score: float,
        authenticated: bool,
        assignment_id: str = None,
        course_id: str = None,
        anomaly_type: str = None,
        is_struggling: bool = False,
        matched_phase: str = None,
        metadata: dict = None,
    ) -> bool:
        """
        Log authentication event for timeline tracking

        Args:
            user_id: User identifier
            session_id: Session identifier
            offset_seconds: Time into session (for timeline)
            similarity_score: Cosine similarity (0-1)
            risk_score: Risk score (0-1)
            authenticated: Authentication result
            assignment_id: Assignment ID (optional)
            course_id: Course ID (optional)
            anomaly_type: Type of anomaly detected (optional)
            is_struggling: Behavioral analysis flag
            matched_phase: Which enrollment phase matched
            metadata: Additional metadata

        Returns:
            True if successful
        """
        if not self.enabled:
            return False

        try:
            # Determine confidence level
            if similarity_score >= 0.8:
                confidence = "HIGH"
            elif similarity_score >= 0.6:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"

            is_anomaly = anomaly_type is not None
            metadata_json = json.dumps(metadata) if metadata else None

            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO auth_events
                            (user_id, session_id, assignment_id, course_id, offset_seconds,
                             similarity_score, risk_score, authenticated, confidence_level,
                             is_anomaly, anomaly_type, is_struggling, matched_phase, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                        (
                            user_id,
                            session_id,
                            assignment_id,
                            course_id,
                            offset_seconds,
                            similarity_score,
                            risk_score,
                            authenticated,
                            confidence,
                            is_anomaly,
                            anomaly_type,
                            is_struggling,
                            matched_phase,
                            metadata_json,
                        ),
                    )

            return True

        except Exception as e:
            print(f"❌ Error logging auth event: {e}")
            return False

    def get_session_timeline(self, session_id: str) -> list[dict]:
        """Get authentication event timeline for a session"""
        if not self.enabled:
            return []

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute(
                        """
                        SELECT event_id, user_id, offset_seconds, event_timestamp,
                               similarity_score, risk_score, authenticated, confidence_level,
                               is_anomaly, anomaly_type, is_struggling, matched_phase
                        FROM auth_events
                        WHERE session_id = %s
                        ORDER BY offset_seconds ASC
                    """,
                        (session_id,),
                    )

                    return [dict(row) for row in cursor.fetchall()]

        except Exception as e:
            print(f"❌ Error getting session timeline: {e}")
            return []

    # ==================== Session Archiving ====================

    def archive_session(
        self,
        user_id: str,
        session_id: str,
        events: list[dict],
        assignment_id: str = None,
        course_id: str = None,
        final_code: str = None,
        behavioral_analysis: dict = None,
        retention_days: int = 365,
    ) -> bool:
        """
        Archive completed session for forensic review

        Args:
            user_id: User identifier
            session_id: Session identifier
            events: List of keystroke events
            assignment_id: Assignment ID
            course_id: Course ID
            final_code: Final submitted code
            behavioral_analysis: Cached analysis result
            retention_days: Days to retain (GDPR compliance)

        Returns:
            True if successful
        """
        if not self.enabled:
            return False

        try:
            # Compute summary statistics from auth_events
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            AVG(risk_score) as avg_risk,
                            MAX(risk_score) as max_risk,
                            SUM(CASE WHEN is_anomaly THEN 1 ELSE 0 END) as anomaly_count,
                            SUM(CASE WHEN NOT authenticated THEN 1 ELSE 0 END) as failure_count,
                            MAX(offset_seconds) as duration
                        FROM auth_events
                        WHERE session_id = %s
                    """,
                        (session_id,),
                    )

                    stats = cursor.fetchone()
                    avg_risk = float(stats[0]) if stats[0] else 0.0
                    max_risk = float(stats[1]) if stats[1] else 0.0
                    anomaly_count = int(stats[2]) if stats[2] else 0
                    failure_count = int(stats[3]) if stats[3] else 0
                    duration = int(stats[4]) if stats[4] else 0

                    # Insert archive
                    retention_until = datetime.now() + timedelta(days=retention_days)

                    cursor.execute(
                        """
                        INSERT INTO keystroke_archives
                            (user_id, session_id, assignment_id, course_id, events_json,
                             event_count, session_duration_seconds, average_risk_score,
                             max_risk_score, anomaly_count, authentication_failures,
                             final_code, behavioral_analysis, retention_until)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (session_id) DO NOTHING
                    """,
                        (
                            user_id,
                            session_id,
                            assignment_id,
                            course_id,
                            json.dumps(events, default=str),
                            len(events),
                            duration,
                            avg_risk,
                            max_risk,
                            anomaly_count,
                            failure_count,
                            final_code,
                            json.dumps(behavioral_analysis, default=str),
                            retention_until,
                        ),
                    )

            print(f"✅ Archived session {session_id} ({len(events)} events)")
            return True

        except Exception as e:
            print(f"❌ Error archiving session: {e}")
            return False

    def get_archived_session(self, session_id: str) -> dict | None:
        """Retrieve archived session data"""
        if not self.enabled:
            return None

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute(
                        """
                        SELECT * FROM keystroke_archives WHERE session_id = %s
                    """,
                        (session_id,),
                    )
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print(f"❌ Error retrieving archived session: {e}")
            return None

    def lookup_archive_by_assignment(self, assignment_id: str, user_id: str) -> dict | None:
        """Look up the most recent archived session by assignment_id and user_id"""
        if not self.enabled:
            return None

        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=extras.RealDictCursor) as cursor:
                    cursor.execute(
                        """
                        SELECT session_id, user_id, assignment_id, course_id,
                               event_count, session_duration_seconds,
                               average_risk_score, max_risk_score,
                               anomaly_count, authentication_failures, archived_at
                        FROM keystroke_archives
                        WHERE assignment_id = %s AND user_id = %s
                        ORDER BY archived_at DESC
                        LIMIT 1
                        """,
                        (assignment_id, user_id),
                    )
                    row = cursor.fetchone()
                    return dict(row) if row else None
        except Exception as e:
            print(f"❌ Error looking up archive by assignment: {e}")
            return None

    def update_archive_behavioral_analysis(
        self, session_id: str, behavioral_analysis: dict
    ) -> bool:
        """Cache a newly computed behavioral analysis result in the archive"""
        if not self.enabled:
            return False

        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE keystroke_archives
                        SET behavioral_analysis = %s
                        WHERE session_id = %s
                        """,
                        (json.dumps(behavioral_analysis, default=str), session_id),
                    )
            return True
        except Exception as e:
            print(f"❌ Error updating behavioral analysis cache: {e}")
            return False

    def close(self):
        """Close database connection pool"""
        if self.pool:
            self.pool.closeall()
            print("✅ Database connection pool closed")


# Singleton instance
_db_client = None


def get_db_client() -> DatabaseClient:
    """Get or create database client singleton"""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client
