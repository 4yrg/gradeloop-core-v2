"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Save,
    Send,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    Info,
    Code2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/authStore";
import { assessmentApi } from "@/lib/api/assessments";
import type { Assignment } from "@/types/assessment.types";
import type { FileLanguage } from "@/types/code-editor.types";
import dynamic from "next/dynamic";

const MonacoCodeEditor = dynamic(
    () => import("@/components/dashboard/monaco-editor").then((m) => m.MonacoCodeEditor),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-zinc-500"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading editor…</div> }
);

const LANG_MAP: Record<string, FileLanguage> = {
    python: "python",
    javascript: "javascript",
    typescript: "typescript",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    rust: "rust",
};

function resolveLanguage(code?: string): FileLanguage {
    if (!code) return "python";
    const lower = code.toLowerCase();
    return LANG_MAP[lower] ?? "python";
}

function formatDue(dateStr?: string): string {
    if (!dateStr) return "No deadline";
    return new Date(dateStr).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isDueUrgent(dateStr?: string): boolean {
    if (!dateStr) return false;
    const diff = new Date(dateStr).getTime() - Date.now();
    return diff > 0 && diff < 48 * 60 * 60 * 1000;
}

function isDuePassed(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
}

export default function StudentAssignmentIDEPage() {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [assignment, setAssignment] = React.useState<Assignment | null>(null);
    const [code, setCode] = React.useState("");
    const [loadingAssignment, setLoadingAssignment] = React.useState(true);
    const [loadingSubmission, setLoadingSubmission] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const [lastSubmissionId, setLastSubmissionId] = React.useState<string | null>(null);
    const [hasDraft, setHasDraft] = React.useState(false);

    const draftKey = `draft_${assignmentId}_${user?.id ?? "anon"}`;

    // Load assignment metadata
    React.useEffect(() => {
        if (!assignmentId) return;
        let cancelled = false;
        setLoadingAssignment(true);
        assessmentApi
            .getAssignment(assignmentId)
            .then((a) => {
                if (cancelled) return;
                setAssignment(a);
            })
            .catch(() => {
                if (!cancelled) toast.error("Failed to load assignment details.");
            })
            .finally(() => {
                if (!cancelled) setLoadingAssignment(false);
            });
        return () => { cancelled = true; };
    }, [assignmentId]);

    // Load existing submission code (latest), then fall back to localStorage draft
    React.useEffect(() => {
        if (!assignmentId || !user?.id) return;
        let cancelled = false;
        setLoadingSubmission(true);

        const draft = localStorage.getItem(draftKey);

        assessmentApi
            .getLatestSubmission(assignmentId, user.id)
            .then(async (submission) => {
                if (cancelled) return;
                setLastSubmissionId(submission.id);
                const codeRes = await assessmentApi.getSubmissionCode(submission.id);
                if (!cancelled && codeRes.code) {
                    setCode(codeRes.code);
                    return;
                }
                if (!cancelled && draft) {
                    setCode(draft);
                    setHasDraft(true);
                }
            })
            .catch(() => {
                if (!cancelled && draft) {
                    setCode(draft);
                    setHasDraft(true);
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingSubmission(false);
            });

        return () => { cancelled = true; };
    }, [assignmentId, user?.id, draftKey]);

    function handleSaveDraft() {
        localStorage.setItem(draftKey, code);
        setHasDraft(true);
        toast.success("Draft saved locally.");
    }

    async function handleSubmit() {
        if (!assignment) return;
        setSubmitting(true);
        try {
            const language = assignment.code ?? "python";
            const submission = await assessmentApi.createSubmission({
                assignment_id: assignment.id,
                language,
                code,
            });
            setLastSubmissionId(submission.id);
            setSubmitted(true);
            localStorage.removeItem(draftKey);
            setHasDraft(false);
            toast.success("Assignment submitted successfully!");
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Submission failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const language = resolveLanguage(assignment?.code);
    const duePassed = isDuePassed(assignment?.due_at);
    const canSubmit = !duePassed || assignment?.allow_late_submissions;

    if (loadingAssignment) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading assignment…
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-zinc-500">
                <AlertCircle className="h-8 w-8" />
                <p>Assignment not found or you don&apos;t have access.</p>
                <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/student/assignments")}
                        className="gap-1 -ml-1"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Assignments
                    </Button>
                    <Separator orientation="vertical" className="h-5" />
                    <div>
                        <h1 className="font-semibold text-sm leading-tight">{assignment.title}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <Code2 className="h-3 w-3 mr-1" />
                                {assignment.code ?? "python"}
                            </Badge>
                            {assignment.allow_group_submission && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">Group</Badge>
                            )}
                            {assignment.due_at && (
                                <span
                                    className={`text-xs flex items-center gap-1 ${
                                        duePassed
                                            ? "text-red-600 dark:text-red-400"
                                            : isDueUrgent(assignment.due_at)
                                            ? "text-orange-600 dark:text-orange-400"
                                            : "text-zinc-500"
                                    }`}
                                >
                                    <Clock className="h-3 w-3" />
                                    {duePassed ? "Overdue — " : "Due: "}
                                    {formatDue(assignment.due_at)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasDraft && (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Unsaved draft
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveDraft}
                        disabled={submitting}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        Save Draft
                    </Button>
                    {canSubmit && !submitted && (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={submitting || !code.trim()}
                        >
                            {submitting ? (
                                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Submitting…</>
                            ) : (
                                <><Send className="h-4 w-4 mr-1" />Submit</>
                            )}
                        </Button>
                    )}
                    {submitted && (
                        <Badge className="bg-green-600 text-white gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Submitted
                        </Badge>
                    )}
                </div>
            </div>

            {/* Submission success banner */}
            {submitted && lastSubmissionId && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-200 shrink-0">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                        Your submission was recorded. Similarity and quality analysis (AcaFS) will be processed shortly.
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                        ID: {lastSubmissionId.slice(0, 8)}…
                    </span>
                </div>
            )}

            {/* Late submission warning */}
            {duePassed && assignment.allow_late_submissions && (
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-800 text-sm text-orange-700 dark:text-orange-300 shrink-0">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Deadline has passed. Late submissions are allowed for this assignment.
                </div>
            )}
            {duePassed && !assignment.allow_late_submissions && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 shrink-0">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Deadline has passed. Submissions are no longer accepted for this assignment.
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Description panel */}
                {assignment.description && (
                    <aside className="w-72 shrink-0 border-r overflow-y-auto bg-background">
                        <div className="p-4">
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                Assignment Details
                            </h2>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                {assignment.description}
                            </p>
                            {(assignment.enable_ai_assistant || assignment.enable_socratic_feedback) && (
                                <div className="mt-4 space-y-1">
                                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                                        Options
                                    </p>
                                    {assignment.enable_ai_assistant && (
                                        <Badge variant="secondary" className="text-xs">AI Assistant</Badge>
                                    )}
                                    {assignment.enable_socratic_feedback && (
                                        <Badge variant="secondary" className="text-xs">Socratic Feedback</Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </aside>
                )}

                {/* Editor */}
                <div className="flex-1 overflow-hidden relative">
                    {loadingSubmission && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mr-2" />
                            <span className="text-sm text-zinc-500">Loading your previous work…</span>
                        </div>
                    )}
                    <Card className="h-full rounded-none border-0 shadow-none">
                        <CardContent className="h-full p-0">
                            <MonacoCodeEditor
                                value={code}
                                language={language}
                                onChange={(v) => setCode(v ?? "")}
                                readOnly={(!canSubmit && submitted) || (duePassed && !assignment.allow_late_submissions)}
                                height="100%"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
