"use client";

import { useState, useCallback } from "react";
import { assessmentsApi } from "@/lib/api/assessments";
import type { RunCodeRequest, RunCodeResponse } from "@/types/assessments.types";
import type { ExecutionResult } from "@/components/ide/types";
import { toast } from "sonner";

interface UseCodeExecutionOptions {
  assignmentId?: string;
  /** When set, running code with a different language ID is blocked client-side. */
  expectedLanguageId?: number;
  onSuccess?: (result: ExecutionResult) => void;
  onError?: (error: Error) => void;
}

interface UseCodeExecutionReturn {
  execute: (params: {
    sourceCode: string;
    languageId: number;
    stdin?: string;
  }) => Promise<void>;
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: Error | null;
  reset: () => void;
}

export function useCodeExecution({
  assignmentId,
  expectedLanguageId,
  onSuccess,
  onError,
}: UseCodeExecutionOptions = {}): UseCodeExecutionReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async ({
      sourceCode,
      languageId,
      stdin = "",
    }: {
      sourceCode: string;
      languageId: number;
      stdin?: string;
    }) => {
      if (!sourceCode.trim()) {
        toast.error("Cannot run empty code");
        return;
      }

      // Guard: reject if the chosen language doesn't match the assignment language.
      if (expectedLanguageId !== undefined && languageId !== expectedLanguageId) {
        const err = new Error(
          `This assignment requires language ID ${expectedLanguageId}. Please switch back to the correct language.`
        );
        toast.error(err.message);
        onError?.(err);
        return;
      }

      try {
        setIsExecuting(true);
        setError(null);

        const request: RunCodeRequest = {
          assignment_id: assignmentId,
          language_id: languageId,
          source_code: sourceCode,
          stdin: stdin || undefined,
        };

        const response: RunCodeResponse = await assessmentsApi.runCode(request);

        // Adapt the flat backend response to the nested ExecutionResult shape
        // used by IDE components.
        const executionResult: ExecutionResult = {
          stdout: response.stdout,
          stderr: response.stderr,
          compile_output: response.compile_output,
          status: {
            id: response.status_id,
            description: response.status ?? "",
          },
          time: response.execution_time,
          memory: response.memory_used,
          exit_code: null,
          exit_signal: null,
        };

        setResult(executionResult);

        // Show success toast if execution completed
        if (response.status_id === 3) {
          toast.success("Code executed successfully");
        } else if (response.status_id === 6) {
          toast.error("Compilation failed");
        } else if (response.status_id >= 7 && response.status_id <= 12) {
          toast.error("Runtime error occurred");
        } else if (response.status_id === 5) {
          toast.error("Time limit exceeded");
        }

        onSuccess?.(executionResult);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to execute code");
        setError(error);

        console.error("Code execution error:", err);
        toast.error(error.message || "Failed to execute code");

        onError?.(error);
      } finally {
        setIsExecuting(false);
      }
    },
    [assignmentId, onSuccess, onError, expectedLanguageId]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    execute,
    isExecuting,
    result,
    error,
    reset,
  };
}
