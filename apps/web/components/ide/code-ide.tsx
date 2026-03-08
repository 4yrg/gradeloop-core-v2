"use client";

import { useState, useEffect, useCallback } from "react";
import { EditorPanel } from "./editor-panel";
import { ExecutionPanel } from "./execution-panel";
import { StatusBar } from "./status-bar";
import { Toolbar } from "./toolbar";
import { AIAssistantPanel } from "./ai-assistant-panel";
import { GradeResultPanel } from "@/components/assessments/grade-result-panel";
import { TestCasesPanel } from "./test-cases-panel";
import { useCodeExecution } from "@/lib/hooks/use-code-execution";
import { acafsApi } from "@/lib/api/assessments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Sparkles, BarChart2, Loader2 } from "lucide-react";
import type { CodeIDEProps, ExecutionStatus } from "./types";
import type { IdeRunResponse } from "@/types/assessments.types";
import {
  DEFAULT_LANGUAGE_ID,
  DEFAULT_FONT_SIZE,
  STORAGE_KEYS,
  STATUS_MAP,
  STARTER_CODE,
} from "./constants";
import { useTheme } from "next-themes";

export function CodeIDE({
  assignmentId,
  assignmentTitle,
  assignmentDescription,
  userId,
  initialCode,
  initialLanguage = DEFAULT_LANGUAGE_ID,
  onExecute,
  onSubmit,
  readOnly = false,
  showSubmitButton = false,
  showAIAssistant = false,
  showGradePanel = false,
  lockLanguage = false,
  grade = null,
  isGrading = false,
  testCases,
}: CodeIDEProps) {
  const { theme: systemTheme } = useTheme();
  const theme = (systemTheme === "dark" ? "dark" : "light") as "dark" | "light";

  // Controlled tab state so we can auto-switch to "results" when grade arrives.
  const [activeTab, setActiveTab] = useState<string>("input-output");

  // Auto-switch to the Results tab as soon as a grade is available.
  useEffect(() => {
    if (grade) setActiveTab("results");
  }, [grade]);

  // Editor state
  const [code, setCode] = useState<string>(
    initialCode || STARTER_CODE[initialLanguage] || "// Start coding here...\n"
  );
  const [language, setLanguage] = useState<number>(initialLanguage);
  const [stdin, setStdin] = useState<string>("");
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);

  // Code execution
  const { execute, isExecuting, result, error } = useCodeExecution({
    assignmentId,
    onSuccess: (result) => {
      onExecute?.(result);
    },
  });

  // Test cases bottom panel state
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<IdeRunResponse["test_results"] | null>(null);
  const [testRunError, setTestRunError] = useState<string | null>(null);

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
      if (savedFontSize) {
        setFontSize(parseInt(savedFontSize, 10));
      }

      const savedLanguage = localStorage.getItem(STORAGE_KEYS.LAST_LANGUAGE);
      if (savedLanguage && !initialLanguage && !lockLanguage) {
        setLanguage(parseInt(savedLanguage, 10));
      }
    }
  }, [initialLanguage]);

  // Save font size to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize.toString());
    }
  }, [fontSize]);

  // Save last language to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.LAST_LANGUAGE, language.toString());
    }
  }, [language]);

  // Update code when language changes (load starter code)
  const handleLanguageChange = useCallback(
    (newLanguage: number) => {
      setLanguage(newLanguage);
      
      // If code is empty or default, load starter code for new language
      if (!code.trim() || code === "// Start coding here...\n") {
        const starterCode = STARTER_CODE[newLanguage];
        if (starterCode) {
          setCode(starterCode);
        }
      }
    },
    [code]
  );

  /**
   * Primary Run — executes assignment test cases (each with their own input
   * and expected output set during assignment creation). The user's custom
   * stdin is NOT used here; every test case is fully self-contained.
   * Falls back to a plain I/O execution when no test cases are assigned.
   */
  const handleRun = useCallback(() => {
    if (testCases && testCases.length > 0) {
      // Test-case mode: run each case with its own input and compare against
      // its own expected_output. User stdin is irrelevant here.
      setTestPanelOpen(true);
      setIsRunningTests(true);
      setTestResults(null);
      setTestRunError(null);

      acafsApi
        .runIdeTests({
          language_id: language,
          source_code: code,
          test_cases: testCases as Array<Record<string, unknown>>,
        })
        .then((res) => {
          setTestResults(res.test_results);
          setTestRunError(null);
        })
        .catch((err) => {
          const msg =
            (err instanceof Error ? err.message : null) ??
            "Code execution service unavailable";
          setTestRunError(msg);
          setTestResults(null);
        })
        .finally(() => setIsRunningTests(false));
    } else {
      // No test cases — fall back to plain I/O execution with user stdin.
      execute({ sourceCode: code, languageId: language, stdin });
    }
  }, [code, language, stdin, execute, testCases]);

  /**
   * Custom Run — executes the code with the user's stdin from the I/O panel.
   * Only available when test cases are present (otherwise Run already does this).
   */
  const handleCustomRun = useCallback(() => {
    execute({ sourceCode: code, languageId: language, stdin });
  }, [code, language, stdin, execute]);

  const handleSubmit = useCallback(() => {
    if (onSubmit) {
      onSubmit(code, language);
    }
  }, [code, language, onSubmit]);

  const handleSave = useCallback(() => {
    // Save draft to localStorage
    if (typeof window !== "undefined" && assignmentId) {
      const draftKey = `${STORAGE_KEYS.LAST_LANGUAGE}-draft-${assignmentId}`;
      localStorage.setItem(draftKey, JSON.stringify({ code, language, stdin }));
      
      // Show toast notification
      import("sonner").then(({ toast }) => {
        toast.success("Draft saved locally");
      });
    }
  }, [code, language, stdin, assignmentId]);

  // Calculate execution status
  const getExecutionStatus = (): ExecutionStatus => {
    if (isExecuting) return "running";
    if (!result) return "idle";
    return STATUS_MAP[result.status.id] || "idle";
  };

  const statusBarData = {
    status: getExecutionStatus(),
    time: result?.time || null,
    memory: result?.memory || null,
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <Toolbar
        onRun={handleRun}
        onCustomRun={testCases && testCases.length > 0 ? handleCustomRun : undefined}
        onSubmit={showSubmitButton ? handleSubmit : undefined}
        onSave={handleSave}
        isExecuting={isExecuting}
        isRunningTests={isRunningTests}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        showSubmitButton={showSubmitButton}
        disabled={readOnly}
      />

      {/* Main content area with 2-panel layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Editor (60%) */}
        <div className="flex flex-1 flex-col min-w-0">
          <EditorPanel
            value={code}
            onChange={setCode}
            language={language}
            fontSize={fontSize}
            readOnly={readOnly}
            theme={theme}
            onRun={handleRun}
            onSave={handleSave}
          />
        </div>
        
        {/* Right: Tabbed Panel (40%) + inline Test Cases below */}
        <div className="w-[400px] shrink-0 flex flex-col overflow-hidden border-l border-border">
          {/* Top portion: Input/Output, AI Assistant, Results tabs */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              <TabsList
                className={`grid w-full rounded-none border-b ${
                  [showAIAssistant, showGradePanel].filter(Boolean).length === 2
                    ? "grid-cols-3"
                    : [showAIAssistant, showGradePanel].some(Boolean)
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                <TabsTrigger value="input-output" className="gap-2 rounded-none">
                  <Terminal className="h-4 w-4" />
                  Input / Output
                </TabsTrigger>
                {showAIAssistant && (
                  <TabsTrigger value="ai-assistant" className="gap-2 rounded-none">
                    <Sparkles className="h-4 w-4" />
                    AI Assistant
                  </TabsTrigger>
                )}
                {showGradePanel && (
                  <TabsTrigger value="results" className="gap-2 rounded-none">
                    <BarChart2 className="h-4 w-4" />
                    Results
                    {isGrading && (
                      <Loader2 className="h-3 w-3 animate-spin ml-0.5" />
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="input-output" className="flex-1 m-0 overflow-hidden">
                <ExecutionPanel
                  stdin={stdin}
                  onStdinChange={setStdin}
                  result={result}
                  isExecuting={isExecuting}
                />
              </TabsContent>

              {showAIAssistant && (
                <TabsContent value="ai-assistant" className="flex-1 m-0 overflow-hidden">
                  <AIAssistantPanel
                    assignmentId={assignmentId}
                    assignmentTitle={assignmentTitle}
                    assignmentDescription={assignmentDescription}
                    userId={userId}
                    studentCode={code}
                  />
                </TabsContent>
              )}

              {showGradePanel && (
                <TabsContent value="results" className="flex-1 m-0 overflow-y-auto">
                  {isGrading && !grade ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[200px] text-center p-6">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Autograding your submission…</p>
                      <p className="text-xs text-muted-foreground">
                        Running test cases and AI rubric analysis. This usually takes 15–60 seconds.
                      </p>
                    </div>
                  ) : grade ? (
                    <GradeResultPanel grade={grade} compact instructorView={false} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] text-center p-6">
                      <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Submit your code to see AI-generated feedback and marks.
                      </p>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Test Cases Panel — docked to the bottom of the right panel */}
          {((testCases && testCases.length > 0) || testPanelOpen || isRunningTests) && (
            <TestCasesPanel
              results={testResults}
              isRunning={isRunningTests}
              error={testRunError}
              onClose={() => {
                setTestPanelOpen(false);
                setTestResults(null);
                setTestRunError(null);
              }}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        data={statusBarData}
        isExecuting={isExecuting}
        language={language}
        onLanguageChange={handleLanguageChange}
        languageSelectorDisabled={readOnly || isExecuting || lockLanguage}
      />
    </div>
  );
}
