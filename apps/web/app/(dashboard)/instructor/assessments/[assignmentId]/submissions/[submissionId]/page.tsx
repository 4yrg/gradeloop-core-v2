"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { keystrokeApi, type ArchiveLookupResult } from "@/lib/api/keystroke";
import { acafsApi, instructorAssessmentsApi, assessmentsApi } from "@/lib/api/assessments";
import { usersApi } from "@/lib/api/users";
import {
    detectAICode,
    getSemanticSimilarity,
    saveSubmissionAnalysis,
} from "@/lib/api/cipas-client";
import type { AssignmentResponse, SubmissionGrade, SubmissionResponse } from "@/types/assessments.types";
import type { UserListItem } from "@/types/auth.types";
import { GradeResultPanel } from "@/components/assessments/grade-result-panel";
import { InstructorGradeOverridePanel } from "@/components/instructor/instructor-grade-override-panel";
import { SemanticSimilarityBadge } from "@/components/ui/semantic-similarity-badge";
import { AILikelihoodBadge } from "@/components/clone-detector/AILikelihoodBadge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, BrainCircuit, Loader2, RefreshCw, Sparkles, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PageProps {
    params: Promise<{ assignmentId: string; submissionId: string }>;
}

function riskBadgeVariant(risk: number): "default" | "secondary" | "destructive" {
    if (risk >= 0.5) return "destructive";
    if (risk >= 0.3) return "secondary";
    return "default";
}

function riskLabel(risk: number): string {
    if (risk >= 0.5) return "High risk";
    if (risk >= 0.3) return "Moderate risk";
    return "Low risk";
}

export default function SubmissionReviewPage({ params }: PageProps) {
    const { assignmentId, submissionId } = use(params);
    const user = useAuthStore((s) => s.user);

    const [assignment, setAssignment] = useState<AssignmentResponse | null>(null);
    const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
    const [student, setStudent] = useState<UserListItem | null>(null);
    const [grade, setGrade] = useState<SubmissionGrade | null>(null);
    const [loadingGrade, setLoadingGrade] = useState(true);
    const [pollCount, setPollCount] = useState(0);
    const [gradeError, setGradeError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Keystroke session archive (if available)
    const [archive, setArchive] = useState<ArchiveLookupResult | null>(null);

    const backHref = assignment
        ? `/instructor/courses/${assignment.course_instance_id}/assignments/${assignmentId}/submissions`
        : "/instructor/assessments/dashboard";

    const studentDisplayName =
        student?.full_name || student?.email || "Student profile unavailable";
    const studentSecondaryLabel =
        student?.student_id || (student?.full_name ? student.email : undefined);

    // Fetch submission + assignment metadata + keystroke archive on mount
    useEffect(() => {
        const fetchArchive = (userId: string) => {
            keystrokeApi
                .lookupArchive(assignmentId, userId)
                .then(setArchive)
                .catch(() => {/* No archive — silently ignore */});
        };

        const fetchStudent = (userId: string) => {
            usersApi
                .get(userId)
                .then(setStudent)
                .catch(() => setStudent(null));
        };

        instructorAssessmentsApi
            .listMyAssignments()
            .then((assignments) => {
                setAssignment(assignments.find((a) => a.id === assignmentId) ?? null);
            })
            .catch(() => setAssignment(null));

        // Try full submission first (includes CIPAS analysis fields)
        instructorAssessmentsApi
            .getSubmission(submissionId)
            .then((sub) => {
                setSubmission(sub);
                if (sub.user_id) {
                    fetchArchive(sub.user_id);
                    fetchStudent(sub.user_id);
                }
            })
            .catch(() => {
                // Fallback: search through the list
                instructorAssessmentsApi
                    .listSubmissions(assignmentId)
                    .then((resp: SubmissionResponse[]) => {
                        const found = resp.find((s: SubmissionResponse) => s.id === submissionId);
                        if (found) {
                            setSubmission(found);
                            if (found.user_id) {
                                fetchArchive(found.user_id);
                                fetchStudent(found.user_id);
                            }
                        }
                    })
                    .catch(() => {/* non-critical */});
            });
    }, [assignmentId, submissionId]);

    // Poll for grade with exponential back-off
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const delay = Math.min(2000 * Math.pow(1.5, pollCount), 30000);

        const fetch = async () => {
            try {
                const g = await acafsApi.getSubmissionGrade(submissionId);
                if (!cancelled) {
                    setGrade(g);
                    setLoadingGrade(false);
                }
            } catch (err) {
                if (err instanceof Error && err.message === "GRADING_PENDING") {
                    if (!cancelled) {
                        timer = setTimeout(() => setPollCount((n) => n + 1), delay);
                    }
                } else {
                    if (!cancelled) {
                        setGradeError("Could not load grade results.");
                        setLoadingGrade(false);
                    }
                }
            }
        };

        fetch();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [submissionId, pollCount]);

    // On-demand CIPAS analysis (or re-analysis) for this submission
    const handleAnalyze = useCallback(async () => {
        if (!submission) return;
        setIsAnalyzing(true);
        try {
            const codeRes = await assessmentsApi.getSubmissionCode(submissionId);
            if (!codeRes?.code) throw new Error("No code available");

            const sampleAnswerPromise = instructorAssessmentsApi
                .getAssignmentSampleAnswer(assignmentId)
                .then(sa => (sa?.code ? getSemanticSimilarity(codeRes.code, sa.code) : null))
                .catch(() => null);

            const [aiRes, semRes] = await Promise.allSettled([
                detectAICode(codeRes.code),
                sampleAnswerPromise,
            ]);

            const aiResult = aiRes.status === "fulfilled" ? aiRes.value : null;
            const semScore = semRes.status === "fulfilled" ? semRes.value : null;

            if (aiResult) {
                await saveSubmissionAnalysis(submissionId, {
                    ai_likelihood: aiResult.ai_likelihood,
                    human_likelihood: aiResult.human_likelihood,
                    is_ai_generated: aiResult.is_ai_generated,
                    ai_confidence: aiResult.confidence,
                    semantic_similarity_score: semScore,
                });

                setSubmission(prev => prev ? {
                    ...prev,
                    ai_likelihood: aiResult.ai_likelihood,
                    human_likelihood: aiResult.human_likelihood,
                    is_ai_generated: aiResult.is_ai_generated,
                    ai_confidence: aiResult.confidence,
                    semantic_similarity_score: semScore ?? undefined,
                    analyzed_at: new Date().toISOString(),
                } : prev);
                toast.success("Analysis complete");
            } else {
                toast.error("AI detection failed — please try again.");
            }
        } catch (err) {
            console.error("Analysis failed:", err);
            toast.error("Failed to analyze submission. Check that CIPAS services are running.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [submission, submissionId, assignmentId]);

    return (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto py-6 px-4">
            {/* ── Back link ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={backHref}>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to assignment
                    </Link>
                </Button>
            </div>

            {/* ── Page title ──────────────────────────────────────────────── */}
            <div>
                <h1 className="text-xl font-bold font-heading">Submission Review</h1>
                {submission && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Submitted by <span className="font-medium text-foreground">{studentDisplayName}</span>
                        {studentSecondaryLabel && (
                            <span className="font-mono text-xs"> ({studentSecondaryLabel})</span>
                        )}
                        {" · "}
                        {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                )}
            </div>

            {/* ── Keystroke session summary (if archive found) ─────────────── */}
            {archive && (
                <div className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Risk badge + anomaly count */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                            variant={riskBadgeVariant(archive.average_risk_score)}
                            className={cn(
                                "text-xs font-semibold",
                                archive.average_risk_score < 0.3 &&
                                    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                            )}
                        >
                            {riskLabel(archive.average_risk_score)}{" "}
                            ({(archive.average_risk_score * 100).toFixed(0)}%)
                        </Badge>
                        {archive.anomaly_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {archive.anomaly_count} anomal{archive.anomaly_count === 1 ? "y" : "ies"} detected
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {archive.event_count.toLocaleString()} keystrokes recorded
                        </span>
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex gap-2 sm:ml-auto">
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}/playback`}
                            >
                                <Video className="h-3.5 w-3.5 mr-1.5" />
                                Session Playback
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}/analytics`}
                            >
                                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                                Behavior Analytics
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Grade result ────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border overflow-hidden bg-card">
                <div className="px-4 pt-4 pb-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        AI Grading Result
                    </p>
                </div>
                {loadingGrade ? (
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Waiting for grading to complete…
                        </div>
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-16 rounded-lg" />
                        <Skeleton className="h-16 rounded-lg" />
                    </div>
                ) : gradeError ? (
                    <div className="p-4 text-sm text-destructive">{gradeError}</div>
                ) : (
                    <GradeResultPanel
                        grade={grade}
                        instructorView
                        compact={false}
                    />
                )}
            </div>

            {/* ── Instructor override panel ───────────────────────────────── */}
            {grade && (
                <InstructorGradeOverridePanel
                    grade={grade}
                    submissionId={submissionId}
                    instructorName={user?.full_name ?? user?.email ?? "Instructor"}
                    onSaved={(updated) => setGrade(updated)}
                />
            )}

            {/* ── CIPAS Analysis ──────────────────────────────────────────── */}
            {submission && (
                <Card className="border-border/60">
                    <CardContent className="p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    CIPAS Analysis
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                disabled={isAnalyzing}
                                onClick={handleAnalyze}
                            >
                                {isAnalyzing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : submission.ai_likelihood !== undefined ? (
                                    <RefreshCw className="h-3 w-3" />
                                ) : (
                                    <Sparkles className="h-3 w-3" />
                                )}
                                {isAnalyzing ? "Analyzing…" : submission.ai_likelihood !== undefined ? "Re-analyze" : "Analyze"}
                            </Button>
                        </div>

                        {isAnalyzing && submission.ai_likelihood === undefined ? (
                            <div className="flex flex-col items-center gap-3 py-6">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Running AI detection &amp; similarity analysis…</p>
                            </div>
                        ) : submission.ai_likelihood !== undefined ? (
                            <>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-2">AI Generation Likelihood</p>
                                    <AILikelihoodBadge
                                        aiLikelihood={submission.ai_likelihood}
                                        humanLikelihood={submission.human_likelihood ?? (1 - submission.ai_likelihood)}
                                        showLabel
                                        size="md"
                                    />
                                </div>

                                {submission.semantic_similarity_score !== undefined && submission.semantic_similarity_score !== null && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Similarity to sample answer</p>
                                            <SemanticSimilarityBadge
                                                score={submission.semantic_similarity_score}
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <BrainCircuit className="h-6 w-6 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No analysis data yet</p>
                                <p className="text-xs text-muted-foreground">
                                    Click &ldquo;Analyze&rdquo; to run AI detection and semantic similarity checks.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
