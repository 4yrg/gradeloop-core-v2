// TypeScript types for the CIPAS Syntactics Service
// Matches the Pydantic schemas in cipas-syntactics/schemas.py

export interface SubmissionItem {
  submission_id: string;
  student_id: string;
  source_code: string;
}

export interface AssignmentClusterRequest {
  assignment_id: string;
  language: string;
  submissions: SubmissionItem[];
  instructor_template?: string;
  lsh_threshold?: number; // default 0.3
  min_confidence?: number; // default 0.0
}

export interface CollusionEdge {
  student_a: string;
  student_b: string;
  clone_type: string; // "Type-1" | "Type-2" | "Type-3"
  confidence: number; // 0.0 – 1.0
  match_count: number;
}

export interface CollusionGroup {
  group_id: number;
  member_ids: string[]; // submission_ids
  member_count: number;
  max_confidence: number;
  dominant_type: string;
  edge_count: number;
  edges: CollusionEdge[];
}

export interface SubmissionClusterResult {
  submission_id: string;
  student_id: string;
  fragment_count: number;
  candidate_pair_count: number;
  confirmed_clone_count: number;
  errors: string[];
}

export interface AssignmentClusterResponse {
  assignment_id: string;
  language: string;
  submission_count: number;
  processed_count: number;
  failed_count: number;
  total_clone_pairs: number;
  collusion_groups: CollusionGroup[];
  per_submission: SubmissionClusterResult[];
}

// ──────────────────────────────────────────────────────────────────────────
// Instructor Annotations
// ──────────────────────────────────────────────────────────────────────────

export type AnnotationStatus =
  | "pending_review"
  | "confirmed_plagiarism"
  | "false_positive"
  | "acceptable_collaboration"
  | "requires_investigation";

export interface CreateAnnotationRequest {
  assignment_id: string;
  instructor_id: string;
  status: AnnotationStatus;
  match_id?: string;
  group_id?: string;
  comments?: string;
  action_taken?: string;
}

export interface UpdateAnnotationRequest {
  status?: AnnotationStatus;
  comments?: string;
  action_taken?: string;
}

export interface AnnotationResponse {
  id: string;
  assignment_id: string;
  instructor_id: string;
  status: AnnotationStatus;
  match_id?: string;
  group_id?: string;
  comments?: string;
  action_taken?: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface AnnotationStatsResponse {
  assignment_id: string;
  total: number;
  pending_review: number;
  confirmed_plagiarism: number;
  false_positive: number;
  acceptable_collaboration: number;
  requires_investigation: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Similarity Report Metadata
// ──────────────────────────────────────────────────────────────────────────

export interface SimilarityReportMetadata {
  id: string;
  assignment_id: string;
  language: string;
  submission_count: number;
  processed_count: number;
  failed_count: number;
  total_clone_pairs: number;
  lsh_threshold: number;
  min_confidence: number;
  processing_time_seconds?: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// ──────────────────────────────────────────────────────────────────────────
// AI Detection (CIPAS-AI Service)
// ──────────────────────────────────────────────────────────────────────────

export interface AIDetectionRequest {
  code: string;
}

export interface AIDetectionResponse {
  is_ai_generated: boolean;
  confidence: number; // 0.0 – 1.0
  ai_likelihood: number; // 0.0 – 1.0
  human_likelihood: number; // 0.0 – 1.0
}

export interface SubmissionWithAI extends SubmissionItem {
  ai_detection?: AIDetectionResponse;
  ai_loading?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Semantic Similarity (CIPAS Semantics Service)
// ──────────────────────────────────────────────────────────────────────────

export interface SimilarityScoreRequest {
  code1: string;
  code2: string;
}

export interface SimilarityScoreResponse {
  similarity_score: number; // 0.0 – 1.0
}

// ──────────────────────────────────────────────────────────────────────────
// Student Details for Graph Nodes
// ──────────────────────────────────────────────────────────────────────────

export interface StudentDetails {
  student_id: string;
  full_name: string;
  student_number?: string;
  email?: string;
  avatar_url?: string;
}

export interface CollusionGroupExtended extends CollusionGroup {
  student_details: Record<string, StudentDetails>;
}

// ──────────────────────────────────────────────────────────────────────────
// Segment Comparison Types
// ──────────────────────────────────────────────────────────────────────────

export interface SegmentPair {
  segment_index_a: number;
  segment_index_b: number;
  segment_code_a: string;
  segment_code_b: string;
  is_clone: boolean;
  clone_type?: string;
  confidence: number;
  normalized_code_a?: string;
  normalized_code_b?: string;
}

export interface SegmentComparisonResult {
  submission_a_id: string;
  submission_b_id: string;
  student_a: string;
  student_b: string;
  segment_count_a: number;
  segment_count_b: number;
  matched_pairs: SegmentPair[];
  highest_confidence: number;
  dominant_clone_type?: string;
}

export interface SegmentCompareRequest {
  submission_a_id: string;
  submission_b_id: string;
  language?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Moved Block Detection Types
// ──────────────────────────────────────────────────────────────────────────

export interface MovedBlock {
  block_id: string;
  block_type: string;
  code_snippet: string;
  position_in_a: number;
  position_in_b: number;
  similarity: number;
}

export interface MovedBlocksResult {
  submission_a_id: string;
  submission_b_id: string;
  moved_blocks: MovedBlock[];
  total_moved: number;
  is_rearranged: boolean;
}

export interface MovedBlocksRequest {
  code1: string;
  code2: string;
  language?: string;
}
