"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Loader2,
  FlaskConical,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdeRunResponse } from "@/types/assessments.types";

type TestResult = IdeRunResponse["test_results"][number];

interface TestCasesPanelProps {
  results: IdeRunResponse["test_results"] | null;
  isRunning: boolean;
  error?: string | null;
  onClose: () => void;
}

function ResultDetail({ result }: { result: TestResult }) {
  return (
    <div className="space-y-3 px-4 py-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        {result.passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            result.passed ? "text-emerald-500" : "text-destructive"
          )}
        >
          {result.passed ? "Accepted" : result.status_description}
        </span>
        {result.execution_time && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto font-mono">
            <Clock className="h-3 w-3" />
            {result.execution_time}s
          </span>
        )}
      </div>

      {result.test_input !== undefined && result.test_input !== "" && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-mono">Input =</p>
          <div className="bg-muted rounded-md px-3 py-2">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
              {result.test_input}
            </pre>
          </div>
        </div>
      )}

      {result.expected_output !== undefined && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-mono">Expected Output =</p>
          <div className="bg-muted rounded-md px-3 py-2">
            <code className="text-xs font-mono text-foreground">
              {result.expected_output || "(empty)"}
            </code>
          </div>
        </div>
      )}

      {result.actual_output !== undefined && (
        <div>
          <p
            className={cn(
              "text-xs mb-1 font-mono",
              result.passed ? "text-muted-foreground" : "text-destructive"
            )}
          >
            {result.passed ? "Output =" : "Actual Output ="}
          </p>
          <div
            className={cn(
              "rounded-md px-3 py-2",
              result.passed ? "bg-muted" : "bg-destructive/10"
            )}
          >
            <code
              className={cn(
                "text-xs font-mono",
                result.passed ? "text-foreground" : "text-destructive"
              )}
            >
              {result.actual_output || "(empty)"}
            </code>
          </div>
        </div>
      )}

      {(result.compile_output || result.stderr) && (
        <div>
          <p className="text-xs text-destructive mb-1">
            {result.compile_output ? "Compile Error" : "Runtime Error"}
          </p>
          <div className="bg-destructive/10 rounded-md px-3 py-2">
            <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">
              {result.compile_output || result.stderr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TestCasesPanel({
  results,
  isRunning,
  error,
  onClose,
}: TestCasesPanelProps) {
  const [activeCase, setActiveCase] = useState(0);

  const passed = results?.filter((r) => r.passed).length ?? 0;
  const total = results?.length ?? 0;

  // Reset active case when results change
  useEffect(() => {
    setActiveCase(0);
  }, [results]);

  return (
    <div
      className="flex flex-col border-t border-border bg-background shrink-0"
      style={{ height: 240 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center border-b border-border shrink-0 bg-muted/20 px-4">
        <span className="py-2 text-xs font-medium text-foreground border-b-2 border-foreground -mb-px">
          Test Result
        </span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin ml-2" />}
        {!isRunning && results && total > 0 && (
          <span
            className={cn(
              "text-[10px] font-mono font-semibold ml-2",
              passed === total ? "text-emerald-500" : "text-destructive"
            )}
          >
            {passed}/{total}
          </span>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {isRunning ? (
          <div className="flex items-center gap-2.5 px-4 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Running test cases…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-4 py-4 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Test run failed: {error}</span>
          </div>
        ) : results === null ? (
          <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
            <FlaskConical className="h-4 w-4" />
            Press Run to execute test cases.
          </div>
        ) : total === 0 ? (
          <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
            <FlaskConical className="h-4 w-4" />
            No visible test cases for this assignment.
          </div>
        ) : (
          <>
            {/* Case pills with pass/fail colour */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
              {results.map((r, i) => (
                <button
                  key={r.test_case_id || i}
                  onClick={() => setActiveCase(i)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors",
                    activeCase === i
                      ? r.passed
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {r.passed ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {r.test_case_description || `Case ${i + 1}`}
                </button>
              ))}
            </div>

            {results[activeCase] && (
              <ResultDetail result={results[activeCase]} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
