"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import { keystrokeApi } from "@/lib/api/keystroke";
import type { PlaybackData, ArchiveLookupResult } from "@/lib/api/keystroke";
import type { SubmissionResponse } from "@/types/assessments.types";
import { SessionPlaybackPlayer } from "@/components/instructor/session-playback/SessionPlaybackPlayer";

interface PageProps {
    params: Promise<{ assignmentId: string; submissionId: string }>;
}

// Detect programming language from the assignment's language field or a fallback
function detectLanguage(submission: SubmissionResponse | null): string {
    if (!submission) return "python";
    const lang = (submission.language ?? "").toLowerCase();
    if (lang.includes("python")) return "python";
    if (lang.includes("java") && !lang.includes("javascript")) return "java";
    if (lang.includes("javascript") || lang.includes("js")) return "javascript";
    if (lang.includes("typescript") || lang.includes("ts")) return "typescript";
    if (lang.includes("c++") || lang.includes("cpp")) return "cpp";
    if (lang.includes("c#") || lang.includes("csharp")) return "csharp";
    if (lang.includes("go")) return "go";
    if (lang.includes("rust")) return "rust";
    return "python";
}

export default function SessionPlaybackPage({ params }: PageProps) {
    const { assignmentId, submissionId } = use(params);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
    const [archive, setArchive] = useState<ArchiveLookupResult | null>(null);
    const [playbackData, setPlaybackData] = useState<PlaybackData | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                // Step 1: Resolve submission → user_id
                const submissions = await instructorAssessmentsApi.listSubmissions(assignmentId);
                const found = submissions.find((s: SubmissionResponse) => s.id === submissionId) ?? null;
                if (!found) throw new Error("Submission not found.");
                if (!cancelled) setSubmission(found);

                const userId = found.user_id;
                if (!userId) throw new Error("Submission has no associated user.");

                // Step 2: Look up session archive
                const arc = await keystrokeApi.lookupArchive(assignmentId, userId);
                if (!cancelled) setArchive(arc);

                // Step 3: Load full playback data
                const pb = await keystrokeApi.getPlaybackData(arc.session_id);
                if (!cancelled) setPlaybackData(pb);
            } catch (err) {
                if (!cancelled) {
                    const msg =
                        err instanceof Error ? err.message : "Failed to load session data.";
                    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
                        setError("no_archive");
                    } else {
                        setError(msg);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [assignmentId, submissionId]);

    return (
        <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-background">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}`}>
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to review
                    </Link>
                </Button>
                <div className="h-4 w-px bg-border" />
                <div>
                    <h1 className="text-sm font-semibold">Session Playback</h1>
                    {submission && (
                        <p className="text-xs text-muted-foreground">
                            {submission.user_id} · {archive ? `${archive.event_count.toLocaleString()} events recorded` : ""}
                        </p>
                    )}
                </div>
                {archive && (
                    <Button variant="outline" size="sm" className="ml-auto" asChild>
                        <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}/analytics`}>
                            View analytics
                        </Link>
                    </Button>
                )}
            </div>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 p-4">
                {loading && (
                    <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading session recording…</span>
                    </div>
                )}

                {!loading && error === "no_archive" && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <VideoOff className="h-10 w-10 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">No session recording found</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                The student's keystroke session was not archived for this
                                submission. This happens when the assignment was completed before
                                keystroke monitoring was enabled, or the session was never
                                finalized.
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
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <p className="text-sm text-destructive font-medium">{error}</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/instructor/assessments/${assignmentId}/submissions/${submissionId}`}>
                                Return to submission
                            </Link>
                        </Button>
                    </div>
                )}

                {!loading && !error && playbackData && (
                    <div className="h-full">
                        <SessionPlaybackPlayer
                            data={playbackData}
                            language={detectLanguage(submission)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
