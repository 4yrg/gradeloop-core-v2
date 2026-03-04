"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Play,
  Save,
  Send,
  Clock,
  Calendar,
  Users,
  FileCode,
  History,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodeEditor } from "@/components/dashboard/code-editor";
import { PROGRAMMING_LANGUAGES, getLanguageById, getDefaultLanguage } from "@/lib/constants/languages";
import type { ProgrammingLanguage } from "@/types/assessment.types";

/**
 * IDE Test Page - Standalone version for testing the IDE without an assignment
 * This page contains the same UI as the assignment IDE page but with mock data
 * Buttons will not work as expected since there's no real assignment ID
 */
export default function IDETestPage() {
  const router = useRouter();

  // Mock assignment data
  const mockAssignment = {
    id: "test-assignment",
    title: "Test Assignment (IDE Preview)",
    code: "TEST-101",
    description: "This is a test page to preview the IDE interface without needing a real assignment. All data is mocked and buttons won't perform actual operations.",
    due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    enforce_time_limit: null,
    allow_group_submission: false,
    max_group_size: 1,
  };

  const [code, setCode] = React.useState("");
  const [selectedLanguage, setSelectedLanguage] = React.useState<ProgrammingLanguage>("python");
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize with default code
  React.useEffect(() => {
    const defaultLang = getDefaultLanguage();
    setCode(defaultLang.defaultCode);
    setSelectedLanguage(defaultLang.id);
  }, []);

  const handleLanguageChange = (language: string) => {
    const newLang = language as ProgrammingLanguage;
    setSelectedLanguage(newLang);
    
    // If code is still default, update to new language default
    const currentLang = getLanguageById(selectedLanguage);
    if (currentLang && code === currentLang.defaultCode) {
      const newLangConfig = getLanguageById(newLang);
      if (newLangConfig) {
        setCode(newLangConfig.defaultCode);
      }
    }
  };

  const handleRun = () => {
    setSuccessMessage("Test Mode: Code execution is not available in test mode.");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSave = () => {
    setSuccessMessage("Test Mode: Code saved (mock operation)");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSubmit = () => {
    setSuccessMessage("Test Mode: Submission created (mock operation)");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const dueDateStatus = {
    status: "active",
    color: "text-green-600",
    label: "On Time (Mock)",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{mockAssignment.title}</h1>
          {mockAssignment.code && (
            <Badge variant="secondary">{mockAssignment.code}</Badge>
          )}
        </div>
        <Badge
          variant="outline"
          className={dueDateStatus.color}
        >
          {dueDateStatus.label}
        </Badge>
      </div>

      {/* Test Mode Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Test Mode</AlertTitle>
        <AlertDescription>
          This is a standalone IDE test page for development and testing purposes. 
          All data is mocked and actions won&apos;t save or submit to the backend.
        </AlertDescription>
      </Alert>

      {/* Assignment Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockAssignment.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{mockAssignment.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mockAssignment.due_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Due Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(mockAssignment.due_at), "MMM dd, h:mm a")}
                  </p>
                </div>
              </div>
            )}

            {mockAssignment.enforce_time_limit && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Time Limit</p>
                  <p className="text-sm font-medium">{mockAssignment.enforce_time_limit} minutes</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-xs text-zinc-500">Last Submission</p>
                <p className="text-sm font-medium">Version 1 (Mock)</p>
              </div>
            </div>

            {mockAssignment.allow_group_submission && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Group Size</p>
                  <p className="text-sm font-medium">Max {mockAssignment.max_group_size}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Code Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Code Editor
              </CardTitle>
              <CardDescription>Write your solution below</CardDescription>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Language:</label>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAMMING_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.id} value={lang.id}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CodeEditor
            value={code}
            onChange={setCode}
            language={selectedLanguage}
            height="600px"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Test mode: Actions will show mock messages only
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRun}
                disabled={!code.trim()}
              >
                <Play className="h-4 w-4 mr-2" />
                Run Code
              </Button>

              <Button
                variant="outline"
                onClick={handleSave}
                disabled={!code.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={!code.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Assignment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submission History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submission History</CardTitle>
          <CardDescription>Your previous submissions for this assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div>
                <p className="font-medium">Version 1 (Mock)</p>
                <p className="text-sm text-zinc-500">
                  Submitted {format(new Date(), "MMM dd, yyyy h:mm a")}
                </p>
              </div>
              <Badge variant="outline">{selectedLanguage}</Badge>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Only showing latest submission. View full history in your profile.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
