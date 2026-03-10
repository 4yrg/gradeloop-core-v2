/**
 * Keystroke service API client.
 *
 * The keystroke service lives behind the API gateway at
 * /api/keystroke/… (NOT under /api/v1). We derive the gateway root
 * from NEXT_PUBLIC_GATEWAY_URL or strip the /api/v1 suffix from the
 * shared NEXT_PUBLIC_API_URL.
 */

const GATEWAY_URL = (() => {
    const raw =
        process.env.NEXT_PUBLIC_GATEWAY_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:8000";
    // Strip trailing "/api/v1" or "/api/v1/" if present
    return raw.replace(/\/api\/v1\/?$/, "");
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrollmentProgress {
    success: boolean;
    user_id: string;
    enrollment_complete: boolean;
    phases_complete?: string[];
    phases_remaining?: string[];
    total_sessions?: number;
    started_at?: string | null;
    completed_at?: string | null;
    database_enabled?: boolean;
    message?: string;
}

export interface RawKeystrokeEvent {
    userId: string;
    sessionId: string;
    timestamp: number;
    key: string;
    dwellTime: number;   // ms key was held down
    flightTime: number;  // ms from previous keyup to this keydown
    keyCode: number;
}

export interface EnrollPhaseRequest {
    userId: string;
    phase: string;
    keystrokeEvents: RawKeystrokeEvent[];
    metadata?: Record<string, unknown>;
}

export interface EnrollPhaseResponse {
    success: boolean;
    user_id: string;
    phase: string;
    sequences_created: number;
    enrollment_complete: boolean;
    message?: string;
}

// ─── Playback & Analytics Types ───────────────────────────────────────────────

export interface ArchiveLookupResult {
    success: boolean;
    session_id: string;
    user_id: string;
    assignment_id: string;
    course_id?: string;
    event_count: number;
    session_duration_seconds: number;
    average_risk_score: number;
    max_risk_score: number;
    anomaly_count: number;
    authentication_failures: number;
    archived_at: string;
}

export interface PlaybackEvent {
    userId?: string;
    sessionId?: string;
    timestamp: number;       // ms since session start
    key: string;
    keyCode: number;
    dwellTime: number;
    flightTime: number;
    action?: string;
    lineNumber?: number;
    columnNumber?: number;
    codeSnapshot?: string;
}

export interface AuthTimelineEntry {
    offset_seconds: number;
    timestamp_ms: number;
    risk_score: number;
    similarity_score: number;
    authenticated: boolean;
    confidence_level: string;
    is_anomaly: boolean;
    anomaly_type?: string | null;
    is_struggling: boolean;
}

export interface PlaybackSummary {
    average_risk_score: number;
    max_risk_score: number;
    anomaly_count: number;
    authentication_failures: number;
}

export interface PlaybackData {
    success: boolean;
    session_id: string;
    user_id?: string;
    assignment_id?: string;
    session_duration_seconds: number;
    total_events: number;
    events: PlaybackEvent[];
    auth_timeline: AuthTimelineEntry[];
    final_code: string;
    summary: PlaybackSummary;
}

export interface RiskTimelinePoint {
    offset_seconds: number;
    risk_score: number;
    similarity_score: number;
    is_anomaly: boolean;
    is_struggling: boolean;
}

export interface FrictionPoint {
    offset_seconds: number;
    duration: number;
    deletion_rate: number;
    long_pauses: number;
    severity: "high" | "medium";
}

export interface SessionMetrics {
    total_duration: number;
    total_keystrokes: number;
    average_typing_speed: number;
    pause_count: number;
    long_pause_count: number;
    deletion_count: number;
    deletion_rate: number;
    paste_count: number;
    copy_count: number;
    avg_dwell_time: number;
    std_dwell_time: number;
    avg_flight_time: number;
    std_flight_time: number;
    burst_typing_events: number;
    rhythm_consistency: number;
    friction_points: FrictionPoint[];
}

export interface AuthenticityIndicators {
    human_signature_score: number;
    synthetic_signature_score: number;
    consistency_score: number;
    anomaly_flags: Array<Record<string, unknown>>;
    multiple_contributor_probability: number;
    external_assistance_probability: number;
}

export interface CognitiveLoadPoint {
    timestamp: number;   // seconds since session start
    load: number;        // 0.0 – 1.0
}

export interface CognitiveAnalysis {
    incremental_construction: boolean;
    pivotal_moments: Array<Record<string, unknown>>;
    troubleshooting_style: "systematic" | "erratic" | "confident";
    cognitive_load_timeline: CognitiveLoadPoint[];
    high_friction_concepts: string[];
    struggle_areas: Array<Record<string, unknown>>;
    mastery_indicators: string[];
}

export interface ProcessScore {
    active_problem_solving_score: number;
    learning_depth_score: number;
    authenticity_score: number;
    engagement_score: number;
    overall_score: number;
    confidence_level: "HIGH" | "MEDIUM" | "LOW";
}

export interface BehavioralAnalysis {
    session_id: string;
    student_id: string;
    timestamp: string;
    session_metrics: SessionMetrics;
    authenticity_indicators: AuthenticityIndicators;
    cognitive_analysis: CognitiveAnalysis;
    process_score: ProcessScore;
    llm_insights: Record<string, unknown>;
    critical_anomalies: string[];
    pedagogical_feedback: Record<string, unknown>;
}

export interface AnalyticsData {
    success: boolean;
    session_id: string;
    analysis_available: boolean;
    behavioral_analysis: BehavioralAnalysis | null;
    risk_timeline: RiskTimelinePoint[];
    friction_points: FrictionPoint[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
    // Lazily import to avoid circular deps
    const { useAuthStore } = await import("@/lib/stores/authStore");
    return useAuthStore.getState().accessToken;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const keystrokeApi = {
    /**
     * GET /api/keystroke/enroll/progress/{userId}
     * Returns enrollment status for the given user.
     */
    getEnrollmentProgress: async (userId: string): Promise<EnrollmentProgress> => {
        const token = await getAccessToken();

        const res = await fetch(
            `${GATEWAY_URL}/api/keystroke/enroll/progress/${encodeURIComponent(userId)}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }
        );

        if (!res.ok) {
            throw new Error(`Keystroke service returned ${res.status}`);
        }

        return res.json() as Promise<EnrollmentProgress>;
    },

    /**
     * POST /api/keystroke/enroll/phase
     * Submit keystroke events for one enrollment phase.
     * Needs at least 150 events.
     */
    enrollPhase: async (payload: EnrollPhaseRequest): Promise<EnrollPhaseResponse> => {
        const token = await getAccessToken();

        const res = await fetch(`${GATEWAY_URL}/api/keystroke/enroll/phase`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<EnrollPhaseResponse>;
    },

    // ─── Playback & Analytics ─────────────────────────────────────────────────

    /**
     * GET /api/keystroke/archive/lookup?assignment_id=&user_id=
     * Resolve the session_id for a given assignment + student pair.
     */
    lookupArchive: async (
        assignmentId: string,
        userId: string
    ): Promise<ArchiveLookupResult> => {
        const token = await getAccessToken();
        const url = `${GATEWAY_URL}/api/keystroke/archive/lookup?assignment_id=${encodeURIComponent(assignmentId)}&user_id=${encodeURIComponent(userId)}`;

        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        if (!res.ok) throw new Error(`Archive lookup failed: ${res.status}`);
        return res.json() as Promise<ArchiveLookupResult>;
    },

    /**
     * GET /api/keystroke/playback/{sessionId}
     * Retrieve all keystroke events + auth timeline for session replay.
     */
    getPlaybackData: async (sessionId: string): Promise<PlaybackData> => {
        const token = await getAccessToken();

        const res = await fetch(
            `${GATEWAY_URL}/api/keystroke/playback/${encodeURIComponent(sessionId)}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }
        );

        if (!res.ok) throw new Error(`Playback data fetch failed: ${res.status}`);
        return res.json() as Promise<PlaybackData>;
    },

    /**
     * GET /api/keystroke/analytics/{sessionId}
     * Retrieve (or compute on-demand) behavioral analytics for a session.
     */
    getAnalytics: async (sessionId: string): Promise<AnalyticsData> => {
        const token = await getAccessToken();

        const res = await fetch(
            `${GATEWAY_URL}/api/keystroke/analytics/${encodeURIComponent(sessionId)}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            }
        );

        if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
        return res.json() as Promise<AnalyticsData>;
    },
};
