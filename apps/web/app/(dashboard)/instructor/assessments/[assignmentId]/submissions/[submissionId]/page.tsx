"use client";

import { useState, useEffect, use } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { acafsApi, instructorAssessmentsApi } from "@/lib/api/assessments";
import { keystrokeApi } from "@/lib/api/keystroke";
import type { SubmissionGrade, SubmissionResponse } from "@/types/assessments.types";
import type { ArchiveLookupResult } from "@/lib/api/keystroke";
import { GradeResultPanel } from "@/components/assessments/grade-result-panel";
import { InstructorGradeOverridePanel } from "@/components/instructor/instructor-grade-override-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, RefreshCw, Video } from "lucide-react";
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

    const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
    const [grade, setGrade] = useState<SubmissionGrade | null>(null);
    const [loadingGrade, setLoadingGrade] = useState(true);
    const [pollCount, setPollCount] = useState(0);
    const [gradeError, setGradeError] = useState<string | null>(null);

    // Keystroke session archive (if available)
    const [archive, setArchive] = useState<ArchiveLookupResult | null>(null);

    // Fetch submission metadata
    useEffect(() => {
        instructorAssessmentsApi
            .listSubmissions(assignmentId)
            .then((resp: SubmissionResponse[]) => {
                const found = resp.find((s: SubmissionResponse) => s.id === submissionId);
                if (found) {
                    setSubmission(found);
                    // Try to look up keystroke archive for this submission
                    if (found.user_id) {
                        keystrokeApi
                            .lookupArchive(assignmentId, found.user_id)
                            .then(setArchive)
                            .catch(() => {/* No archive — silently ignore */});
                    }
                }
            })
            .catch(() => {/* non-critical */});
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

    return (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto py-6 px-4">
            {/* ── Back link ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/instructor/assessments`}>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to assignments
                    </Link>
                </Button>
            </div>

            {/* ── Page title ──────────────────────────────────────────────── */}
            <div>
                <h1 className="text-xl font-bold font-heading">Submission Review</h1>
                {submission && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Submitted by <span className="font-medium">{submission.user_id}</span>
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
        </div>
    );
}

