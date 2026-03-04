'use client';

import React, { useState } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';
import { CodeFile } from '@/types/code-editor.types';
import { useEditorStore } from '@/lib/stores/editor.store';
import { Button } from '@/components/ui/button';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

interface FileExplorerProps {
  onNewFile?: () => void;
  onDeleteFile?: (fileId: string) => void;
  onDownloadFile?: (fileId: string) => void;
  onUploadFiles?: () => void;
  canEdit?: boolean;
}

export function FileExplorer({
  onNewFile,
  onDeleteFile,
  onDownloadFile,
  onUploadFiles,
  canEdit = true,
}: FileExplorerProps) {
  const { files, activeFileId, setActiveFile } = useEditorStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleFileClick = (fileId: string) => {
    setActiveFile(fileId);
  };

  const getFileIcon = (language: string) => {
    // Map languages to icon colors
    const iconColors: Record<string, string> = {
      javascript: 'text-yellow-500',
      typescript: 'text-blue-500',
      python: 'text-green-500',
      java: 'text-red-500',
      cpp: 'text-purple-500',
      c: 'text-blue-400',
      go: 'text-cyan-500',
      rust: 'text-orange-500',
      html: 'text-orange-400',
      css: 'text-blue-400',
      json: 'text-yellow-400',
      markdown: 'text-gray-400',
    };

    return iconColors[language] || 'text-gray-500';
  };

  return (
    <div className="flex h-full flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-2">
        <span className="text-sm font-semibold">FILES</span>
        {canEdit && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onNewFile}
              title="New File"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onUploadFiles}
              title="Upload Files"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <File className="mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">No files yet</p>
            {canEdit && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={onNewFile}
              >
                Create a file
              </Button>
            )}
          </div>
        ) : (
          <div className="py-1">
            {files.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                isActive={file.id === activeFileId}
                onClick={() => handleFileClick(file.id)}
                onDelete={canEdit ? onDeleteFile : undefined}
                onDownload={onDownloadFile}
                getFileIcon={getFileIcon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FileItemProps {
  file: CodeFile;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (fileId: string) => void;
  onDownload?: (fileId: string) => void;
  getFileIcon: (language: string) => string;
}

function FileItem({
  file,
  isActive,
  onClick,
  onDelete,
  onDownload,
  getFileIcon,
}: FileItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 text-sm cursor-pointer hover:bg-accent',
            isActive && 'bg-accent font-medium',
            file.isModified && 'italic'
          )}
          onClick={onClick}
        >
          <File className={cn('h-4 w-4', getFileIcon(file.language))} />
          <span className="flex-1 truncate">{file.name}</span>
          {file.isModified && (
            <span className="h-2 w-2 rounded-full bg-blue-500" title="Unsaved changes" />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {onDownload && (
          <ContextMenuItem onClick={() => onDownload(file.id)}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}
        {onDelete && (
          <ContextMenuItem
            onClick={() => onDelete(file.id)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
