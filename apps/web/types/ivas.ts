// ============================================================
// Assignment (matches backend AssignmentOut)
// ============================================================

export interface IvasAssignment {
    id: string;
    title: string;
    description: string | null;
    code_context: string | null;
    programming_language: string;
    course_id: string | null;
    instructor_id: string;
    created_at: string;
    updated_at: string;
}

export interface AssignmentCreate {
    title: string;
    description?: string;
    code_context?: string;
    programming_language?: string;
    course_id?: string;
    instructor_id: string;
}

export interface AssignmentUpdate {
    title?: string;
    description?: string;
    code_context?: string;
    programming_language?: string;
    course_id?: string;
}

export interface AssignmentDetail extends IvasAssignment {
    criteria: GradingCriteria[];
    questions: IvasQuestion[];
}

// ============================================================
// Grading Criteria (matches backend GradingCriteriaOut)
// ============================================================

export interface GradingCriteria {
    id: string;
    assignment_id: string;
    competency: string;
    description: string | null;
    max_score: number;
    weight: number;
    difficulty: number;
    created_at: string;
}

export interface GradingCriteriaCreate {
    competency: string;
    description?: string;
    max_score?: number;
    weight?: number;
    difficulty?: number;
}

export interface GradingCriteriaUpdate {
    competency?: string;
    description?: string;
    max_score?: number;
    weight?: number;
    difficulty?: number;
}

// ============================================================
// Questions (matches backend QuestionOut)
// ============================================================

export interface IvasQuestion {
    id: string;
    assignment_id: string;
    criteria_id: string | null;
    question_text: string;
    competency: string | null;
    difficulty: number;
    expected_topics: string[] | null;
    status: "draft" | "approved" | "rejected";
    created_at: string;
}

export interface QuestionCreate {
    criteria_id?: string;
    question_text: string;
    competency?: string;
    difficulty?: number;
    expected_topics?: string[];
}

export interface QuestionUpdate {
    criteria_id?: string;
    question_text?: string;
    competency?: string;
    difficulty?: number;
    expected_topics?: string[];
    status?: "draft" | "approved" | "rejected";
}

// ============================================================
// Viva Session (matches backend SessionOut)
// ============================================================

export interface VivaSession {
    id: string;
    assignment_id: string;
    assignment_context: Record<string, unknown>;
    student_id: string;
    status: "initializing" | "in_progress" | "paused" | "completed" | "abandoned" | "grading_failed";
    total_score: number | null;
    max_possible: number | null;
    difficulty_distribution: Record<string, number> | null;
    started_at: string;
    completed_at: string | null;
    metadata: Record<string, unknown>;
}

export interface SessionCreate {
    assignment_id: string;
    student_id: string;
    assignment_context?: Record<string, unknown>;
    difficulty_distribution?: Record<string, number>;
}

// ============================================================
// Voice Enrollment (matches backend voice schemas)
// ============================================================

export interface VoiceEnrollmentOut {
    student_id: string;
    samples_count: number;
    required_samples: number;
    is_complete: boolean;
    message: string;
}

export interface VoiceProfileStatus {
    student_id: string;
    enrolled: boolean;
    samples_count: number;
    required_samples: number;
    is_complete: boolean;
}

export interface VoiceVerifyOut {
    student_id: string;
    similarity_score: number;
    is_match: boolean;
    confidence: "high" | "medium" | "low";
    threshold: number;
}

// ============================================================
// WebSocket Message Types
// ============================================================

export interface WsMessageOutgoing {
    type: "audio" | "end_session" | "ping";
    data?: string;
}

export interface WsMessageIncoming {
    type:
        | "audio"
        | "text"
        | "user_transcript"
        | "ai_transcript"
        | "turn_complete"
        | "session_started"
        | "session_ended"
        | "error"
        | "pong";
    data?: string;
    finished?: boolean;
    session_id?: string;
    status?: string;
    mime_type?: string;
}

// ============================================================
// Health Check
// ============================================================

export interface HealthResponse {
    status: string;
    service: string;
    version: string;
}

export interface ReadyResponse {
    status: string;
    checks: Record<string, string>;
}

// ============================================================
// Graded Q&A (from session details endpoint)
// ============================================================

export interface GradedQA {
    sequence_num: number;
    question_text: string;
    response_text: string | null;
    score: number | null;
    max_score: number | null;
    score_justification: string | null;
}

// ============================================================
// Transcript turn (from session details endpoint)
// ============================================================

export interface Transcript {
    id: string;
    session_id: string;
    turn_number: number;
    role: "examiner" | "student";
    content: string;
    timestamp: string;
}

// ============================================================
// Session detail (full picture for instructor review)
// ============================================================

export interface SessionDetail {
    session: VivaSession;
    transcripts: Transcript[];
    graded_qa: GradedQA[];
}

// ============================================================
// Competency types (matches backend competency schemas)
// ============================================================

export interface CompetencyOut {
    id: string;
    name: string;
    description: string | null;
    difficulty: number;
    max_score: number;
    created_at: string;
    updated_at: string;
}

export interface CompetencyAssignmentLinkOut {
    link_id: string;
    competency_id: string;
    name: string;
    description: string | null;
    difficulty: number;
    max_score: number;
    weight: number;
}

export interface CompetencyScoreOut {
    id: string;
    student_id: string;
    competency_id: string;
    competency_name: string | null;
    difficulty: number | null;
    max_score: number | null;
    session_id: string | null;
    score: number | null;
    is_override: boolean;
    override_by: string | null;
    override_at: string | null;
    created_at: string;
}

export interface CompetencyScoreSummary {
    student_id: string;
    competency_id: string;
    competency_name: string;
    difficulty: number;
    max_score: number;
    avg_score: number | null;
    session_count: number;
    has_override: boolean;
}

export interface SetCompetenciesRequest {
    competencies: { competency_id: string; weight?: number }[];
}

export interface GenerateCompetenciesRequest {
    assignment_id: string;
    code_context?: string;
    description?: string;
    title?: string;
}

export interface GeneratedCompetency {
    name: string;
    description: string;
    difficulty: number;
    max_score: number;
    weight: number;
}

export interface GenerateCompetenciesResponse {
    competencies: GeneratedCompetency[];
}

export interface OverrideScoreRequest {
    student_id: string;
    competency_id: string;
    new_score: number;
    override_by: string;
}

// ============================================================
// Chat Message (UI-only, for viva transcript display)
// ============================================================

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    isAudio?: boolean;
    /** True while transcript is still streaming for this message. */
    streaming?: boolean;
}
