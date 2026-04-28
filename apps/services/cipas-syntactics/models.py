"""SQLAlchemy ORM models for CIPAS Syntactics.

Used exclusively for schema creation via Base.metadata.create_all().
All runtime queries continue to use asyncpg for performance.
Views, functions and composite indexes are registered via SQLAlchemy
DDL events so they are created automatically after tables.
"""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.dialects.postgresql import BYTEA, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import DDL


class Base(DeclarativeBase):
    pass


class AssignmentTemplate(Base):
    __tablename__ = "assignment_templates"
    __table_args__ = (
        Index("idx_assignment_templates_assignment_id", "assignment_id", unique=True),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    assignment_id = Column(Text, nullable=False)
    template_fragment_hashes = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class Fragment(Base):
    __tablename__ = "fragments"
    __table_args__ = (
        CheckConstraint(
            "language IN ('java','python','c','csharp')",
            name="ck_fragments_language",
        ),
        CheckConstraint(
            "fragment_type IN ('structural','window','whole_file','regex_block')",
            name="ck_fragments_fragment_type",
        ),
        Index("idx_fragments_submission_id", "submission_id"),
        Index("idx_fragments_student_id", "student_id"),
        Index("idx_fragments_assignment_id", "assignment_id"),
        Index("idx_fragments_assignment_student", "assignment_id", "student_id"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    submission_id = Column(Text, nullable=False)
    student_id = Column(Text, nullable=False)
    assignment_id = Column(Text, nullable=False)
    language = Column(Text, nullable=False)
    lsh_signature = Column(BYTEA)
    abstract_tokens = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    raw_source = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False, server_default=text("0"))
    byte_offset = Column(Integer, nullable=False, server_default=text("0"))
    fragment_type = Column(Text, nullable=False, server_default=text("'structural'"))
    node_type = Column(Text)
    is_template = Column(Boolean, nullable=False, server_default=text("FALSE"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class PlagiarismGroup(Base):
    __tablename__ = "plagiarism_groups"
    __table_args__ = (Index("idx_plagiarism_groups_assignment", "assignment_id", "group_index"),)

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    assignment_id = Column(Text, nullable=False)
    group_index = Column(Integer, nullable=False)
    member_ids = Column(JSONB, nullable=False)
    edge_summary = Column(JSONB)
    member_count = Column(Integer, nullable=False, server_default=text("0"))
    max_confidence = Column(Float, nullable=False, server_default=text("0.0"))
    dominant_type = Column(Text, nullable=False, server_default=text("'Unknown'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class CloneMatch(Base):
    __tablename__ = "clone_matches"
    __table_args__ = (
        UniqueConstraint("frag_a_id", "frag_b_id", name="uq_clone_matches_pair"),
        CheckConstraint(
            "clone_type IN ('Type-1','Type-2','Type-3','Non-Syntactic')",
            name="ck_clone_matches_clone_type",
        ),
        CheckConstraint(
            "confidence >= 0.0 AND confidence <= 1.0",
            name="ck_clone_matches_confidence_range",
        ),
        Index("idx_clone_matches_assignment", "assignment_id"),
        Index("idx_clone_matches_students", "student_a", "student_b", "assignment_id"),
        Index(
            "idx_clone_matches_is_clone",
            "assignment_id",
            "is_clone",
            postgresql_where=text("is_clone = TRUE"),
        ),
        Index(
            "idx_clone_matches_confidence",
            "assignment_id",
            "confidence",
            postgresql_where=text("is_clone = TRUE"),
        ),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    frag_a_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("fragments.id", ondelete="CASCADE"),
        nullable=False,
    )
    frag_b_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("fragments.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_a = Column(Text, nullable=False)
    student_b = Column(Text, nullable=False)
    assignment_id = Column(Text, nullable=False)
    clone_type = Column(Text, nullable=False, server_default=text("'Non-Syntactic'"))
    confidence = Column(Float, nullable=False, server_default=text("0.0"))
    is_clone = Column(Boolean, nullable=False, server_default=text("FALSE"))
    features = Column(JSONB)
    normalized_code_a = Column(Text)
    normalized_code_b = Column(Text)
    detected_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class LSHBucketMetadata(Base):
    __tablename__ = "lsh_bucket_metadata"
    __table_args__ = (Index("idx_lsh_bucket_metadata_fragment", "fragment_id"),)

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    fragment_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("fragments.id", ondelete="CASCADE"),
        nullable=False,
    )
    bucket_keys = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    num_perm = Column(Integer, nullable=False, server_default=text("128"))
    threshold = Column(Float, nullable=False, server_default=text("0.3"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class SimilarityReport(Base):
    __tablename__ = "similarity_reports"
    __table_args__ = (
        CheckConstraint(
            "language IN ('java','python','c','csharp')",
            name="ck_similarity_reports_language",
        ),
        Index("idx_similarity_reports_assignment", "assignment_id", unique=True),
        Index("idx_similarity_reports_created", "created_at"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    assignment_id = Column(Text, nullable=False)
    language = Column(Text, nullable=False)
    submission_count = Column(Integer, nullable=False, server_default=text("0"))
    processed_count = Column(Integer, nullable=False, server_default=text("0"))
    failed_count = Column(Integer, nullable=False, server_default=text("0"))
    total_clone_pairs = Column(Integer, nullable=False, server_default=text("0"))
    report_data = Column(JSONB, nullable=False)
    lsh_threshold = Column(Float, nullable=False, server_default=text("0.3"))
    min_confidence = Column(Float, nullable=False, server_default=text("0.0"))
    processing_time_seconds = Column(Float)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class InstructorAnnotation(Base):
    __tablename__ = "instructor_annotations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_review','confirmed_plagiarism','false_positive',"
            "'acceptable_collaboration','requires_investigation')",
            name="ck_instructor_annotations_status",
        ),
        CheckConstraint(
            "match_id IS NOT NULL OR group_id IS NOT NULL",
            name="chk_annotation_target",
        ),
        Index("idx_instructor_annotations_match", "match_id"),
        Index("idx_instructor_annotations_group", "group_id"),
        Index("idx_instructor_annotations_assignment", "assignment_id"),
        Index("idx_instructor_annotations_status", "assignment_id", "status"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    match_id = Column(PG_UUID(as_uuid=True), ForeignKey("clone_matches.id", ondelete="CASCADE"))
    group_id = Column(PG_UUID(as_uuid=True), ForeignKey("plagiarism_groups.id", ondelete="CASCADE"))
    assignment_id = Column(Text, nullable=False)
    instructor_id = Column(Text, nullable=False)
    status = Column(Text, nullable=False, server_default=text("'pending_review'"))
    comments = Column(Text)
    action_taken = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class ReportExport(Base):
    __tablename__ = "report_exports"
    __table_args__ = (
        CheckConstraint(
            "export_format IN ('pdf', 'csv', 'json')",
            name="ck_report_exports_format",
        ),
        Index("idx_report_exports_report", "report_id"),
        Index("idx_report_exports_assignment", "assignment_id"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    report_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("similarity_reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    assignment_id = Column(Text, nullable=False)
    instructor_id = Column(Text, nullable=False)
    export_format = Column(Text, nullable=False)
    include_annotations = Column(Boolean, nullable=False, server_default=text("TRUE"))
    include_code = Column(Boolean, nullable=False, server_default=text("FALSE"))
    export_filters = Column(JSONB)
    exported_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


# ── Views & functions — run after all tables are created ───────────────────
# CREATE OR REPLACE is idempotent so safe on every startup restart.
_POST_CREATE_DDL = [
    DDL("""
        CREATE OR REPLACE VIEW confirmed_clones_summary AS
        SELECT cm.assignment_id, cm.student_a, cm.student_b, cm.clone_type, cm.confidence,
               cm.detected_at, f_a.submission_id AS submission_a, f_b.submission_id AS submission_b
        FROM clone_matches cm
        JOIN fragments f_a ON f_a.id = cm.frag_a_id
        JOIN fragments f_b ON f_b.id = cm.frag_b_id
        WHERE cm.is_clone = TRUE
        ORDER BY cm.assignment_id, cm.confidence DESC
    """),
    DDL("""
        CREATE OR REPLACE VIEW annotated_clones_summary AS
        SELECT cm.id AS match_id, cm.assignment_id, cm.student_a, cm.student_b,
               cm.clone_type, cm.confidence, ia.status AS annotation_status,
               ia.comments AS annotation_comments, ia.instructor_id,
               ia.updated_at AS annotated_at, cm.detected_at
        FROM clone_matches cm
        LEFT JOIN instructor_annotations ia ON ia.match_id = cm.id
        WHERE cm.is_clone = TRUE
        ORDER BY cm.assignment_id, cm.confidence DESC
    """),
    DDL("""
        CREATE OR REPLACE FUNCTION get_cluster_stats(p_assignment_id TEXT)
        RETURNS TABLE (
            total_submissions BIGINT, total_clones BIGINT,
            high_risk_count BIGINT, medium_risk_count BIGINT,
            low_risk_count BIGINT, flagged_students BIGINT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                COUNT(DISTINCT f.submission_id),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence >= 0.85),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence >= 0.75 AND cm.confidence < 0.85),
                COUNT(DISTINCT cm.id) FILTER (WHERE cm.is_clone = TRUE AND cm.confidence < 0.75),
                COUNT(DISTINCT CASE WHEN cm.is_clone = TRUE THEN cm.student_a END) +
                COUNT(DISTINCT CASE WHEN cm.is_clone = TRUE THEN cm.student_b END)
            FROM fragments f
            LEFT JOIN clone_matches cm ON (cm.frag_a_id = f.id OR cm.frag_b_id = f.id)
                AND cm.assignment_id = p_assignment_id
            WHERE f.assignment_id = p_assignment_id;
        END;
        $$ LANGUAGE plpgsql
    """),
]

for _ddl in _POST_CREATE_DDL:
    event.listen(Base.metadata, "after_create", _ddl)
