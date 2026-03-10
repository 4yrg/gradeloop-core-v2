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
    assignmentId?: string;
    courseId?: string;
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

export interface IdentifyMatch {
    userId: string;
    similarity: number;
    confidence: number;
    rank: number;
}

export interface IdentifyResponse {
    success: boolean;
    message?: string;
    matches: IdentifyMatch[];
    best_match?: IdentifyMatch;
    confidence_level?: string; // "HIGH" | "MEDIUM" | "LOW"
    enrolled_users?: number;
}

export interface CaptureResponse {
    success: boolean;
    captured: number;
    total_buffered: number;
}

export interface MonitorResponse {
    success?: boolean;
    status: "COLLECTING_DATA" | "AUTHENTICATED" | "SUSPICIOUS" | "REJECTED";
    message?: string;
    risk_score?: number;
    average_similarity?: number;
    average_risk_score?: number;
    authenticated?: boolean;
    verification_count?: number;
    max_risk_score?: number;
}

export interface ActiveSessionEntry {
    user_id: string;
    session_id: string;
    assignment_id: string;
    risk_score: number;
    event_count: number;
    status: "COLLECTING_DATA" | "AUTHENTICATED" | "SUSPICIOUS" | "REJECTED";
    is_struggling: boolean;
    last_verification: string | null;
    session_started: string | null;
}

export interface ActiveSessionsResponse {
    success: boolean;
    assignment_id: string;
    active_count: number;
    sessions: ActiveSessionEntry[];
}

export interface StudentSummaryEntry {
    user_id: string;
    session_id: string;
    assignment_id: string;
    event_count: number;
    avg_risk_score: number;
    avg_similarity: number;
    anomaly_count: number;
    struggle_count: number;
    has_anomaly: boolean;
    status: "AUTHENTICATED" | "SUSPICIOUS" | "REJECTED" | "COLLECTING_DATA";
    last_event_at: string | null;
    session_started_at: string | null;
}

export interface StudentSummariesResponse {
    success: boolean;
    assignment_id: string;
    students: StudentSummaryEntry[];
}

export interface FinalizeSessionResponse {
    success: boolean;
    message: string;
    events_archived: number;
    assignment_id: string | null;
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

    /**
     * POST /api/keystroke/capture
     * Push a batch of raw keystroke events into the Redis session buffer.
     * Call this every ~30 events during an active session.
     */
    capture: async (events: RawKeystrokeEvent[]): Promise<CaptureResponse> => {
        const token = await getAccessToken();

        const res = await fetch(`${GATEWAY_URL}/api/keystroke/capture`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ events }),
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<CaptureResponse>;
    },

    /**
     * POST /api/keystroke/monitor
     * Run continuous authentication against the events buffered in Redis.
     * Returns COLLECTING_DATA until ≥150 events; then AUTHENTICATED / SUSPICIOUS / REJECTED.
     */
    monitor: async (
        userId: string,
        sessionId: string,
        assignmentId?: string,
        courseId?: string,
    ): Promise<MonitorResponse> => {
        const token = await getAccessToken();

        const res = await fetch(`${GATEWAY_URL}/api/keystroke/monitor`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ userId, sessionId, assignmentId, courseId }),
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<MonitorResponse>;
    },

    /**
     * POST /api/keystroke/identify
     * Compare a set of keystroke events against ALL enrolled users and return
     * top-K best matches with similarity scores.  Needs ≥70 events.
     */
    identify: async (
        events: RawKeystrokeEvent[],
        topK = 5,
    ): Promise<IdentifyResponse> => {
        const token = await getAccessToken();

        const res = await fetch(`${GATEWAY_URL}/api/keystroke/identify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ keystrokeEvents: events, topK }),
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<IdentifyResponse>;
    },

    /**
     * GET /api/keystroke/assignment/{assignmentId}/students
     * Returns per-student auth summaries from the DB (historical / completed sessions).
     * Used by the instructor Auth Monitor page alongside live sessions.
     */
    getAssignmentStudentSummaries: async (
        assignmentId: string,
    ): Promise<StudentSummariesResponse> => {
        const token = await getAccessToken();

        const res = await fetch(
            `${GATEWAY_URL}/api/keystroke/assignment/${encodeURIComponent(assignmentId)}/students`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            },
        );

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<StudentSummariesResponse>;
    },

    /**
     * GET /api/keystroke/active-sessions/assignment/{assignmentId}
     * Returns all active Redis sessions for an assignment.
     * Used by the instructor Live Monitor page.
     */
    getActiveSessionsByAssignment: async (
        assignmentId: string,
    ): Promise<ActiveSessionsResponse> => {
        const token = await getAccessToken();

        const res = await fetch(
            `${GATEWAY_URL}/api/keystroke/active-sessions/assignment/${encodeURIComponent(assignmentId)}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            },
        );

        if (!res.ok) {
            const detail = await res.text().catch(() => res.status.toString());
            throw new Error(detail);
        }

        return res.json() as Promise<ActiveSessionsResponse>;
    },

    /**
     * POST /api/keystroke/session/finalize
     * Archive raw keystroke buffer from Redis → PostgreSQL and clean up Redis.
     * Call this immediately on assignment submission.
     */
    finalizeSession: async (payload: {
        userId: string;
        sessionId: string;
        assignmentId?: string;
        courseId?: string;
        finalCode?: string;
    }): Promise<FinalizeSessionResponse> => {
        const token = await getAccessToken();

        const res = await fetch(`${GATEWAY_URL}/api/keystroke/session/finalize`, {
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

        return res.json() as Promise<FinalizeSessionResponse>;
    },
};
