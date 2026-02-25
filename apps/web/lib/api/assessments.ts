import { axiosInstance } from "./axios";
import type {
  Assignment,
  AssignmentListResponse,
  Submission,
  CreateSubmissionRequest,
  SubmissionCodeResponse,
  SubmissionVersionsResponse,
} from "@/types/assessment.types";

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
};
