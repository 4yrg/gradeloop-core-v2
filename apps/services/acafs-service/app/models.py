"""SQLAlchemy ORM models for ACAFS Service.

Used exclusively for schema creation via Base.metadata.create_all().
All runtime queries continue to use asyncpg for performance.

Note: ALTER TABLE ADD COLUMN IF NOT EXISTS statements for columns added
after initial deployment are handled separately in postgres_client.py
via _run_column_migrations(), which is safe to call repeatedly.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AcafsResult(Base):
    __tablename__ = "acafs_results"
    __table_args__ = (
        Index("idx_acafs_submission_id", "submission_id"),
        Index("idx_acafs_assignment_id", "assignment_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(PG_UUID(as_uuid=True), nullable=False, unique=True)
    assignment_id = Column(PG_UUID(as_uuid=True), nullable=False)
    language = Column(Text, nullable=False)
    ast_blueprint = Column(JSONB, nullable=False)
    extraction_status = Column(Text, server_default=text("'success'"))
    parse_failure = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    # Columns added post-initial-deployment (also kept in _run_column_migrations)
    structured_feedback = Column(JSONB)
    instructor_override_score = Column(Numeric(6, 2))
    instructor_holistic_feedback = Column(Text)
    override_by = Column(Text)
    overridden_at = Column(DateTime(timezone=True))


class SubmissionGrade(Base):
    __tablename__ = "submission_grades"
    __table_args__ = (
        Index("idx_grades_submission_id", "submission_id"),
        Index("idx_grades_assignment_id", "assignment_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(PG_UUID(as_uuid=True), nullable=False, unique=True)
    assignment_id = Column(PG_UUID(as_uuid=True), nullable=False)
    total_score = Column(Numeric(6, 2), nullable=False)
    max_total_score = Column(Numeric(6, 2), nullable=False)
    holistic_feedback = Column(Text, nullable=False)
    grading_metadata = Column(JSONB)
    graded_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    # Columns added post-initial-deployment (also kept in _run_column_migrations)
    structured_feedback = Column(JSONB)
    instructor_override_score = Column(Numeric(6, 2))
    instructor_holistic_feedback = Column(Text)
    override_by = Column(Text)
    overridden_at = Column(DateTime(timezone=True))


class SubmissionCriterionScore(Base):
    __tablename__ = "submission_criteria_scores"
    __table_args__ = (
        Index("idx_criteria_submission_id", "submission_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("submission_grades.submission_id", ondelete="CASCADE"),
        nullable=False,
    )
    criterion_name = Column(Text, nullable=False)
    score = Column(Numeric(6, 2), nullable=False)
    max_score = Column(Numeric(6, 2), nullable=False)
    grading_mode = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    # Columns added post-initial-deployment (also kept in _run_column_migrations)
    band_selected = Column(Text)
    confidence = Column(Numeric(3, 2))
    instructor_override_score = Column(Numeric(6, 2))
    instructor_override_reason = Column(Text)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index(
            "idx_one_active_session",
            "assignment_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index("idx_chat_sessions_assignment_user", "assignment_id", "user_id"),
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    assignment_id = Column(PG_UUID(as_uuid=True), nullable=False)
    user_id = Column(Text, nullable=False)
    status = Column(Text, nullable=False, server_default=text("'active'"))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    closed_at = Column(DateTime(timezone=True))
    closed_reason = Column(Text)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("idx_chat_messages_session_id", "session_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    reasoning_details = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
