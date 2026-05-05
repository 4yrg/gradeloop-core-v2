import type { SimulationNodeDatum } from "d3";

export type CloneType = 1 | 2 | 3;

export interface RawSegment {
  segment_id: string;
  code: string;
  clone_type: CloneType;
  clones_with: string[];
}

export interface RawSubmission {
  submission_id: string;
  segments: RawSegment[];
}

export interface StudentProfile {
  student_id: string;
  submission_id: string;
  name: string;
  avatar_seed: string;
  submitted_at: string;
  past_similarity_flags: number;
}

export interface ExplainMetrics {
  token_similarity_pct: number;
  ast_similarity_pct: number;
  control_flow_similarity_pct: number;
}

export interface SegmentEdgeModel {
  id: string;
  source_id: string;
  target_id: string;
  clone_type: CloneType;
  confidence: number;
}

export interface SegmentNodeModel extends SimulationNodeDatum {
  id: string;
  segment_id: string;
  submission_id: string;
  student_id: string;
  code: string;
  dominant_clone_type: CloneType;
  community_id: number;
  submission_order: number;
}

export interface SubmissionCluster {
  id: number;
  submission_ids: string[];
  cross_edge_count: number;
  suspicion: "low" | "medium" | "high";
}

export interface BuiltSegmentGraph {
  nodes: SegmentNodeModel[];
  edges: SegmentEdgeModel[];
  profilesBySubmission: Map<string, StudentProfile>;
  profilesByStudent: Map<string, StudentProfile>;
  studentRisk: Map<string, { score: number; label: string }>;
  communitySuspicion: Map<number, { level: number; label: string }>;
  submissionClusters: SubmissionCluster[];
  explainCache: Map<string, ExplainMetrics>;
}
