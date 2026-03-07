import { axiosInstance } from "./axios";
import type {
  Assignment,
  AssignmentListResponse,
  Submission,
  CreateSubmissionRequest,
  SubmissionCodeResponse,
  SubmissionVersionsResponse,
} from "@/types/assessment.types";

import type {
    AssignmentResponse,
    ListAssignmentsResponse,
    CreateAssignmentRequest,
    UpdateAssignmentRequest,
    SubmissionResponse,
    ListSubmissionsResponse,
    GroupResponse,
    CreateGroupRequest,
    RunCodeRequest,
    RunCodeResponse
} from '@/types/assessments.types';


export const assessmentApi = {
  /**
   * Get all assignments for a course instance
   */
  getAssignmentsByCourseInstance: async (
    courseInstanceId: string,
  ): Promise<AssignmentListResponse> => {
    const { data } =
      await axiosInstance.get<AssignmentListResponse>(
        `/assignments/course-instance/${courseInstanceId}`,
      );
    return data;
  },

  /**
   * Get a single assignment by ID
   */
  getAssignment: async (assignmentId: string): Promise<Assignment> => {
    const { data } = await axiosInstance.get<Assignment>(
      `/assignments/${assignmentId}`,
    );
    return data;
  },

  /**
   * Create a new submission
   */
  createSubmission: async (
    payload: CreateSubmissionRequest,
  ): Promise<Submission> => {
    const { data } = await axiosInstance.post<Submission>(
      `/submissions`,
      payload,
    );
    return data;
  },

  /**
   * Get the latest submission for an assignment (by user or group)
   */
  getLatestSubmission: async (
    assignmentId: string,
    userId?: string,
    groupId?: string,
  ): Promise<Submission> => {
    const params = userId ? { user_id: userId } : { group_id: groupId };
    const { data } = await axiosInstance.get<Submission>(
      `/assignments/${assignmentId}/latest`,
      { params },
    );
    return data;
  },

  /**
   * Get a submission by ID
   */
  getSubmission: async (submissionId: string): Promise<Submission> => {
    const { data } = await axiosInstance.get<Submission>(
      `/submissions/${submissionId}`,
    );
    return data;
  },

  /**
   * Get the code for a submission
   */
  getSubmissionCode: async (
    submissionId: string,
  ): Promise<SubmissionCodeResponse> => {
    const { data } = await axiosInstance.get<SubmissionCodeResponse>(
      `/submissions/${submissionId}/code`,
    );
    return data;
  },

  /**
   * Get all submission versions for an assignment (by user or group)
   */
  getSubmissionVersions: async (
    assignmentId: string,
    userId?: string,
    groupId?: string,
  ): Promise<SubmissionVersionsResponse> => {
    const params = userId ? { user_id: userId } : { group_id: groupId };
    const { data } = await axiosInstance.get<SubmissionVersionsResponse>(
      `/assignments/${assignmentId}/submissions`,
      { params },
    );
    return data;
  },
}
  
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

    updateAssignment: async (id: string, req: UpdateAssignmentRequest): Promise<AssignmentResponse> => {
        const { data } = await axiosInstance.patch<AssignmentResponse>(`/instructor-assignments/${id}`, req);
        return data;
    },

    listSubmissions: async (assignmentId: string): Promise<SubmissionResponse[]> => {
        const { data } = await axiosInstance.get<ListSubmissionsResponse>(`/instructor-submissions/assignment/${assignmentId}`);
        return data.submissions || [];
    },

    // TODO: Add when backend endpoint is available
    getRubric: async (_assignmentId: string): Promise<{ criteria: { name: string; weight: number; description?: string }[] }> => {
        // Mock for now — returns empty or sample rubric
        return Promise.resolve({
            criteria: [
                { name: "Correctness", weight: 60, description: "Accuracy of the solution." },
                { name: "Code Quality", weight: 40, description: "Readability and structure." },
            ],
        });
    },
};

  }
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
};
