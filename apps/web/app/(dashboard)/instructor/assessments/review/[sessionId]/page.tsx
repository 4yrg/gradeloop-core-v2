"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { format, differenceInMinutes } from "date-fns";
import {
    Mic2,
    CheckCircle2,
    Clock,
    XCircle,
    ArrowLeft,
    User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ivasApi } from "@/lib/ivas-api";
import type { VivaSession, IvasAssignment } from "@/types/ivas";

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

export default function InstructorReviewPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const sessionId = params.sessionId;

    const [session, setSession] = React.useState<VivaSession | null>(null);
    const [assignment, setAssignment] = React.useState<IvasAssignment | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const sess = await ivasApi.getSession(sessionId);
                if (!mounted) return;
                setSession(sess);
                try {
                    const detail = await ivasApi.getAssignment(sess.assignment_id);
                    if (mounted) setAssignment(detail);
                } catch {}
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
            </div>
        );
    }

    if (error || !session) {
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

    const duration = session.completed_at
        ? differenceInMinutes(new Date(session.completed_at), new Date(session.started_at))
        : null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
            <Button variant="ghost" size="sm" onClick={() => router.push("/instructor/assessments/dashboard")} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
            </Button>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Mic2 className="h-6 w-6" />
                        Session Review
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {assignment?.title ?? session.assignment_id}
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
            {assignment?.code_context && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Student&apos;s Code</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-60">
                            {assignment.code_context}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Note */}
            <Card className="bg-muted/50 border-dashed">
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                        Full transcript review, per-question scoring, voice authentication flags, and competency
                        breakdown will be available once white-box grading and transcript storage are implemented.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
