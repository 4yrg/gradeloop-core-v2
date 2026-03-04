'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Save, 
  Play, 
  Settings, 
  Download, 
  Upload,
  FileText,
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  AlertCircle,
} from 'lucide-react';
import { MonacoCodeEditor } from './monaco-editor';
import { FileExplorer } from './file-explorer';
import { useEditorStore } from '@/lib/stores/editor.store';
import { minioService } from '@/lib/api/minio.service';
import { submissionService } from '@/lib/api/submission.service';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/hooks/use-toast';
import { CodeFile, FileLanguage, IDEPermissions } from '@/types/code-editor.types';

interface CodeIDEProps {
  projectId: string;
  assignmentId?: string;
  userId: string;
  permissions: IDEPermissions;
  onSubmit?: (submissionId: string) => void;
}

export function CodeIDE({
  projectId,
  assignmentId,
  userId,
  permissions,
onSubmit,
}: CodeIDEProps) {
  const {
    files,
    activeFileId,
    getActiveFile,
    updateFile,
    addFile,
    deleteFile,
    setActiveFile,
    isSaving,
    setSaving,
    isSubmitting,
    setSubmitting,
    hasUnsavedChanges,
  } = useEditorStore();

  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLanguage, setNewFileLanguage] = useState<FileLanguage>('javascript');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeFile = getActiveFile();

  // Auto-save functionality
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges() && permissions.canEdit) {
        handleSaveAll();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, permissions.canEdit]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        updateFile(activeFile.id, {
          content: value,
          isModified: true,
        });
      }
    },
    [activeFile, updateFile]
  );

  const handleSaveFile = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || !permissions.canEdit) return;

      setSaving(true);
      try {
        await minioService.uploadFile({
          projectId,
          filePath: file.path,
          content: file.content,
          userId,
          assignmentId,
        });

        updateFile(fileId, { isModified: false });

        toast.success('File saved', `${file.name} has been saved successfully.`);
      } catch (error) {
        toast.error('Save failed', 'Failed to save file. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [files, projectId, userId, assignmentId, permissions.canEdit, setSaving, updateFile, toast]
  );

  const handleSaveAll = useCallback(async () => {
    if (!permissions.canEdit) return;

    const modifiedFiles = files.filter((f) => f.isModified);
    if (modifiedFiles.length === 0) return;

    setSaving(true);
    try {
      const uploadPromises = modifiedFiles.map((file) =>
        minioService.uploadFile({
          projectId,
          filePath: file.path,
          content: file.content,
          userId,
          assignmentId,
        })
      );

      await Promise.all(uploadPromises);

      modifiedFiles.forEach((file) => {
        updateFile(file.id, { isModified: false });
      });

      toast.success('All files saved', `${modifiedFiles.length} file(s) saved successfully.`);
    } catch (error) {
      toast.error('Save failed', 'Failed to save some files. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [files, projectId, userId, assignmentId, permissions.canEdit, setSaving, updateFile, toast]);

  const handleSubmitCode = useCallback(async () => {
    if (!permissions.canSubmit || !assignmentId) return;

    // Save all files first
    await handleSaveAll();

    setSubmitting(true);
    try {
      const submissionPayload = {
        assignmentId,
        userId,
        projectId,
        files: files.map((file) => ({
          name: file.name,
          path: file.path,
          minioKey: file.minioKey || `assignments/${assignmentId}/${userId}/${projectId}/${file.path}`,
          language: file.language,
        })),
        submittedAt: new Date().toISOString(),
      };

      const response = await submissionService.submitCode(submissionPayload);

      toast.success('Code submitted', `Your submission is queued for evaluation. Position: ${response.queuePosition || 'N/A'}`);

      if (onSubmit) {
        onSubmit(response.submissionId);
      }
    } catch (error) {
      toast.error('Submission failed', 'Failed to submit code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    permissions.canSubmit,
    assignmentId,
    userId,
    projectId,
    files,
    handleSaveAll,
    setSubmitting,
    onSubmit,
    toast,
  ]);

  const handleNewFile = useCallback(() => {
    if (!permissions.canEdit) return;
    setIsNewFileDialogOpen(true);
  }, [permissions.canEdit]);

  const handleCreateFile = useCallback(() => {
    if (!newFileName.trim()) return;

    const newFile: CodeFile = {
      id: `file-${Date.now()}`,
      name: newFileName,
      path: newFileName,
      content: '',
      language: newFileLanguage,
      isModified: true,
    };

    addFile(newFile);
    setActiveFile(newFile.id);
    setIsNewFileDialogOpen(false);
    setNewFileName('');

    toast.success('File created', `${newFileName} has been created.`);
  }, [newFileName, newFileLanguage, addFile, setActiveFile, toast]);

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || !permissions.canEdit) return;

      try {
        if (file.minioKey) {
          await minioService.deleteFile({
            minioKey: file.minioKey,
            userId,
          });
        }

        deleteFile(fileId);

        toast.success('File deleted', `${file.name} has been deleted.`);
      } catch (error) {
        toast.error('Delete failed', 'Failed to delete file. Please try again.');
      }
    },
    [files, userId, permissions.canEdit, deleteFile, toast]
  );

  const handleDownloadFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file) return;

      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('File downloaded', `${file.name} has been downloaded.`);
    },
    [files, toast]
  );

  return (
    <>
      <div className={`flex h-full flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">Code Editor</span>
            {activeFile && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm text-muted-foreground">{activeFile.name}</span>
                {activeFile.isModified && (
                  <span className="text-xs text-blue-500">● Unsaved</span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {permissions.canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => activeFile && handleSaveFile(activeFile.id)}
                  disabled={isSaving || !activeFile?.isModified}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={isSaving || !hasUnsavedChanges()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save All
                </Button>
              </>
            )}

            {permissions.canSubmit && assignmentId && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSubmitCode}
                disabled={isSubmitting || hasUnsavedChanges()}
              >
                <Play className="mr-2 h-4 w-4" />
                Submit
              </Button>
            )}

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Warning for unsaved changes */}
        {hasUnsavedChanges() && (
          <Alert variant="default" className="rounded-none border-x-0 border-t-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have unsaved changes. Changes are auto-saved every 30 seconds, or click Save All.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Editor Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Explorer */}
          <div className="w-64 border-r">
            <FileExplorer
              onNewFile={handleNewFile}
              onDeleteFile={handleDeleteFile}
              onDownloadFile={handleDownloadFile}
              canEdit={permissions.canEdit}
            />
          </div>

          {/* Editor */}
          <div className="flex-1">
            {activeFile ? (
              <MonacoCodeEditor
                value={activeFile.content}
                language={activeFile.language}
                onChange={handleEditorChange}
                readOnly={!permissions.canEdit}
                onSave={() => activeFile && handleSaveFile(activeFile.id)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <FileText className="mb-4 h-16 w-16 opacity-50" />
                <p className="text-lg font-medium">No file selected</p>
                <p className="text-sm">Select a file from the explorer or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New File Dialog */}
      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Enter a name for the new file and select its language.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filename">File Name</Label>
              <Input
                id="filename"
                placeholder="example.js"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFile();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={newFileLanguage}
                onChange={(e) => setNewFileLanguage(e.target.value as FileLanguage)}
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim()}>
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
