"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { assessmentsApi, acafsApi } from "@/lib/api/assessments";
import type { RunCodeRequest, RunCodeResponse } from "@/types/assessments.types";
import type { ExecutionResult } from "@/components/ide/types";
import { toast } from "sonner";

interface UseCodeExecutionOptions {
  assignmentId?: string;
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

      try {
        setIsExecuting(true);
        setError(null);

        // Route through ACAFS (Python/httpx) which creates a fresh connection
        // per Judge0 call — avoids the Go HTTP connection-pool stale-connection
        // issue that caused intermittent 500s from the assessment service.
        const response: RunCodeResponse = await acafsApi.runIde({
          language_id: languageId,
          source_code: sourceCode,
          stdin: stdin || undefined,
        });

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
        // Extract the most useful message: backend JSON > axios message > fallback
        let errorMessage = "Failed to execute code";
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (axios.isAxiosError(err)) {
          const backendMsg = err.response?.data?.message as string | undefined;
          errorMessage = backendMsg || err.message || errorMessage;
        }

        const error = new Error(errorMessage);
        setError(error);
        
        console.error("Code execution error:", err);
        toast.error(errorMessage);
        
        onError?.(error);
      } finally {
        setIsExecuting(false);
      }
    },
    [assignmentId, onSuccess, onError]
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
