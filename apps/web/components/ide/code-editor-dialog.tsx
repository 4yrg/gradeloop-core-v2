"use client";

import { useState, useCallback } from "react";
import { CodeIDE } from "./code-ide";
import {
  FullScreenDialog,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogTitle,
  FullScreenDialogDescription,
  FullScreenDialogTrigger,
} from "@/components/ui/full-screen-dialog";
import { Button } from "@/components/ui/button";
import { Code2, ExternalLink } from "lucide-react";
import type { ExecutionResult } from "./types";

interface CodeEditorDialogProps {
  /** Assignment ID for context-aware execution */
  assignmentId?: string;
  /** Initial code to display */
  initialCode?: string;
  /** Initial programming language (Judge0 language ID) */
  initialLanguage?: number;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Show submit button (for student submissions) */
  showSubmitButton?: boolean;
  /** Show AI Assistant tab */
  showAIAssistant?: boolean;
  /** Callback when code is executed */
  onExecute?: (result: ExecutionResult) => void;
  /** Callback when code is submitted */
  onSubmit?: (code: string, language: number) => void;
  /** Trigger button render prop */
  trigger?: (onClick: () => void) => React.ReactNode;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
}

export function CodeEditorDialog({
  assignmentId,
  initialCode,
  initialLanguage,
  readOnly = false,
  showSubmitButton = false,
  showAIAssistant = false,
  onExecute,
  onSubmit,
  trigger,
  title = "Code Editor",
  description = "Write and execute your code",
}: CodeEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    setIsMaximized(false);
  }, []);

  const handleExecute = useCallback(
    (result: ExecutionResult) => {
      onExecute?.(result);
    },
    [onExecute],
  );

  const handleSubmit = useCallback(
    (code: string, language: number) => {
      onSubmit?.(code, language);
      // Close dialog after successful submission
      setOpen(false);
    },
    [onSubmit],
  );

  const handleOpenInNewWindow = useCallback(() => {
    if (assignmentId) {
      const url = `/ide/student/${assignmentId}`;
      window.open(url, "gradeloop-ide", "width=1400,height=900");
      setOpen(false);
    }
  }, [assignmentId]);

  const defaultTrigger = (onClick: () => void) => (
    <Button onClick={onClick} variant="outline" className="gap-2">
      <Code2 className="h-4 w-4" />
      Open Code Editor
    </Button>
  );

  return (
    <FullScreenDialog open={open} onOpenChange={handleOpenChange}>
      <FullScreenDialogTrigger asChild>
        {trigger
          ? trigger(() => setOpen(true))
          : defaultTrigger(() => setOpen(true))}
      </FullScreenDialogTrigger>
      <FullScreenDialogContent
        showMaximize
        onMaximize={handleToggleMaximize}
        isMaximized={isMaximized}
        className="p-0"
      >
        <FullScreenDialogHeader
          showMaximize
          onMaximize={handleToggleMaximize}
          isMaximized={isMaximized}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <FullScreenDialogTitle>{title}</FullScreenDialogTitle>
              <FullScreenDialogDescription>
                {description}
              </FullScreenDialogDescription>
            </div>
          </div>
          {assignmentId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewWindow}
              className="gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="text-xs">Open in New Window</span>
            </Button>
          )}
        </FullScreenDialogHeader>
        <div className="flex-1 overflow-hidden">
          <CodeIDE
            assignmentId={assignmentId}
            initialCode={initialCode}
            initialLanguage={initialLanguage}
            onExecute={handleExecute}
            onSubmit={showSubmitButton ? handleSubmit : undefined}
            readOnly={readOnly}
            showSubmitButton={showSubmitButton}
            showAIAssistant={showAIAssistant}
          />
        </div>
      </FullScreenDialogContent>
    </FullScreenDialog>
  );
}
