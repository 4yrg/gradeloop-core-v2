"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import { keystrokeApi } from "@/lib/api/keystroke";
import type { AnalyticsData } from "@/lib/api/keystroke";
import type { SubmissionResponse } from "@/types/assessments.types";
import { BehaviorAnalyticsPanel } from "@/components/instructor/behavior-analytics/BehaviorAnalyticsPanel";

interface PageProps {
    params: Promise<{ assignmentId: string; submissionId: string }>;
}

export default function BehaviorAnalyticsPage({ params }: PageProps) {
    const { assignmentId, submissionId } = use(params);

    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

    const loadAnalytics = useCallback(
        async (sid: string, showComputing = false, force = false) => {
            try {
                if (showComputing) setComputing(true);
                const data = await keystrokeApi.getAnalytics(sid, force);
                setAnalyticsData(data);

                // If analysis still not available, poll once more after 5s
                if (!data.analysis_available) {
                    setTimeout(() => loadAnalytics(sid, true), 5000);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load analytics.");
            } finally {
                if (showComputing) setComputing(false);
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                // 1. Resolve user_id from submission
                const submissions = await instructorAssessmentsApi.listSubmissions(assignmentId);
                const found = submissions.find((s: SubmissionResponse) => s.id === submissionId) ?? null;
                if (!found) throw new Error("Submission not found.");
                if (!cancelled) setSubmission(found);

                const userId = found.user_id;
                if (!userId) throw new Error("Submission has no associated user.");

                // 2. Look up session archive
                const arc = await keystrokeApi.lookupArchive(assignmentId, userId);
                if (!cancelled) setSessionId(arc.session_id);

                // 3. Load (or trigger) analytics
                const data = await keystrokeApi.getAnalytics(arc.session_id);
                if (!cancelled) {
                    setAnalyticsData(data);
                    // If not yet available (computation in progress), start polling
                    if (!data.analysis_available) {
                        setTimeout(() => loadAnalytics(arc.session_id, true), 5000);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    const msg = err instanceof Error ? err.message : "Unexpected error.";
                    setError(msg.includes("404") || msg.toLowerCase().includes("not found")
                        ? "no_archive"
                        : msg);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [assignmentId, submissionId, loadAnalytics]);

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto py-6 px-4">
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}`}>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to review
                    </Link>
                </Button>
                {sessionId && (
                    <Button variant="outline" size="sm" className="ml-auto" asChild>
                        <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}/playback`}>
                            Session Playback
                        </Link>
                    </Button>
                )}
            </div>

            <div>
                <h1 className="text-xl font-bold font-heading flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Behavior Analytics
                </h1>
                {submission && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {submission.user_id} · submitted{" "}
                        {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                )}
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            {loading && (
                <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading analytics…</span>
                </div>
            )}

            {!loading && error === "no_archive" && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <BarChart3 className="h-10 w-10 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">No session data found</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Keystroke data was not archived for this submission.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}`}>
                            Return to submission
                        </Link>
                    </Button>
                </div>
            )}

            {!loading && error && error !== "no_archive" && (
                <p className="text-sm text-destructive py-8 text-center">{error}</p>
            )}

            {!loading && !error && analyticsData && (
                <>
                    {/* Computing indicator during polling */}
                    {!analyticsData.analysis_available && (
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                            <RefreshCw className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} />
                            Analysis is being computed — refreshing automatically…
                        </div>
                    )}
                    <BehaviorAnalyticsPanel
                        data={analyticsData}
                        onRetryAi={sessionId ? () => loadAnalytics(sessionId, true, true) : undefined}
                    />
                </>
            )}
        </div>
    );
}
