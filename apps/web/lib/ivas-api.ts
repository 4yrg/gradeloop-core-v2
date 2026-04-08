import type {
    IvasAssignment,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentDetail,
    GradingCriteria,
    GradingCriteriaCreate,
    GradingCriteriaUpdate,
    IvasQuestion,
    QuestionCreate,
    QuestionUpdate,
    VivaSession,
    SessionCreate,
    VoiceEnrollmentOut,
    VoiceProfileStatus,
    VoiceVerifyOut,
    HealthResponse,
    ReadyResponse,
} from "@/types/ivas";

const IVAS_BASE_URL =
    process.env.NEXT_PUBLIC_IVAS_API_URL || "http://localhost:8000/api/v1/ivas";

const IVAS_WS_URL =
    process.env.NEXT_PUBLIC_IVAS_WS_URL || "ws://localhost:8000";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function retryableRequest<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const url = `${IVAS_BASE_URL}${path}`;
            const response = await fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const error = await response
                    .json()
                    .catch(() => ({ detail: "Unknown error" }));
                throw new Error(error.detail || response.statusText);
            }

            if (response.status === 204) return {} as T;
            return response.json();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown error");

            if (lastError.message.includes("4")) {
                throw lastError;
            }

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve =>
                    setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt - 1))
                );
            }
        }
    }

    throw lastError || new Error("Request failed after retries");
}

async function ivasRequest<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    return retryableRequest<T>(path, options);
}

// Multipart form request (for voice enrollment)
async function ivasFormRequest<T>(
    path: string,
    formData: FormData
): Promise<T> {
    const url = `${IVAS_BASE_URL}${path}`;
    const response = await fetch(url, {
        method: "POST",
        body: formData,
        // No Content-Type header — browser sets multipart boundary automatically
    });

    if (!response.ok) {
        const error = await response
            .json()
            .catch(() => ({ detail: "Unknown error" }));
        throw new Error(error.detail || response.statusText);
    }

    return response.json();
}

export const ivasApi = {
    // --- Health ---
    checkHealth: () => ivasRequest<HealthResponse>("/health"),
    checkReady: () => ivasRequest<ReadyResponse>("/ready"),

    // --- Assignments ---
    createAssignment: (data: AssignmentCreate) =>
        ivasRequest<IvasAssignment>("/assignments", {
            method: "POST",
            body: JSON.stringify(data),
        }),
    listAssignments: (params?: { instructor_id?: string; course_id?: string }) => {
        const query = new URLSearchParams();
        if (params?.instructor_id) query.set("instructor_id", params.instructor_id);
        if (params?.course_id) query.set("course_id", params.course_id);
        const qs = query.toString();
        return ivasRequest<IvasAssignment[]>(`/assignments${qs ? `?${qs}` : ""}`);
    },
    getAssignment: (assignmentId: string) =>
        ivasRequest<AssignmentDetail>(
            `/assignments/${encodeURIComponent(assignmentId)}`
        ),
    updateAssignment: (assignmentId: string, data: AssignmentUpdate) =>
        ivasRequest<IvasAssignment>(
            `/assignments/${encodeURIComponent(assignmentId)}`,
            { method: "PUT", body: JSON.stringify(data) }
        ),
    deleteAssignment: (assignmentId: string) =>
        ivasRequest<void>(
            `/assignments/${encodeURIComponent(assignmentId)}`,
            { method: "DELETE" }
        ),

    // --- Grading Criteria ---
    createCriteria: (assignmentId: string, data: GradingCriteriaCreate) =>
        ivasRequest<GradingCriteria>(
            `/assignments/${encodeURIComponent(assignmentId)}/criteria`,
            { method: "POST", body: JSON.stringify(data) }
        ),
    listCriteria: (assignmentId: string) =>
        ivasRequest<GradingCriteria[]>(
            `/assignments/${encodeURIComponent(assignmentId)}/criteria`
        ),
    updateCriteria: (criteriaId: string, data: GradingCriteriaUpdate) =>
        ivasRequest<GradingCriteria>(
            `/assignments/criteria/${encodeURIComponent(criteriaId)}`,
            { method: "PUT", body: JSON.stringify(data) }
        ),
    deleteCriteria: (criteriaId: string) =>
        ivasRequest<void>(
            `/assignments/criteria/${encodeURIComponent(criteriaId)}`,
            { method: "DELETE" }
        ),

    // --- Questions ---
    createQuestion: (assignmentId: string, data: QuestionCreate) =>
        ivasRequest<IvasQuestion>(
            `/assignments/${encodeURIComponent(assignmentId)}/questions`,
            { method: "POST", body: JSON.stringify(data) }
        ),
    listQuestions: (assignmentId: string, params?: { status?: string }) => {
        const query = new URLSearchParams();
        if (params?.status) query.set("status", params.status);
        const qs = query.toString();
        return ivasRequest<IvasQuestion[]>(
            `/assignments/${encodeURIComponent(assignmentId)}/questions${qs ? `?${qs}` : ""}`
        );
    },
    updateQuestion: (questionId: string, data: QuestionUpdate) =>
        ivasRequest<IvasQuestion>(
            `/assignments/questions/${encodeURIComponent(questionId)}`,
            { method: "PUT", body: JSON.stringify(data) }
        ),
    deleteQuestion: (questionId: string) =>
        ivasRequest<void>(
            `/assignments/questions/${encodeURIComponent(questionId)}`,
            { method: "DELETE" }
        ),
    bulkUpdateQuestionStatus: (questionIds: string[], newStatus: string) =>
        ivasRequest<{ updated: number; status: string }>(
            `/assignments/questions/bulk-status?new_status=${encodeURIComponent(newStatus)}`,
            { method: "POST", body: JSON.stringify(questionIds) }
        ),

    // --- Sessions ---
    createSession: (data: SessionCreate) =>
        ivasRequest<VivaSession>("/sessions", {
            method: "POST",
            body: JSON.stringify(data),
        }),
    listSessions: (params?: { student_id?: string; assignment_id?: string; status?: string }) => {
        const query = new URLSearchParams();
        if (params?.student_id) query.set("student_id", params.student_id);
        if (params?.assignment_id) query.set("assignment_id", params.assignment_id);
        if (params?.status) query.set("status", params.status);
        const qs = query.toString();
        return ivasRequest<VivaSession[]>(`/sessions${qs ? `?${qs}` : ""}`);
    },
    getSession: (sessionId: string) =>
        ivasRequest<VivaSession>(
            `/sessions/${encodeURIComponent(sessionId)}`
        ),

    // --- Voice Enrollment ---
    enrollVoiceSample: (studentId: string, sampleIndex: number, audioFile: File) => {
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("sample_index", String(sampleIndex));
        formData.append("audio", audioFile);
        return ivasFormRequest<VoiceEnrollmentOut>("/voice/enroll", formData);
    },
    getVoiceProfile: (studentId: string) =>
        ivasRequest<VoiceProfileStatus>(
            `/voice/profile/${encodeURIComponent(studentId)}`
        ),
    deleteVoiceProfile: (studentId: string) =>
        ivasRequest<void>(
            `/voice/profile/${encodeURIComponent(studentId)}`,
            { method: "DELETE" }
        ),
    verifyVoice: (studentId: string, audioFile: File) => {
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("audio", audioFile);
        return ivasFormRequest<VoiceVerifyOut>("/voice/verify", formData);
    },

    // --- WebSocket URL helper ---
    getVivaWebSocketUrl: (sessionId: string) =>
        `${IVAS_WS_URL}/ws/ivas/session/${encodeURIComponent(sessionId)}`,
};
