import { useState, useEffect, useCallback } from 'react';
import { githubService, type GitHubRepository, type GitHubCommit } from '@/lib/api/github.service';
import type { Assignment } from '@/types/assessment.types';

interface GitHubState {
  repository: GitHubRepository | null;
  commits: GitHubCommit[];
  currentBranch: string;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface UseGitHubIntegrationReturn extends GitHubState {
  initializeGitHub: (token: string, organization?: string) => void;
  cloneRepository: () => Promise<Map<string, string>>;
  commitChanges: (files: Array<{ path: string; content: string }>, message: string) => Promise<void>;
  createBranch: (branchName: string) => Promise<void>;
  switchBranch: (branchName: string) => void;
  createPullRequest: (title: string, body?: string) => Promise<string>;
  refreshCommits: () => Promise<void>;
  pushFile: (path: string, content: string, message: string) => Promise<void>;
  deleteFile: (path: string, sha: string, message: string) => Promise<void>;
}

/**
 * Hook for GitHub integration in assignments
 */
export function useGitHubIntegration(assignment: Assignment | null): UseGitHubIntegrationReturn {
  const [state, setState] = useState<GitHubState>({
    repository: null,
    commits: [],
    currentBranch: 'main',
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  /**
   * Initialize GitHub service with token
   */
  const initializeGitHub = useCallback((token: string, organization?: string) => {
    try {
      githubService.initialize(token, organization);
      setState(prev => ({ ...prev, isInitialized: true, error: null }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, isInitialized: false }));
    }
  }, []);

  /**
   * Load repository details
   */
  const loadRepository = useCallback(async () => {
    if (!assignment?.github_integration?.enabled || !state.isInitialized) return;

    const { repository_owner, repository_name } = assignment.github_integration;
    if (!repository_owner || !repository_name) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const repo = await githubService.getRepository(repository_owner, repository_name);
      setState(prev => ({
        ...prev,
        repository: repo,
        currentBranch: repo.default_branch,
        isLoading: false,
      }));

      // Load initial commits
      await refreshCommits();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, [assignment, state.isInitialized]);

  /**
   * Refresh commits list
   */
  const refreshCommits = useCallback(async () => {
    if (!state.repository || !assignment?.github_integration) return;

    try {
      const commits = await githubService.getCommits(
        assignment.github_integration.repository_owner!,
        assignment.github_integration.repository_name!,
        state.currentBranch,
        20,
      );

      setState(prev => ({ ...prev, commits }));
    } catch (error: any) {
      console.error('Failed to fetch commits:', error);
    }
  }, [state.repository, state.currentBranch, assignment]);

  /**
   * Clone repository files
   */
  const cloneRepository = useCallback(async (): Promise<Map<string, string>> => {
    if (!state.repository || !assignment?.github_integration) {
      throw new Error('Repository not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const files = await githubService.cloneRepositoryFiles(
        assignment.github_integration.repository_owner!,
        assignment.github_integration.repository_name!,
        state.currentBranch,
      );

      setState(prev => ({ ...prev, isLoading: false }));
      return files;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, [state.repository, state.currentBranch, assignment]);

  /**
   * Commit multiple file changes
   */
  const commitChanges = useCallback(
    async (files: Array<{ path: string; content: string }>, message: string) => {
      if (!state.repository || !assignment?.github_integration) {
        throw new Error('Repository not initialized');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const { repository_owner, repository_name } = assignment.github_integration;

        for (const file of files) {
          // Try to get existing file SHA
          let sha: string | undefined;
          try {
            const existingFile = await githubService.getFileContent(
              repository_owner!,
              repository_name!,
              file.path,
              state.currentBranch,
            );
            sha = existingFile.sha;
          } catch {
            // File doesn't exist, that's okay
          }

          await githubService.createOrUpdateFile(
            repository_owner!,
            repository_name!,
            file.path,
            file.content,
            message,
            state.currentBranch,
            sha,
          );
        }

        // Refresh commits after successful commit
        await refreshCommits();
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        throw error;
      }
    },
    [state.repository, state.currentBranch, assignment, refreshCommits],
  );

  /**
   * Push a single file
   */
  const pushFile = useCallback(
    async (path: string, content: string, message: string) => {
      await commitChanges([{ path, content }], message);
    },
    [commitChanges],
  );

  /**
   * Delete a file
   */
  const deleteFile = useCallback(
    async (path: string, sha: string, message: string) => {
      if (!state.repository || !assignment?.github_integration) {
        throw new Error('Repository not initialized');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const { repository_owner, repository_name } = assignment.github_integration;

        await githubService.deleteFile(
          repository_owner!,
          repository_name!,
          path,
          message,
          sha,
          state.currentBranch,
        );

        await refreshCommits();
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        throw error;
      }
    },
    [state.repository, state.currentBranch, assignment, refreshCommits],
  );

  /**
   * Create a new branch
   */
  const createBranch = useCallback(
    async (branchName: string) => {
      if (!state.repository || !assignment?.github_integration) {
        throw new Error('Repository not initialized');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const { repository_owner, repository_name } = assignment.github_integration;

        await githubService.createBranch(
          repository_owner!,
          repository_name!,
          branchName,
          state.currentBranch,
        );

        setState(prev => ({
          ...prev,
          currentBranch: branchName,
          isLoading: false,
        }));

        await refreshCommits();
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        throw error;
      }
    },
    [state.repository, state.currentBranch, assignment, refreshCommits],
  );

  /**
   * Switch to a different branch
   */
  const switchBranch = useCallback((branchName: string) => {
    setState(prev => ({ ...prev, currentBranch: branchName }));
  }, []);

  /**
   * Create a pull request
   */
  const createPullRequest = useCallback(
    async (title: string, body?: string): Promise<string> => {
      if (!state.repository || !assignment?.github_integration) {
        throw new Error('Repository not initialized');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const { repository_owner, repository_name, default_branch } = assignment.github_integration;

        const pr = await githubService.createPullRequest(
          repository_owner!,
          repository_name!,
          title,
          state.currentBranch,
          default_branch || 'main',
          body,
        );

        setState(prev => ({ ...prev, isLoading: false }));
        return pr.html_url;
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        throw error;
      }
    },
    [state.repository, state.currentBranch, assignment],
  );

  // Load repository when assignment changes or GitHub is initialized
  useEffect(() => {
    if (assignment?.github_integration?.enabled && state.isInitialized) {
      loadRepository();
    }
  }, [assignment, state.isInitialized, loadRepository]);

  return {
    ...state,
    initializeGitHub,
    cloneRepository,
    commitChanges,
    createBranch,
    switchBranch,
    createPullRequest,
    refreshCommits,
    pushFile,
    deleteFile,
  };
}

/**
 * Hook to generate student-specific branch name
 */
export function useStudentBranchName(
  assignment: Assignment | null,
  userId: string,
  username?: string,
): string {
  if (!assignment?.github_integration?.submission_branch_prefix) {
    return `student-${userId}`;
  }

  const prefix = assignment.github_integration.submission_branch_prefix;
  const identifier = username || userId;
  
  return `${prefix}-${identifier}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Hook to check if GitHub integration is available
 */
export function useGitHubAvailable(assignment: Assignment | null): boolean {
  return Boolean(
    assignment?.github_integration?.enabled &&
    assignment.github_integration.repository_owner &&
    assignment.github_integration.repository_name,
  );
}
