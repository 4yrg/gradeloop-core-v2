"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, differenceInMinutes } from "date-fns";
import {
    Mic2,
    CheckCircle2,
    Clock,
    XCircle,
    ArrowLeft,
    User,
    MessageSquare,
    Star,
    BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ivasApi } from "@/lib/ivas-api";
import type { SessionDetail, GradedQA, Transcript } from "@/types/ivas";

function StatusBadge({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
            </Badge>
        );
    }
    if (status === "abandoned") {
        return (
            <Badge variant="outline" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0">
                <XCircle className="h-3 w-3 mr-1" />
                Abandoned
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
            <Clock className="h-3 w-3 mr-1" />
            {status}
        </Badge>
    );
}

export default function InstructorVivaReviewPage() {
    const params = useParams<{ sessionId: string; assignmentId: string; instanceId: string }>();
    const router = useRouter();
    const sessionId = params.sessionId;
    const assignmentId = params.assignmentId;
    const instanceId = params.instanceId;

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
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load session");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [sessionId]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-600">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error || "Session not found."}</p>
                        <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { session, transcripts, graded_qa } = details;
    const duration = session.completed_at
        ? differenceInMinutes(new Date(session.completed_at), new Date(session.started_at))
        : null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
            <Button variant="ghost" size="sm" asChild className="gap-1 self-start">
                <Link href={`/instructor/courses/${instanceId}/assignments/${assignmentId}/viva`}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Viva Sessions
                </Link>
            </Button>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Mic2 className="h-6 w-6" />
                        Session Review
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {session.assignment_context?.title ?? session.assignment_id}
                    </p>
                </div>
                <StatusBadge status={session.status} />
            </div>

            {/* Meta cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Student</p>
                        <p className="text-sm font-bold font-mono flex items-center justify-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {session.student_id}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Score</p>
                        <p className="text-lg font-bold">
                            {session.total_score !== null ? `${session.total_score}/${session.max_possible}` : "—"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Duration</p>
                        <p className="text-lg font-bold">{duration !== null ? `${duration} min` : "—"}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Date</p>
                        <p className="text-lg font-bold">{format(new Date(session.started_at), "MMM d, yyyy")}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Assignment context */}
            {session.assignment_context?.code_context && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Student&apos;s Code
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-60">
                            {session.assignment_context.code_context}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Full transcript */}
            {transcripts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Full Transcript
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {transcripts.map((turn: Transcript) => (
                            <div key={turn.id} className="flex gap-3">
                                <div className={`shrink-0 w-16 text-xs font-medium mt-0.5 ${turn.role === "examiner" ? "text-blue-600" : "text-emerald-600"}`}>
                                    {turn.role === "examiner" ? "Examiner" : "Student"}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm leading-relaxed">{turn.content}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {format(new Date(turn.timestamp), "HH:mm:ss")}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Graded Q&A with scores */}
            {graded_qa.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Per-Question Scoring
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {graded_qa.map((item: GradedQA) => (
                            <div key={item.sequence_num} className="border border-border/60 rounded-lg p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-2">
                                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full px-2 py-0.5 font-medium">
                                            Q{item.sequence_num}
                                        </span>
                                        <p className="text-sm font-medium">{item.question_text}</p>
                                    </div>
                                    {item.score !== null && (
                                        <div className="text-right shrink-0">
                                            <span className="text-lg font-bold">{item.score}</span>
                                            <span className="text-sm text-muted-foreground">/{item.max_score ?? 10}</span>
                                        </div>
                                    )}
                                </div>
                                {item.response_text && (
                                    <div className="ml-0">
                                        <p className="text-xs text-muted-foreground mb-1">Student&apos;s answer:</p>
                                        <p className="text-sm bg-muted/60 rounded-lg px-3 py-2">{item.response_text}</p>
                                    </div>
                                )}
                                {item.score_justification && (
                                    <div className="border-l-2 border-amber-400 pl-3">
                                        <p className="text-xs text-muted-foreground mb-0.5">Justification:</p>
                                        <p className="text-sm italic text-amber-700 dark:text-amber-400">{item.score_justification}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {session.status !== "completed" && (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                            This session is still in progress. Full transcript and scoring will appear once the session is completed.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
