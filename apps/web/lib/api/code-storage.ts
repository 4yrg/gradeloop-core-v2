import { axiosInstance } from './axios';

export interface CodeRepo {
    id: string;
    assignment_id: string;
    user_id: string;
    storage_path: string;
    language_id: number;
    language: string;
    created_at: string;
}

export interface CodeFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    type: string;
    content?: string;
    is_folder: boolean;
}

export interface CodeVersion {
    id: string;
    code_repo_id: string;
    assignment_id: string;
    user_id: string;
    version: number;
    commit_sha: string;
    commit_message: string;
    tag_name: string;
    grade?: number;
    graded_at?: string;
    grading_status: string;
    grading_error?: string;
    submitted_at: string;
}

export interface CodeCommitRequest {
    file_path: string;
    content: string;
    message: string;
    sha?: string;
}

export interface CodeCommitResponse {
    success: boolean;
    sha: string;
    message: string;
}

export interface CodeSubmitRequest {
    message: string;
}

export const codeStorageApi = {
    getRepo: async (assignmentId: string): Promise<CodeRepo> => {
        const { data } = await axiosInstance.get<CodeRepo>(`/code/repos/${assignmentId}`);
        return data;
    },

    createOrGetRepo: async (assignmentId: string): Promise<CodeRepo> => {
        const { data } = await axiosInstance.post<CodeRepo>(`/code/repos`, {
            assignment_id: assignmentId,
        });
        return data;
    },

    getFiles: async (assignmentId: string, path: string = ''): Promise<CodeFile[]> => {
        const { data } = await axiosInstance.get<CodeFile[]>(`/code/repos/${assignmentId}/files`, {
            params: { path },
        });
        return data;
    },

    getFileContent: async (assignmentId: string, filePath: string): Promise<{ content: string; sha: string }> => {
        const { data } = await axiosInstance.get<{ content: string; sha: string }>(
            `/code/repos/${assignmentId}/files/${encodeURIComponent(filePath)}`,
        );
        return data;
    },

    saveFile: async (assignmentId: string, req: CodeCommitRequest): Promise<CodeCommitResponse> => {
        const { data } = await axiosInstance.put<CodeCommitResponse>(`/code/repos/${assignmentId}/files`, req);
        return data;
    },

    submitAssignment: async (assignmentId: string, req: CodeSubmitRequest): Promise<CodeVersion> => {
        const { data } = await axiosInstance.post<CodeVersion>(`/code/repos/${assignmentId}/submit`, req);
        return data;
    },

    getVersions: async (assignmentId: string): Promise<CodeVersion[]> => {
        const { data } = await axiosInstance.get<CodeVersion[]>(`/code/repos/${assignmentId}/versions`);
        return data;
    },

    getCommits: async (assignmentId: string): Promise<{ sha: string; message: string; date: string }[]> => {
        const { data } = await axiosInstance.get<{ sha: string; message: string; date: string }[]>(
            `/code/repos/${assignmentId}/commits`,
        );
        return data;
    },
};

export const codeConfigApi = {
    get: async (assignmentId: string): Promise<{ use_seaweedfs: boolean; starter_code: string }> => {
        const { data } = await axiosInstance.get(`/code/config/${assignmentId}`);
        return data;
    },

    update: async (assignmentId: string, config: { use_seaweedfs: boolean; starter_code: string }): Promise<void> => {
        await axiosInstance.put(`/code/config/${assignmentId}`, config);
    },
};