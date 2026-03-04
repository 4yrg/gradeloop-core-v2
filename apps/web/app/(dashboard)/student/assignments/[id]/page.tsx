"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodeEditor } from "@/components/dashboard/code-editor";
import { assessmentApi } from "@/lib/api/assessments";
import { PROGRAMMING_LANGUAGES, getLanguageById, getDefaultLanguage } from "@/lib/constants/languages";
import type { Assignment, ProgrammingLanguage, Submission } from "@/types/assessment.types";
import { useAuthStore } from "@/lib/stores/authStore";

export default function AssignmentIDEPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;
  const { user } = useAuthStore();

  const [assignment, setAssignment] = React.useState<Assignment | null>(null);
  const [code, setCode] = React.useState("");
  const [selectedLanguage, setSelectedLanguage] = React.useState<ProgrammingLanguage>("python");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [lastSubmission, setLastSubmission] = React.useState<Submission | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<string | null>(null);
  const [timerStarted, setTimerStarted] = React.useState(false);

  // Fetch assignment and last submission
  React.useEffect(() => {
    const fetchAssignmentData = async () => {
      try {
        setLoading(true);
        const assignmentData = await assessmentApi.getAssignment(assignmentId);
        setAssignment(assignmentData);

        // Try to fetch the latest submission
        if (user?.id) {
          try {
            const latestSubmission = await assessmentApi.getLatestSubmission(
              assignmentId,
              user.id,
            );
            setLastSubmission(latestSubmission);

            // Fetch the code for the latest submission
            const submissionCode = await assessmentApi.getSubmissionCode(latestSubmission.id);
            setCode(submissionCode.code);
            if (submissionCode.language) {
              setSelectedLanguage(submissionCode.language as ProgrammingLanguage);
            }
          } catch (err) {
            // No previous submission, use default code
            const defaultLang = getDefaultLanguage();
            setCode(defaultLang.defaultCode);
            setSelectedLanguage(defaultLang.id);
          }
        } else {
          const defaultLang = getDefaultLanguage();
          setCode(defaultLang.defaultCode);
          setSelectedLanguage(defaultLang.id);
        }
      } catch (err) {
        console.error("Failed to fetch assignment:", err);
        setError("Failed to load assignment. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignmentData();
  }, [assignmentId, user]);

  // Timer for time-limited assignments
  React.useEffect(() => {
    if (!assignment?.enforce_time_limit || !timerStarted) return;

    const endTime = Date.now() + assignment.enforce_time_limit * 60 * 1000;

    const interval = setInterval(() => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setTimeRemaining("Time's up!");
        clearInterval(interval);
        handleAutoSubmit();
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [assignment, timerStarted]);

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

  const handleStartTimer = () => {
    if (assignment?.enforce_time_limit) {
      setTimerStarted(true);
    }
  };

  const handleRun = () => {
    // TODO: Implement code execution (this would typically hit a code execution service)
    alert("Code execution feature coming soon! This would run your code in a sandboxed environment.");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      await assessmentApi.createSubmission({
        assignment_id: assignmentId,
        language: selectedLanguage,
        code: code,
      });

      setSuccessMessage("Code saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to save code:", err);
      setError(err.response?.data?.message || "Failed to save code. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError("Please write some code before submitting.");
      return;
    }

    const confirmSubmit = window.confirm(
      "Are you sure you want to submit this assignment? This will create a new submission version."
    );

    if (!confirmSubmit) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const submission = await assessmentApi.createSubmission({
        assignment_id: assignmentId,
        language: selectedLanguage,
        code: code,
      });

      setLastSubmission(submission);
      setSuccessMessage(
        `Assignment submitted successfully! Version ${submission.version}`
      );
      
      // Optionally redirect after a delay
      setTimeout(() => {
        router.push("/student/assignments");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to submit assignment:", err);
      setError(err.response?.data?.message || "Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    // Auto-submit when time runs out
    await handleSubmit();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Assignment not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getDueDateStatus = () => {
    if (!assignment.due_at) return null;

    const now = new Date();
    const dueDate = new Date(assignment.due_at);
    const lateDueDate = assignment.late_due_at ? new Date(assignment.late_due_at) : null;

    if (now > dueDate && (!lateDueDate || now > lateDueDate)) {
      return { status: "overdue", color: "text-red-600", label: "Overdue" };
    } else if (now > dueDate && lateDueDate && now <= lateDueDate) {
      return { status: "late", color: "text-orange-600", label: "Late Period" };
    } else {
      return { status: "active", color: "text-green-600", label: "On Time" };
    }
  };

  const dueDateStatus = getDueDateStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button variant="ghost" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
          {assignment.code && (
            <Badge variant="secondary">{assignment.code}</Badge>
          )}
        </div>
        {dueDateStatus && (
          <Badge
            variant={dueDateStatus.status === "overdue" ? "destructive" : "outline"}
            className={dueDateStatus.color}
          >
            {dueDateStatus.label}
          </Badge>
        )}
      </div>

      {/* Assignment Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assignment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{assignment.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {assignment.due_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Due Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(assignment.due_at), "MMM dd, h:mm a")}
                  </p>
                </div>
              </div>
            )}

            {assignment.enforce_time_limit && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Time Limit</p>
                  <p className="text-sm font-medium">{assignment.enforce_time_limit} minutes</p>
                </div>
              </div>
            )}

            {lastSubmission && (
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Last Submission</p>
                  <p className="text-sm font-medium">Version {lastSubmission.version}</p>
                </div>
              </div>
            )}

            {assignment.allow_group_submission && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-500">Group Size</p>
                  <p className="text-sm font-medium">Max {assignment.max_group_size}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timer Alert */}
      {assignment.enforce_time_limit && !timerStarted && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Time-Limited Assignment</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              This assignment has a {assignment.enforce_time_limit} minute time limit. 
              Click &quot;Start Timer&quot; when you&apos;re ready to begin.
            </span>
            <Button onClick={handleStartTimer} size="sm">
              Start Timer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {assignment.enforce_time_limit && timerStarted && timeRemaining && (
        <Alert variant={timeRemaining.includes("Time's up") ? "destructive" : "default"}>
          <Clock className="h-4 w-4" />
          <AlertTitle>Time Remaining</AlertTitle>
          <AlertDescription className="text-lg font-bold">
            {timeRemaining}
          </AlertDescription>
        </Alert>
      )}

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
                Save often to avoid losing your work. Submit when you&apos;re ready.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRun}
                disabled={submitting || saving || !code.trim()}
              >
                <Play className="h-4 w-4 mr-2" />
                Run Code
              </Button>

              <Button
                variant="outline"
                onClick={handleSave}
                disabled={submitting || saving || !code.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={submitting || saving || !code.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Assignment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submission History */}
      {lastSubmission && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submission History</CardTitle>
            <CardDescription>Your previous submissions for this assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div>
                  <p className="font-medium">Version {lastSubmission.version}</p>
                  <p className="text-sm text-zinc-500">
                    Submitted {format(new Date(lastSubmission.submitted_at), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
                <Badge variant="outline">{lastSubmission.language || "N/A"}</Badge>
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Only showing latest submission. View full history in your profile.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
