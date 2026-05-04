import { axiosInstance } from './axios';

export interface GitHubRepo {
    id: string;
    assignment_id: string;
    user_id: string;
    org_name: string;
    repo_name: string;
    repo_url: string;
    clone_url: string;
    html_url: string;
    language_id: number;
    language: string;
    created_at: string;
}

export interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    type: string;
    content?: string;
    download_url?: string;
}

export interface GitHubVersion {
    id: string;
    github_repo_id: string;
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

export interface GitHubCommitRequest {
    file_path: string;
    content: string;
    message: string;
    sha?: string;
}

export interface GitHubCommitResponse {
    success: boolean;
    sha: string;
    message: string;
}

export interface GitHubSubmitRequest {
    message: string;
}

export const githubApi = {
    getRepo: async (assignmentId: string): Promise<GitHubRepo> => {
        const { data } = await axiosInstance.get<GitHubRepo>(`/github/repos/${assignmentId}`);
        return data;
    },

    createOrGetRepo: async (assignmentId: string): Promise<GitHubRepo> => {
        const { data } = await axiosInstance.post<GitHubRepo>(`/github/repos`, {
            assignment_id: assignmentId,
        });
        return data;
    },

    getFiles: async (assignmentId: string, path: string = ''): Promise<GitHubFile[]> => {
        const { data } = await axiosInstance.get<GitHubFile[]>(`/github/repos/${assignmentId}/files`, {
            params: { path },
        });
        return data;
    },

    getFileContent: async (assignmentId: string, filePath: string): Promise<{ content: string; sha: string }> => {
        const { data } = await axiosInstance.get<{ content: string; sha: string }>(
            `/github/repos/${assignmentId}/files/${encodeURIComponent(filePath)}`,
        );
        return data;
    },

    commitFile: async (assignmentId: string, req: GitHubCommitRequest): Promise<GitHubCommitResponse> => {
        const { data } = await axiosInstance.put<GitHubCommitResponse>(`/github/repos/${assignmentId}/files`, req);
        return data;
    },

    submitAssignment: async (assignmentId: string, req: GitHubSubmitRequest): Promise<GitHubVersion> => {
        const { data } = await axiosInstance.post<GitHubVersion>(`/github/repos/${assignmentId}/submit`, req);
        return data;
    },

    getVersions: async (assignmentId: string): Promise<GitHubVersion[]> => {
        const { data } = await axiosInstance.get<GitHubVersion[]>(`/github/repos/${assignmentId}/versions`);
        return data;
    },

    getCommits: async (assignmentId: string): Promise<{ sha: string; message: string; date: string }[]> => {
        const { data } = await axiosInstance.get<{ sha: string; message: string; date: string }[]>(
            `/github/repos/${assignmentId}/commits`,
        );
        return data;
    },
};

export const githubConfigApi = {
    get: async (assignmentId: string): Promise<{ github_org: string; use_github: boolean; workflow_file_id?: string }> => {
        const { data } = await axiosInstance.get(`/github/config/${assignmentId}`);
        return data;
    },

    update: async (assignmentId: string, config: { github_org: string; use_github: boolean; workflow_file_id?: string }): Promise<void> => {
        await axiosInstance.put(`/github/config/${assignmentId}`, config);
    },
};