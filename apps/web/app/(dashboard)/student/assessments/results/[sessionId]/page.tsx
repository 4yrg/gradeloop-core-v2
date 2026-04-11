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
    MessageSquare,
    Star,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Sliders,
    BookOpen,
    Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ivasApi } from "@/lib/ivas-api";
import type { SessionDetail, GradedQA, Transcript, CompetencyScoreOut } from "@/types/ivas";

const TRANSCRIPT_COLLAPSE_THRESHOLD = 8;

function StatusBadge({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
            </Badge>
        );
    }
    if (status === "grading") {
        return (
            <Badge variant="outline" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Grading
            </Badge>
        );
    }
    if (status === "grading_failed") {
        return (
            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                <XCircle className="h-3 w-3 mr-1" />
                Grading Failed
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

function ScoreBadge({ score, max }: { score: number; max: number }) {
    const pct = max > 0 ? (score / max) * 100 : 0;
    const color =
        pct >= 80 ? "text-emerald-600" :
        pct >= 60 ? "text-amber-600" :
        "text-red-600";
    return (
        <span className={`text-lg font-bold ${color}`}>
            {score}
            <span className="text-sm font-normal text-muted-foreground">/{max}</span>
        </span>
    );
}

function TranscriptSection({ transcripts }: { transcripts: Transcript[] }) {
    const [expanded, setExpanded] = React.useState(false);
    const visible = expanded ? transcripts : transcripts.slice(0, TRANSCRIPT_COLLAPSE_THRESHOLD);
    const hasMore = transcripts.length > TRANSCRIPT_COLLAPSE_THRESHOLD;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Transcript
                        <span className="text-xs font-normal text-muted-foreground">
                            ({transcripts.length} turns)
                        </span>
                    </CardTitle>
                    {hasMore && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="gap-1 text-xs h-7"
                        >
                            {expanded ? (
                                <><ChevronUp className="h-3 w-3" />Show less</>
                            ) : (
                                <><ChevronDown className="h-3 w-3" />Show all</>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {visible.map((turn: Transcript) => (
                    <div key={turn.id} className="flex gap-3">
                        <div className={`shrink-0 w-16 text-xs font-medium mt-0.5 ${turn.role === "examiner" ? "text-blue-600" : "text-emerald-600"}`}>
                            {turn.role === "examiner" ? "Examiner" : "You"}
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
    );
}

function CompetencyBreakdownStudent({ sessionId, studentId }: { sessionId: string; studentId: string }) {
    const [scores, setScores] = React.useState<CompetencyScoreOut[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let mounted = true;
        ivasApi.listStudentCompetencyScores(studentId).then(data => {
            if (mounted) setScores(data.filter(s => s.session_id === sessionId));
        }).catch(() => {}).finally(() => {
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, [studentId, sessionId]);

    if (loading) {
        return <Skeleton className="h-32 w-full" />;
    }
    if (scores.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Your Competency Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {scores.map((s, idx) => {
                    const pct = s.score !== null && s.max_score !== null && s.max_score > 0
                        ? (s.score / s.max_score) * 100 : 0;
                    const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
                    const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
                    return (
                        <div key={`${s.competency_id}-${idx}`} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium mb-1.5">{s.competency_name ?? "—"}</p>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                            <span className={`font-bold text-sm shrink-0 ${color}`}>
                                {s.score !== null ? Math.round(s.score) : "—"}
                                <span className="text-xs font-normal text-muted-foreground">/{s.max_score ?? 10}</span>
                            </span>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function QuestionCard({ item }: { item: GradedQA }) {
    const max = item.max_score ?? 10;
    const pct = item.score !== null && max > 0 ? (item.score / max) * 100 : 0;

    const scoreColor =
        pct >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
        pct >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";

    return (
        <div className="border border-border/60 rounded-xl p-5 space-y-4">
            {/* Question + Score */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full px-2.5 py-1 font-semibold shrink-0 mt-0.5">
                        Q{item.sequence_num}
                    </span>
                    <p className="text-sm font-medium leading-snug">{item.question_text}</p>
                </div>
                {item.score !== null && (
                    <div className={`rounded-full px-3 py-1.5 text-sm font-bold shrink-0 ${scoreColor}`}>
                        {item.score}/{max}
                    </div>
                )}
            </div>

            {/* Answer */}
            {item.response_text && (
                <div className="ml-0">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Your answer</p>
                    <p className="text-sm bg-muted/70 rounded-lg px-4 py-3 leading-relaxed">
                        {item.response_text}
                    </p>
                </div>
            )}

            {/* Justification */}
            {item.score_justification && (
                <div className="border-l-2 border-amber-400 pl-3.5">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Why you got this mark</p>
                    <p className="text-sm italic text-amber-700 dark:text-amber-400 leading-relaxed">
                        {item.score_justification}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function ResultsPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const sessionId = params.sessionId;

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

    // Poll for grading completion
    React.useEffect(() => {
        if (!details) return;
        if (details.session.status !== "grading") return;

        const pollInterval = setInterval(async () => {
            try {
                const d = await ivasApi.getSessionDetails(sessionId);
                setDetails(d);
                if (d.session.status !== "grading") {
                    clearInterval(pollInterval);
                }
            } catch { /* retry on next interval */ }
        }, 3000);
        return () => clearInterval(pollInterval);
    }, [details, sessionId]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-80 w-full" />
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
                        <p className="text-sm text-muted-foreground">{error || "Session not found."}</p>
                        <Button className="mt-4" onClick={() => router.push("/student/assessments/my-sessions")}>
                            Back to Sessions
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { session, transcripts, graded_qa } = details;
    const duration = session.completed_at
        ? differenceInMinutes(new Date(session.completed_at), new Date(session.started_at))
        : null;

    const scorePct = session.total_score !== null && session.max_possible !== null && session.max_possible > 0
        ? Math.round((session.total_score / session.max_possible) * 100)
        : null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Back */}
            <Button variant="ghost" size="sm" onClick={() => router.push("/student/assessments/my-sessions")} className="gap-1.5 px-0 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to Sessions
            </Button>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Mic2 className="h-6 w-6" />
                        Viva Results
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {String(session.assignment_context?.title ?? session.assignment_id)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(session.started_at), "EEEE, MMMM d, yyyy 'at' HH:mm")}
                    </p>
                </div>
                <StatusBadge status={session.status} />
            </div>

            {/* Score Hero */}
            {session.total_score !== null && session.max_possible !== null && session.status === "completed" && (
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Overall Score</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black tracking-tight">
                                        {session.total_score}
                                    </span>
                                    <span className="text-xl font-medium text-muted-foreground">/ {session.max_possible}</span>
                                </div>
                                {scorePct !== null && (
                                    <p className={`text-sm font-semibold mt-1 ${
                                        scorePct >= 80 ? "text-emerald-600" :
                                        scorePct >= 60 ? "text-amber-600" :
                                        "text-red-600"
                                    }`}>
                                        {scorePct}% — {
                                            scorePct >= 80 ? "Excellent" :
                                            scorePct >= 60 ? "Good" :
                                            "Needs Improvement"
                                        }
                                    </p>
                                )}
                            </div>
                            {scorePct !== null && (
                                <div className="w-24 shrink-0">
                                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                scorePct >= 80 ? "bg-emerald-500" :
                                                scorePct >= 60 ? "bg-amber-500" :
                                                "bg-red-500"
                                            }`}
                                            style={{ width: `${scorePct}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* In-progress / grading / non-completed banner */}
            {session.status !== "completed" && (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-6 flex items-center gap-3">
                        {session.status === "grading" ? (
                            <Loader2 className="h-5 w-5 text-violet-500 shrink-0 animate-spin" />
                        ) : session.status === "grading_failed" ? (
                            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        ) : session.status === "abandoned" ? (
                            <XCircle className="h-5 w-5 text-zinc-500 shrink-0" />
                        ) : (
                            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div>
                            <p className="text-sm font-medium">
                                {session.status === "grading"
                                    ? "Grading in progress"
                                    : session.status === "grading_failed"
                                        ? "Grading failed"
                                        : session.status === "abandoned"
                                            ? "Session ended without completion"
                                            : "Session not yet complete"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {session.status === "grading"
                                    ? "Your answers are being evaluated. Results will appear here once grading is done."
                                    : session.status === "grading_failed"
                                        ? "An error occurred while grading your viva. Please contact your instructor."
                                        : session.status === "abandoned"
                                            ? "This viva session ended without completing the assessment."
                                            : "Transcript and scoring will appear once the session ends."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Competency Breakdown (User Story 8) */}
            {session.status === "completed" && (
                <CompetencyBreakdownStudent sessionId={sessionId} studentId={session.student_id} />
            )}

            {/* Meta row — only duration + date when completed */}
            {session.status === "completed" && (
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {duration !== null && (
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{duration} min</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        <span>{graded_qa.length} questions · {transcripts.length} turns</span>
                    </div>
                </div>
            )}

            {/* Transcript */}
            {transcripts.length > 0 && (
                <TranscriptSection transcripts={transcripts} />
            )}

            {/* Per-Question Scoring */}
            {graded_qa.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Per-Question Scoring
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {graded_qa.map((item: GradedQA) => (
                            <QuestionCard key={item.sequence_num} item={item} />
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
