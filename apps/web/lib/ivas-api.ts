import { axiosInstance } from "@/lib/api/axios";
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
    SessionDetail,
    VoiceEnrollmentOut,
    VoiceProfileStatus,
    VoiceVerifyOut,
    VoiceAuthEvent,
    HealthResponse,
    ReadyResponse,
    CompetencyOut,
    CompetencyAssignmentLinkOut,
    CompetencyScoreOut,
    CompetencyScoreSummary,
    SetCompetenciesRequest,
    GenerateCompetenciesRequest,
    GenerateCompetenciesResponse,
    OverrideScoreRequest,
} from "@/types/ivas";

const IVAS_WS_URL =
    process.env.NEXT_PUBLIC_IVAS_WS_URL || "ws://localhost:8000";

async function ivasRequest<T>(path: string, options: { method?: string; body?: string } = {}): Promise<T> {
    const url = `/ivas${path}`;
    const method = options.method || "GET";

    const response = await axiosInstance.request<T>({
        url,
        method,
        data: options.body ? JSON.parse(options.body) : undefined,
    });

    return response.data;
}

// Multipart form request (for voice enrollment)
async function ivasFormRequest<T>(path: string, formData: FormData): Promise<T> {
    const url = `/ivas${path}`;
    const response = await axiosInstance.post<T>(url, formData);
    return response.data;
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
            `/assignments/questions/bulk-status`,
            { method: "POST", body: JSON.stringify({ question_ids: questionIds, new_status: newStatus }) }
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
    getSessionDetails: (sessionId: string) =>
        ivasRequest<SessionDetail>(
            `/sessions/${encodeURIComponent(sessionId)}/details`
        ),
    deleteSession: (sessionId: string) =>
        ivasRequest<void>(
            `/sessions/${encodeURIComponent(sessionId)}`,
            { method: "DELETE" }
        ),
    regradeSession: (sessionId: string) =>
        ivasRequest<VivaSession>(
            `/sessions/${encodeURIComponent(sessionId)}/regrade`,
            { method: "POST" }
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

    // --- Voice Auth Events ---
    listVoiceAuthEvents: (sessionId: string) =>
        ivasRequest<VoiceAuthEvent[]>(
            `/voice/auth-events/${encodeURIComponent(sessionId)}`
        ),

    // --- WebSocket URL helper ---
    getVivaWebSocketUrl: (sessionId: string) =>
        `${IVAS_WS_URL}/ws/ivas/session/${encodeURIComponent(sessionId)}`,

    getStandaloneVivaWebSocketUrl: () =>
        `${IVAS_WS_URL}/ws/ivas/viva`,

    // --- Competencies (global) ---
    listCompetencies: () =>
        ivasRequest<CompetencyOut[]>("/competencies"),

    createCompetency: (name: string, description?: string, difficulty?: number, maxScore?: number) =>
        ivasRequest<CompetencyOut>("/competencies", {
            method: "POST",
            body: JSON.stringify({ name, description, difficulty, max_score: maxScore }),
        }),

    updateCompetency: (competencyId: string, name: string, description?: string, difficulty?: number, maxScore?: number) =>
        ivasRequest<CompetencyOut>(`/competencies/${encodeURIComponent(competencyId)}`, {
            method: "PUT",
            body: JSON.stringify({ name, description, difficulty, max_score: maxScore }),
        }),

    deleteCompetency: (competencyId: string) =>
        ivasRequest<void>(`/competencies/${encodeURIComponent(competencyId)}`, { method: "DELETE" }),

    // --- Competency-Assignment linking ---
    listAssignmentCompetencies: (assignmentId: string) =>
        ivasRequest<CompetencyAssignmentLinkOut[]>(
            `/competencies/assignment/${encodeURIComponent(assignmentId)}`
        ),

    setAssignmentCompetencies: (assignmentId: string, body: SetCompetenciesRequest) =>
        ivasRequest<CompetencyAssignmentLinkOut[]>(
            `/competencies/assignment/${encodeURIComponent(assignmentId)}/set`,
            { method: "POST", body: JSON.stringify(body) }
        ),

    // --- AI Competency Generation ---
    generateCompetencies: (body: GenerateCompetenciesRequest) =>
        ivasRequest<GenerateCompetenciesResponse>("/competencies/generate", {
            method: "POST",
            body: JSON.stringify(body),
        }),

    // --- Competency Scores ---
    listStudentCompetencyScores: (studentId: string) =>
        ivasRequest<CompetencyScoreOut[]>(`/competencies/scores/student/${encodeURIComponent(studentId)}`),

    listCompetencyScoresForAssignment: (assignmentId: string) =>
        ivasRequest<CompetencyScoreSummary[]>(
            `/competencies/scores/assignment/${encodeURIComponent(assignmentId)}`
        ),

    listStudentsByCompetency: (competencyId: string, assignmentId?: string) => {
        const query = assignmentId
            ? `?assignment_id=${encodeURIComponent(assignmentId)}`
            : "";
        return ivasRequest<Record<string, unknown>[]>(
            `/competencies/scores/competency/${encodeURIComponent(competencyId)}${query}`
        );
    },

    overrideCompetencyScore: (body: OverrideScoreRequest) =>
        ivasRequest<CompetencyScoreOut>("/competencies/scores/override", {
            method: "POST",
            body: JSON.stringify(body),
        }),
};
