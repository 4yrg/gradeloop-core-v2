import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/lib/stores/editor.store';
import { minioService } from '@/lib/api/minio.service';
import { submissionService } from '@/lib/api/submission.service';
import { CodeProject, CodeFile, IDEPermissions, FileLanguage } from '@/types/code-editor.types';
import { toast } from './use-toast';

/**
 * Hook for loading and managing a code project
 */
export function useCodeProject(projectId: string, userId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setFiles, setCurrentProject, setLoading } = useEditorStore();

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setLoading(true);
    setError(null);

    try {
      // List all files in the project from MinIO
      const fileKeys = await minioService.listFiles({ projectId, userId });

      // Download all files
      const filePromises = fileKeys.map(async (key) => {
        const content = await minioService.downloadFile({ minioKey: key, userId });
        const fileName = key.split('/').pop() || '';
        const language = detectLanguageFromFileName(fileName);

        const file: CodeFile = {
          id: `file-${Date.now()}-${Math.random()}`,
          name: fileName,
          path: fileName,
          content,
          language,
          isModified: false,
          minioKey: key,
        };

        return file;
      });

      const files = await Promise.all(filePromises);
      setFiles(files);

      // Set current project (you might want to fetch this from a backend API)
      const project: CodeProject = {
        id: projectId,
        name: `Project ${projectId}`,
        files,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCurrentProject(project);

      toast.success('Project loaded', `Loaded ${files.length} file(s)`);
    } catch (err) {
      const errorMessage = 'Failed to load project';
      setError(errorMessage);
      toast.error('Load failed', errorMessage);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  }, [projectId, userId, setFiles, setCurrentProject, setLoading, toast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  return {
    isLoading,
    error,
    reload: loadProject,
  };
}

/**
 * Hook for managing assignment submissions
 */
export function useAssignmentSubmission(
  assignmentId: string,
  userId: string
) {
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSubmission, setCurrentSubmission] = useState<any | null>(null);

  const loadSubmissionHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const history = await submissionService.getSubmissionHistory(
        userId,
        assignmentId
      );
      setSubmissionHistory(history);
    } catch (error) {
      console.error('Failed to load submission history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [assignmentId, userId]);

  const pollSubmission = useCallback(
    async (submissionId: string) => {
      try {
        const result = await submissionService.pollSubmissionStatus(submissionId);
        setCurrentSubmission(result);
        return result;
      } catch (error) {
        console.error('Failed to poll submission:', error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    loadSubmissionHistory();
  }, [loadSubmissionHistory]);

  return {
    submissionHistory,
    isLoadingHistory,
    currentSubmission,
    setCurrentSubmission,
    pollSubmission,
    reloadHistory: loadSubmissionHistory,
  };
}

/**
 * Hook for determining IDE permissions based on user role
 */
export function useIDEPermissions(
  userRole: 'student' | 'lecturer' | 'admin',
  assignmentStatus?: 'open' | 'closed' | 'graded'
): IDEPermissions {
  const [permissions, setPermissions] = useState<IDEPermissions>({
    canEdit: false,
    canSubmit: false,
    canReview: false,
    canGrade: false,
    canCreateTemplates: false,
  });

  useEffect(() => {
    const newPermissions: IDEPermissions = {
      canEdit: true, // Everyone can edit their own code
      canSubmit: userRole === 'student' && assignmentStatus === 'open',
      canReview: userRole === 'lecturer' || userRole === 'admin',
      canGrade: userRole === 'lecturer' || userRole === 'admin',
      canCreateTemplates: userRole === 'lecturer' || userRole === 'admin',
    };

    setPermissions(newPermissions);
  }, [userRole, assignmentStatus]);

  return permissions;
}

/**
 * Hook for auto-saving files
 */
export function useAutoSave(
  onSave: () => Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const { hasUnsavedChanges } = useEditorStore();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (hasUnsavedChanges()) {
        onSave();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [onSave, intervalMs, enabled, hasUnsavedChanges]);
}

/**
 * Hook for keyboard shortcuts
 */
export function useEditorShortcuts(handlers: {
  onSave?: () => void;
  onSubmit?: () => void;
  onFormat?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
      }

      // Ctrl/Cmd + Enter: Submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handlers.onSubmit?.();
      }

      // Ctrl/Cmd + Shift + F: Format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        handlers.onFormat?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

/**
 * Detect programming language from file name
 */
function detectLanguageFromFileName(fileName: string): FileLanguage {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, FileLanguage> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    c: 'c',
    go: 'go',
    rs: 'rust',
    html: 'html',
    htm: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
  };

  return languageMap[ext || ''] || 'javascript';
}
