"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ivasApi } from "@/lib/ivas-api";
import type { SessionDetail } from "@/types/ivas";

export default function StudentResultsPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;
    const [details, setDetails] = React.useState<SessionDetail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const d = await ivasApi.getSessionDetails(sessionId);
                if (mounted) setDetails(d);
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load results");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [sessionId]);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto space-y-6 p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error || "Session not found"}</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.push("/student/assessments/my-sessions")}>
                            Back to My Sessions
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { session, graded_qa: gradedQA = [], transcripts = [] } = details;
    const isCompleted = session.status === "completed";

    return (
        <div className="max-w-3xl mx-auto space-y-6 p-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.push("/student/assessments/my-sessions")}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    My Sessions
                </Button>
            </div>

            {/* Score Hero */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Session Results</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    {isCompleted && session.total_score !== null ? (
                        <div className="text-center">
                            <p className="text-4xl font-black">
                                {session.total_score} <span className="text-lg font-normal text-muted-foreground">/ {session.max_possible}</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Total Score</p>
                        </div>
                    ) : session.status === "grading_failed" ? (
                        <div className="text-center">
                            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
                            <p className="text-sm text-red-600 dark:text-red-400">Grading Failed</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Clock className="h-10 w-10 text-violet-500 mx-auto mb-2 animate-pulse" />
                            <p className="text-sm text-muted-foreground">Results are being processed…</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Graded Q&A */}
            {gradedQA.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Question Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {gradedQA.map((qa, i) => (
                            <div key={i} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium">{qa.question_text || `Question ${qa.sequence_num || i + 1}`}</p>
                                    {qa.score !== null && qa.max_score !== null && (
                                        <span className="text-sm font-semibold shrink-0">
                                            {qa.score}/{qa.max_score}
                                        </span>
                                    )}
                                </div>
                                {qa.response_text && (
                                    <p className="text-xs text-muted-foreground">{qa.response_text}</p>
                                )}
                                {qa.score_justification && (
                                    <p className="text-xs text-muted-foreground italic">{qa.score_justification}</p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Transcript */}
            {transcripts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Transcript</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                        {transcripts.map((t, i) => (
                            <div key={i} className={`text-sm ${t.role === "examiner" ? "text-blue-700 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                                <span className="font-semibold">{t.role === "examiner" ? "Examiner" : "You"}:</span> {t.content}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}