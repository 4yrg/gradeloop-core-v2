import { axiosInstance } from './axios';
import type {
    AssignmentResponse,
    ListAssignmentsResponse,
    CreateAssignmentRequest,
    SubmissionResponse,
    ListSubmissionsResponse,
    SubmissionCodeResponse,
    CreateSubmissionRequest,
    GroupResponse,
    CreateGroupRequest,
    RunCodeRequest,
    RunCodeResponse,
    SubmissionGrade,
    GradeOverrideRequest,
    UpdateRubricRequest,
    ListRubricResponse,
    ListTestCasesResponse,
} from '@/types/assessments.types';

// ── Instructor-scoped Assessment endpoints ───────────────────────────────────

export const instructorAssessmentsApi = {
    /**
     * List assignments created by the instructor.
     * Optionally filter by course_instance_id.
     * Backend: GET /instructor-assignments/me?course_instance_id=:id (optional)
     */
    listMyAssignments: async (courseInstanceId?: string): Promise<AssignmentResponse[]> => {
        const params = courseInstanceId ? { course_instance_id: courseInstanceId } : {};
        const { data } = await axiosInstance.get<ListAssignmentsResponse>(
            '/instructor-assignments/me',
            { params }
        );
        return data.assignments || [];
    },

    createAssignment: async (req: CreateAssignmentRequest): Promise<AssignmentResponse> => {
        const { data } = await axiosInstance.post<AssignmentResponse>('/instructor-assignments', req);
        return data;
    },

    listSubmissions: async (assignmentId: string): Promise<SubmissionResponse[]> => {
        const { data } = await axiosInstance.get<ListSubmissionsResponse>(`/instructor-submissions/assignment/${assignmentId}`);
        return data.submissions || [];
    },

    getRubric: async (assignmentId: string): Promise<ListRubricResponse> => {
        const { data } = await axiosInstance.get<ListRubricResponse>(`/instructor-assignments/${assignmentId}/rubric`);
        return data;
    },

    updateRubric: async (assignmentId: string, req: UpdateRubricRequest): Promise<ListRubricResponse> => {
        const { data } = await axiosInstance.put<ListRubricResponse>(`/instructor-assignments/${assignmentId}/rubric`, req);
        return data;
    },
};

// ── General Assessment endpoints ─────────────────────────────────────────────

export const assessmentsApi = {
    getAssignment: async (id: string): Promise<AssignmentResponse> => {
        const { data } = await axiosInstance.get<AssignmentResponse>(`/assignments/${id}`);
        return data;
    },

    updateAssignment: async (id: string, req: Partial<CreateAssignmentRequest>): Promise<AssignmentResponse> => {
        const { data } = await axiosInstance.patch<AssignmentResponse>(`/assignments/${id}`, req);
        return data;
    },

    submitAssignment: async (req: CreateSubmissionRequest): Promise<SubmissionResponse> => {
        const { data } = await axiosInstance.post<SubmissionResponse>('/submissions', req);
        return data;
    },

    getSubmissionCode: async (id: string): Promise<SubmissionCodeResponse> => {
        const { data } = await axiosInstance.get<SubmissionCodeResponse>(`/submissions/${id}/code`);
        return data;
    },

    createGroup: async (req: CreateGroupRequest): Promise<GroupResponse> => {
        const { data } = await axiosInstance.post<GroupResponse>('/groups', req);
        return data;
    },

    runCode: async (req: RunCodeRequest): Promise<RunCodeResponse> => {
        const { data } = await axiosInstance.post<RunCodeResponse>('/submissions/run-code', req);
        return data;
    },
};

// ── Student-scoped Assessment endpoints ─────────────────────────────────────

export const studentAssessmentsApi = {
    /**
     * List all assignments for a given course instance.
     * Backend: GET /student-assignments?course_instance_id=:id
     */
    listAssignmentsForCourse: async (courseInstanceId: string): Promise<AssignmentResponse[]> => {
        const { data } = await axiosInstance.get<ListAssignmentsResponse>('/student-assignments', {
            params: { course_instance_id: courseInstanceId },
        });
        return data.assignments || (Array.isArray(data) ? data : []);
    },

    /**
     * Get a single assignment by ID.
     * Backend: GET /student-assignments/:id
     */
    getAssignment: async (id: string): Promise<AssignmentResponse> => {
        const { data } = await axiosInstance.get<AssignmentResponse>(`/student-assignments/${id}`);
        return data;
    },

    /**
     * List the calling student's submissions for a given assignment (all versions).
     * Backend: GET /student-submissions/me?assignment_id=:id
     */
    listMySubmissions: async (assignmentId: string): Promise<SubmissionResponse[]> => {
        const { data } = await axiosInstance.get<ListSubmissionsResponse>('/student-submissions/me', {
            params: { assignment_id: assignmentId },
        });
        return data.submissions || (Array.isArray(data) ? data : []);
    },

    /**
     * Get the latest submission (including draft/in-progress code) for an assignment.
     * Backend: GET /student-submissions/me/latest?assignment_id=:id
     */
    getMyLatestSubmission: async (assignmentId: string): Promise<SubmissionResponse | null> => {
        try {
            const { data } = await axiosInstance.get<SubmissionResponse>(
                '/student-submissions/me/latest',
                { params: { assignment_id: assignmentId } },
            );
            return data;
        } catch {
            return null;
        }
    },

    /**
     * Get the source code of a specific submission version.
     * Backend: GET /submissions/:id/code
     */
    getSubmissionCode: async (submissionId: string): Promise<SubmissionCodeResponse> => {
        const { data } = await axiosInstance.get<SubmissionCodeResponse>(`/submissions/${submissionId}/code`);
        return data;
    },

    /**
     * Submit (or resubmit) an assignment. Each call creates a new version.
     * Backend: POST /submissions
     */
    submit: async (req: CreateSubmissionRequest): Promise<SubmissionResponse> => {
        const { data } = await axiosInstance.post<SubmissionResponse>('/submissions', req);
        return data;
    },

    /**
     * Run code against Judge0 without creating a formal submission.
     * Backend: POST /submissions/run-code
     */
    runCode: async (req: RunCodeRequest): Promise<RunCodeResponse> => {
        const { data } = await axiosInstance.post<RunCodeResponse>('/submissions/run-code', req);
        return data;
    },

    /**
     * Get the visible (non-hidden) test cases for an assignment.
     * Backend: GET /student-assignments/:id/test-cases
     */
    getAssignmentTestCases: async (assignmentId: string): Promise<ListTestCasesResponse> => {
        const { data } = await axiosInstance.get<ListTestCasesResponse>(`/student-assignments/${assignmentId}/test-cases`);
        return data;
    },
};

// ── ACAFS service endpoints (via Next.js same-origin proxy) ─────────────────

export const acafsApi = {
    /**
     * Fetch the AI-generated grade for a submission.
     * Proxied through /api/acafs/grades/:submissionId → ACAFS service.
     *
     * Throws an error with message "GRADING_PENDING" when grading hasn't
     * completed yet (ACAFS returns 404). Callers should poll with back-off.
     */
    getSubmissionGrade: async (submissionId: string): Promise<SubmissionGrade> => {
        const resp = await fetch(`/api/acafs/grades/${encodeURIComponent(submissionId)}`, {
            cache: 'no-store',
        });
        if (resp.status === 404) throw new Error('GRADING_PENDING');
        if (!resp.ok) throw new Error(`Grade fetch failed with status ${resp.status}`);
        return resp.json() as Promise<SubmissionGrade>;
    },

    /**
     * Run code once via ACAFS → Judge0 (no test case comparison).
     * Proxied through /api/acafs/ide/run → ACAFS POST /ide/run.
     * Uses a fresh httpx connection per call — avoids Go connection-pool issues.
     */
    runIde: async (payload: {
        language_id: number;
        source_code: string;
        stdin?: string;
    }): Promise<RunCodeResponse> => {
        const resp = await fetch(`/api/acafs/ide/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: 'Code execution failed' }));
            throw new Error(err.detail ?? `Code execution failed with status ${resp.status}`);
        }
        return resp.json() as Promise<RunCodeResponse>;
    },

    /**
     * Run assignment-specific test cases from the IDE.
     * Proxied through /api/acafs/ide/run-tests → ACAFS service.
     * Payload: { language_id, source_code, test_cases }
     */
    runIdeTests: async (payload: {
        language_id: number;
        source_code: string;
        test_cases: Array<Record<string, unknown>>;
    }): Promise<{ test_results: any[] }> => {
        const resp = await fetch(`/api/acafs/ide/run-tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: 'IDE run failed' }));
            throw new Error(err.detail ?? `IDE run failed with status ${resp.status}`);
        }
        return resp.json() as Promise<{ test_results: any[] }>;
    },

    /**
     * Apply instructor overrides to an existing grade.
     * Proxied through /api/acafs/grades/:submissionId/override → ACAFS PUT endpoint.
     *
     * Original ACAFS scores are never mutated — overrides are stored separately.
     */
    overrideGrade: async (
        submissionId: string,
        body: GradeOverrideRequest,
    ): Promise<SubmissionGrade> => {
        const resp = await fetch(
            `/api/acafs/grades/${encodeURIComponent(submissionId)}/override`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                cache: 'no-store',
            },
        );
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: 'Override failed' }));
            throw new Error(err.detail ?? `Override failed with status ${resp.status}`);
        }
        return resp.json() as Promise<SubmissionGrade>;
    },
};
