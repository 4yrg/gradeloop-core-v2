"""
Pydantic schemas for the CIPAS Syntactics API.

This module defines request/response models for the syntactic code clone detection API endpoints.
Includes new models for Phase 1–4 pipeline (segmentation, LSH, cascade, collusion graph).
"""

from enum import Enum

from pydantic import BaseModel, Field


class LanguageEnum(str, Enum):
    """Supported programming languages."""

    JAVA = "java"
    C = "c"
    PYTHON = "python"
    CSHARP = "csharp"


class ComparisonRequest(BaseModel):
    """Request model for code comparison."""

    code1: str = Field(..., description="First code snippet to compare", min_length=1)
    code2: str = Field(..., description="Second code snippet to compare", min_length=1)
    language: LanguageEnum = Field(
        default=LanguageEnum.JAVA, description="Programming language of the code"
    )


class SyntacticFeatures(BaseModel):
    """Syntactic similarity features."""

    jaccard_similarity: float = Field(..., description="Jaccard similarity coefficient")
    dice_coefficient: float = Field(..., description="Dice coefficient")
    levenshtein_distance: int = Field(..., description="Levenshtein distance")
    levenshtein_ratio: float = Field(..., description="Levenshtein similarity ratio")
    jaro_similarity: float = Field(..., description="Jaro similarity")
    jaro_winkler_similarity: float = Field(..., description="Jaro-Winkler similarity")


class ComparisonResult(BaseModel):
    """Response model for code comparison."""

    is_clone: bool = Field(..., description="Whether the codes are clones")
    confidence: float = Field(..., description="Confidence score (0-1)")
    clone_type: str | None = Field(None, description="Type of clone detected (Type-1/2/3)")
    pipeline_used: str = Field(
        ...,
        description="Which pipeline was used (Syntactic Cascade Type-1/2/3)",
    )
    normalization_level: str | None = Field(
        None,
        description="Normalization level used (Literal, Blinded, or Token-based)",
    )

    # Optional detailed results
    syntactic_features: SyntacticFeatures | None = Field(None, description="Syntactic features")

    # Additional metadata
    tokens1_count: int | None = Field(None, description="Number of tokens in code1")
    tokens2_count: int | None = Field(None, description="Number of tokens in code2")


class BatchComparisonRequest(BaseModel):
    """Request model for batch code comparison."""

    pairs: list[ComparisonRequest] = Field(
        ..., description="List of code pairs to compare", min_length=1
    )


class BatchComparisonResult(BaseModel):
    """Response model for batch code comparison."""

    results: list[ComparisonResult] = Field(
        ..., description="List of comparison results for each pair"
    )
    total_pairs: int = Field(..., description="Total number of pairs compared")


class ModelStatus(BaseModel):
    """Model availability status."""

    model_config = {"protected_namespaces": ()}

    model_name: str
    available: bool
    loaded: bool = False
    error: str | None = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    service: str = "cipas-syntactics"
    version: str = "0.1.0"
    models: dict[str, ModelStatus] = Field(default_factory=dict, description="Status of ML models")


class FeatureImportanceResponse(BaseModel):
    """Feature importance response."""

    model: str
    features: dict[str, float]


class TokenizeRequest(BaseModel):
    """Request model for tokenization."""

    code: str = Field(..., description="Source code to tokenize", min_length=1)
    language: LanguageEnum = Field(default=LanguageEnum.JAVA, description="Programming language")
    abstract_identifiers: bool = Field(
        default=True, description="Whether to abstract identifiers to 'V'"
    )


class TokenizeResponse(BaseModel):
    """Response model for tokenization."""

    tokens: list[str] = Field(..., description="List of tokens")
    token_count: int = Field(..., description="Number of tokens")
    language: str = Field(..., description="Programming language used")


# ──────────────────────────────────────────────────────────────────────────
# Phase 1–4 Pipeline Schemas
# ──────────────────────────────────────────────────────────────────────────


class SubmissionIngestRequest(BaseModel):
    """Trigger ingestion of a student submission through the full cascade pipeline."""

    submission_id: str = Field(..., description="Unique identifier for the submission")
    student_id: str = Field(..., description="Student ID")
    assignment_id: str = Field(..., description="Assignment ID")
    source_code: str = Field(..., description="Full source code of the submission", min_length=1)
    language: LanguageEnum = Field(default=LanguageEnum.JAVA, description="Programming language")


class CloneMatchSchema(BaseModel):
    """Single clone match result from the cascade."""

    id: str | None = None
    frag_a_id: str
    frag_b_id: str
    student_a: str
    student_b: str
    clone_type: str = Field(..., description="Type-1 | Type-2 | Type-3 | Non-Syntactic")
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_clone: bool
    features: dict[str, float] | None = Field(None, description="Syntactic feature vector")
    normalized_code_a: str | None = None
    normalized_code_b: str | None = None


class IngestionResponse(BaseModel):
    """Summary returned after processing a submission through the pipeline."""

    submission_id: str
    student_id: str
    assignment_id: str
    fragment_count: int = Field(..., description="Number of fragments after template filtering")
    candidate_pair_count: int = Field(..., description="LSH candidate pairs before cascade")
    confirmed_clone_count: int = Field(..., description="Pairs confirmed as clones (any type)")
    clone_matches: list[CloneMatchSchema] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class TemplateRegisterRequest(BaseModel):
    """Register instructor skeleton code to suppress from student matching."""

    assignment_id: str = Field(..., description="Assignment to attach the template to")
    source_code: str = Field(..., description="Instructor skeleton / starter code", min_length=1)
    language: LanguageEnum = Field(default=LanguageEnum.JAVA)


class TemplateRegisterResponse(BaseModel):
    assignment_id: str
    template_fragment_count: int = Field(..., description="Number of template fragments registered")


class CollusionEdgeSchema(BaseModel):
    student_a: str
    student_b: str
    clone_type: str
    confidence: float
    match_count: int


class CollusionGroupSchema(BaseModel):
    group_id: int
    member_ids: list[str]
    member_count: int
    max_confidence: float
    dominant_type: str
    edge_count: int
    edges: list[CollusionEdgeSchema] = Field(default_factory=list)


class CollusionReportResponse(BaseModel):
    """Connected-component collusion report for an assignment."""

    assignment_id: str | None = None
    group_count: int
    total_flagged_students: int
    groups: list[CollusionGroupSchema]


class FragmentSchema(BaseModel):
    """Serialisable representation of a code fragment."""

    fragment_id: str | None = None
    submission_id: str
    student_id: str
    assignment_id: str
    language: str
    abstract_tokens: list[str]
    token_count: int
    byte_offset: int
    fragment_type: str
    node_type: str | None = None


class IndexStatusResponse(BaseModel):
    """Status of the MinHash LSH index."""

    indexed_fragment_count: int
    lsh_threshold: float
    num_permutations: int


# ──────────────────────────────────────────────────────────────────────────
# Assignment Clustering Schemas
# ──────────────────────────────────────────────────────────────────────────


class SubmissionItem(BaseModel):
    """A single student submission within an assignment cluster request."""

    submission_id: str = Field(..., description="Unique identifier for this submission")
    student_id: str = Field(..., description="Student identifier")
    source_code: str = Field(..., description="Full source code of the submission", min_length=1)


class AssignmentClusterRequest(BaseModel):
    """
    Send all submissions for one assignment and receive back the clone clusters.

    Each submission is run through the full Phase 1–4 pipeline in sequence.
    The pipeline state is **isolated per request** so concurrent calls do not
    interfere with each other or with the global incremental-ingestion index.
    """

    assignment_id: str = Field(..., description="Assignment identifier")
    language: LanguageEnum = Field(default=LanguageEnum.JAVA, description="Programming language")
    submissions: list[SubmissionItem] = Field(
        ..., description="All student submissions for this assignment", min_length=2
    )
    instructor_template: str | None = Field(
        None,
        description=(
            "Optional instructor-provided starter/skeleton code.  "
            "Fragments that closely match this template (Jaccard ≥ 0.90) are "
            "discarded before indexing to avoid false positives."
        ),
    )
    lsh_threshold: float = Field(
        default=0.3,
        ge=0.0,
        le=1.0,
        description="MinHash LSH Jaccard threshold for candidate retrieval (default 0.3)",
    )
    min_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Minimum clone confidence to include an edge in the collusion graph",
    )


class SubmissionClusterResult(BaseModel):
    """Per-submission summary produced during assignment clustering."""

    submission_id: str
    student_id: str
    fragment_count: int = Field(..., description="Fragments after template filtering")
    candidate_pair_count: int = Field(..., description="LSH candidate pairs")
    confirmed_clone_count: int = Field(
        ..., description="Confirmed clone pairs involving this submission"
    )
    errors: list[str] = Field(default_factory=list)


class AssignmentClusterResponse(BaseModel):
    """
    Clustering result for an entire assignment.

    Contains the collusion groups (students sharing clone fragments) together
    with per-submission processing summaries.
    """

    assignment_id: str
    language: str
    submission_count: int = Field(..., description="Total submissions received")
    processed_count: int = Field(..., description="Successfully processed submissions")
    failed_count: int = Field(..., description="Submissions that errored during ingestion")
    total_clone_pairs: int = Field(
        ..., description="Total confirmed clone pairs across all submissions"
    )
    collusion_groups: list[CollusionGroupSchema] = Field(
        default_factory=list,
        description="Groups of students whose submissions share syntactic clones",
    )
    per_submission: list[SubmissionClusterResult] = Field(
        default_factory=list,
        description="Per-submission ingestion summaries",
    )


# ──────────────────────────────────────────────────────────────────────────
# Instructor Annotation Schemas
# ──────────────────────────────────────────────────────────────────────────


class AnnotationStatusEnum(str, Enum):
    """Annotation status values."""

    PENDING_REVIEW = "pending_review"
    CONFIRMED_PLAGIARISM = "confirmed_plagiarism"
    FALSE_POSITIVE = "false_positive"
    ACCEPTABLE_COLLABORATION = "acceptable_collaboration"
    REQUIRES_INVESTIGATION = "requires_investigation"


class CreateAnnotationRequest(BaseModel):
    """Request to create an instructor annotation."""

    assignment_id: str = Field(..., description="Assignment identifier")
    instructor_id: str = Field(..., description="Instructor identifier")
    status: AnnotationStatusEnum = Field(..., description="Annotation status")
    match_id: str | None = Field(None, description="Clone match UUID (optional)")
    group_id: str | None = Field(None, description="Plagiarism group UUID (optional)")
    comments: str | None = Field(None, description="Instructor comments")
    action_taken: str | None = Field(None, description="Action description")


class UpdateAnnotationRequest(BaseModel):
    """Request to update an instructor annotation."""

    status: AnnotationStatusEnum | None = Field(None, description="New status")
    comments: str | None = Field(None, description="New comments")
    action_taken: str | None = Field(None, description="New action description")


class AnnotationResponse(BaseModel):
    """Response with annotation details."""

    id: str = Field(..., description="Annotation UUID")
    assignment_id: str
    instructor_id: str
    status: AnnotationStatusEnum
    match_id: str | None = None
    group_id: str | None = None
    comments: str | None = None
    action_taken: str | None = None
    created_at: str = Field(..., description="ISO timestamp")
    updated_at: str = Field(..., description="ISO timestamp")


class AnnotationStatsResponse(BaseModel):
    """Statistics about annotations for an assignment."""

    assignment_id: str
    total: int = Field(..., description="Total annotations")
    pending_review: int = Field(default=0)
    confirmed_plagiarism: int = Field(default=0)
    false_positive: int = Field(default=0)
    acceptable_collaboration: int = Field(default=0)
    requires_investigation: int = Field(default=0)


# ──────────────────────────────────────────────────────────────────────────
# Similarity Report Metadata Schemas
# ──────────────────────────────────────────────────────────────────────────


class SimilarityReportMetadata(BaseModel):
    """Metadata about a cached similarity report."""

    id: str = Field(..., description="Report UUID")
    assignment_id: str
    language: str
    submission_count: int
    processed_count: int
    failed_count: int
    total_clone_pairs: int
    lsh_threshold: float
    min_confidence: float
    processing_time_seconds: float | None = None
    created_at: str = Field(..., description="ISO timestamp")
    updated_at: str = Field(..., description="ISO timestamp")


# ──────────────────────────────────────────────────────────────────────────
# Student Details for Graph Nodes
# ──────────────────────────────────────────────────────────────────────────


class StudentDetails(BaseModel):
    """Student profile details for graph node display."""

    student_id: str = Field(..., description="Student unique identifier")
    full_name: str = Field(..., description="Full name of the student")
    student_number: str | None = Field(None, description="Student number (e.g., S12345)")
    email: str | None = Field(None, description="Email address")
    avatar_url: str | None = Field(None, description="URL to profile picture")


class CollusionGroupSchemaExtended(BaseModel):
    """Extended collusion group with student details."""

    group_id: int
    member_ids: list[str]
    member_count: int
    max_confidence: float
    dominant_type: str
    edge_count: int
    edges: list[CollusionEdgeSchema] = Field(default_factory=list)
    student_details: dict[str, StudentDetails] = Field(
        default_factory=dict,
        description="Map of student_id to student details for each node",
    )


# ──────────────────────────────────────────────────────────────────────────
# Segment Comparison Schemas
# ──────────────────────────────────────────────────────────────────────────


class SegmentPair(BaseModel):
    """A pair of code segments that were compared."""

    segment_index_a: int = Field(..., description="Index of segment in submission A")
    segment_index_b: int = Field(..., description="Index of segment in submission B")
    segment_code_a: str = Field(..., description="Source code of segment A")
    segment_code_b: str = Field(..., description="Source code of segment B")
    is_clone: bool = Field(..., description="Whether these segments are clones")
    clone_type: str | None = Field(None, description="Type of clone detected")
    confidence: float = Field(..., description="Confidence score (0-1)")
    normalized_code_a: str | None = Field(None, description="Normalized code A")
    normalized_code_b: str | None = Field(None, description="Normalized code B")


class SegmentComparisonResult(BaseModel):
    """Result of all-to-all segment comparison between two submissions."""

    submission_a_id: str = Field(..., description="First submission ID")
    submission_b_id: str = Field(..., description="Second submission ID")
    student_a: str = Field(..., description="Student A ID")
    student_b: str = Field(..., description="Student B ID")
    segment_count_a: int = Field(..., description="Number of segments in submission A")
    segment_count_b: int = Field(..., description="Number of segments in submission B")
    matched_pairs: list[SegmentPair] = Field(
        default_factory=list,
        description="All segment pairs that are clones or have high similarity",
    )
    highest_confidence: float = Field(
        default=0.0,
        description="Highest confidence among all segment pairs",
    )
    dominant_clone_type: str | None = Field(None, description="Most common clone type")


class SegmentCompareRequest(BaseModel):
    """Request to compare all segments between two submissions."""

    submission_a_id: str = Field(..., description="First submission ID")
    submission_b_id: str = Field(..., description="Second submission ID")
    language: LanguageEnum = Field(default=LanguageEnum.JAVA)


# ──────────────────────────────────────────────────────────────────────────
# Rearranged/Moved Block Detection Schemas
# ──────────────────────────────────────────────────────────────────────────


class MovedBlock(BaseModel):
    """A code block that appears in both submissions but in different positions."""

    block_id: str = Field(..., description="Unique identifier for this block")
    block_type: str = Field(..., description="Type of block (function, method, etc.)")
    code_snippet: str = Field(..., description="Source code of the block")
    position_in_a: int = Field(..., description="Position index in submission A")
    position_in_b: int = Field(..., description="Position index in submission B")
    similarity: float = Field(..., description="Structural similarity of the block")


class MovedBlocksResult(BaseModel):
    """Result of detecting rearranged code blocks between two submissions."""

    submission_a_id: str
    submission_b_id: str
    moved_blocks: list[MovedBlock] = Field(
        default_factory=list,
        description="Blocks found in different positions in each submission",
    )
    total_moved: int = Field(
        default=0,
        description="Total number of moved blocks",
    )
    is_rearranged: bool = Field(
        default=False,
        description="True if any blocks have been rearranged",
    )


class MovedBlocksRequest(BaseModel):
    """Request to detect moved blocks between two code submissions."""

    code1: str = Field(..., description="First code snippet")
    code2: str = Field(..., description="Second code snippet")
    language: LanguageEnum = Field(default=LanguageEnum.JAVA)
