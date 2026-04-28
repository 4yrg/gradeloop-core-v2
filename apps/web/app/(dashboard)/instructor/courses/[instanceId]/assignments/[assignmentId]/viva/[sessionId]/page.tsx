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
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Eye,
    Sliders,
    Edit2,
    Check,
    X,
    Loader2,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toaster";
import { ivasApi } from "@/lib/ivas-api";
import type { SessionDetail, GradedQA, Transcript, CompetencyScoreOut, VoiceAuthEvent } from "@/types/ivas";

const TRANSCRIPT_COLLAPSE_THRESHOLD = 30;

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

function TranscriptSection({ transcripts, defaultExpanded = false }: { transcripts: Transcript[]; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = React.useState(defaultExpanded);
    const visible = expanded ? transcripts : transcripts.slice(0, TRANSCRIPT_COLLAPSE_THRESHOLD);
    const hasMore = transcripts.length > TRANSCRIPT_COLLAPSE_THRESHOLD;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Full Transcript
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
    );
}

function CodeBlock({ code }: { code: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const COLLAPSE_HEIGHT = 160;
    const isLong = code.split("\n").length > 12;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Student&apos;s Code
                    </CardTitle>
                    {isLong && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="gap-1 text-xs h-7"
                        >
                            {expanded ? (
                                <><ChevronUp className="h-3 w-3" />Collapse</>
                            ) : (
                                <><ChevronDown className="h-3 w-3" />Expand</>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div style={!expanded && isLong ? { maxHeight: `${COLLAPSE_HEIGHT}px`, overflow: "hidden" } : undefined}>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto leading-relaxed">
                        {code}
                    </pre>
                </div>
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
                <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Student&apos;s answer</p>
                    <p className="text-sm bg-muted/70 rounded-lg px-4 py-3 leading-relaxed">
                        {item.response_text}
                    </p>
                </div>
            )}

            {/* Justification */}
            {item.score_justification && (
                <div className="border-l-2 border-amber-400 pl-3.5">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Grading rationale</p>
                    <p className="text-sm italic text-amber-700 dark:text-amber-400 leading-relaxed">
                        {item.score_justification}
                    </p>
                </div>
            )}
        </div>
    );
}

function DifficultyBadge({ difficulty }: { difficulty: number }) {
    if (difficulty >= 3) {
        return <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">Advanced</Badge>;
    }
    if (difficulty >= 2) {
        return <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">Intermediate</Badge>;
    }
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">Beginner</Badge>;
}

function VoiceVerificationSection({ events }: { events: VoiceAuthEvent[] }) {
    if (events.length === 0) return null;
    const avgSimilarity = events.reduce((sum, e) => sum + (e.similarity_score ?? 0), 0) / events.length;
    const matchCount = events.filter(e => e.is_match).length;
    const mismatchCount = events.length - matchCount;
    const allPassed = mismatchCount === 0;
    const pctMatch = Math.round((matchCount / events.length) * 100);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Voice Verification
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary badge */}
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    allPassed
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                }`}>
                    <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${
                        allPassed
                            ? "bg-emerald-100 dark:bg-emerald-900/40"
                            : "bg-red-100 dark:bg-red-900/40"
                    }`}>
                        <ShieldCheck className={`h-5 w-5 ${
                            allPassed ? "text-emerald-600" : "text-red-600"
                        }`} />
                    </div>
                    <div>
                        <p className={`text-sm font-semibold ${
                            allPassed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                        }`}>
                            {allPassed
                                ? `Voice Verified — ${matchCount}/${events.length} checks passed`
                                : `Voice Verification Concerns — ${mismatchCount} flagged out of ${events.length} checks`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Average similarity: {(avgSimilarity * 100).toFixed(1)}% · Match rate: {pctMatch}%
                        </p>
                    </div>
                </div>

                {/* Per-check details */}
                <div className="space-y-0">
                    {events.map((event, i) => {
                        const sim = event.similarity_score;
                        const confColor =
                            event.confidence === "high"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : event.confidence === "medium"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-600 dark:text-red-400";
                        const badgeColor =
                            event.is_match
                                ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                                : "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400";
                        const confBg =
                            event.confidence === "high"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : event.confidence === "medium"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                        return (
                            <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                                <span className="text-xs text-muted-foreground">Check {i + 1}</span>
                                <span className={`text-sm font-semibold ${confColor}`}>
                                    {sim !== null ? (sim * 100).toFixed(1) + "%" : "—"}
                                </span>
                                <Badge variant="outline" className={badgeColor}>
                                    {event.is_match ? "Match" : "Mismatch"}
                                </Badge>
                                {event.confidence && (
                                    <Badge variant="outline" className={confBg}>
                                        {event.confidence}
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {format(new Date(event.checked_at), "HH:mm:ss")}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function CompetencyScoresSection({ studentId, assignmentId, sessionId }: { studentId: string; assignmentId: string; sessionId: string }) {
    const { addToast } = useToast();
    const [scores, setScores] = React.useState<CompetencyScoreOut[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editValue, setEditValue] = React.useState<number | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [showAll, setShowAll] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        ivasApi.listStudentCompetencyScores(studentId).then(data => {
            if (mounted) setScores(data.filter(s => s.session_id === sessionId));
        }).catch(() => {}).finally(() => {
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, [studentId, sessionId]);

    async function handleOverride(competencyId: string) {
        if (editValue === null) return;
        try {
            setSaving(true);
            const updated = await ivasApi.overrideCompetencyScore({
                student_id: studentId,
                competency_id: competencyId,
                new_score: editValue,
                override_by: "instructor",
            });
            setScores(prev => prev.map(s =>
                s.competency_id === competencyId ? { ...s, score: updated.score, is_override: true } : s
            ));
            setEditingId(null);
            setEditValue(null);
        } catch (err) {
            addToast({
                title: "Override failed",
                variant: "error",
                description: err instanceof Error ? err.message : "Could not save score override.",
            });
        } finally {
            setSaving(false);
        }
    }

    const displayed = showAll ? scores : scores.slice(0, 5);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Competency Scores
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {loading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
                ) : scores.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No competency scores yet.</p>
                ) : (
                    <>
                        {displayed.map(s => {
                            const pct = s.score !== null && s.max_score !== null && s.max_score > 0
                                ? (s.score / s.max_score) * 100 : 0;
                            const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
                            const isEditing = editingId === s.competency_id;
                            return (
                                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium">{s.competency_name ?? "—"}</p>
                                            {s.is_override && (
                                                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Override</Badge>
                                            )}
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isEditing ? (
                                            <>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={s.max_score ?? 10}
                                                    value={editValue ?? s.score ?? 0}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val >= 0 && val <= (s.max_score ?? 10)) {
                                                            setEditValue(val);
                                                        }
                                                    }}
                                                    className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-center"
                                                    autoFocus
                                                />
                                                <span className="text-xs text-muted-foreground">/ {s.max_score ?? 10}</span>
                                                <Button size="sm" variant="ghost" onClick={() => handleOverride(s.competency_id)} disabled={saving || editValue === null} className="gap-1">
                                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="gap-1">
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`font-bold text-sm ${color}`}>
                                                    {s.score !== null ? Math.round(s.score) : "—"}
                                                    <span className="text-xs font-normal text-muted-foreground">/{s.max_score ?? 10}</span>
                                                </span>
                                                <Button size="sm" variant="ghost" onClick={() => {
                                                    setEditingId(s.competency_id);
                                                    setEditValue(s.score ?? 0);
                                                }} className="gap-1">
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {scores.length > 5 && (
                            <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)} className="gap-1 w-full mt-2">
                                {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {showAll ? "Show less" : `Show all ${scores.length} competencies`}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function StudentIdCell({ studentId }: { studentId: string }) {
    if (studentId.length <= 12) {
        return <span className="text-sm font-medium font-mono">{studentId}</span>;
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="text-sm font-medium font-mono cursor-help">
                    {studentId.slice(0, 8)}…{studentId.slice(-4)}
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <p className="font-mono text-xs">{studentId}</p>
            </TooltipContent>
        </Tooltip>
    );
}

export default function InstructorVivaReviewPage() {
    const { addToast } = useToast();
    const params = useParams<{ sessionId: string; assignmentId: string; instanceId: string }>();
    const router = useRouter();
    const sessionId = params.sessionId;
    const assignmentId = params.assignmentId;
    const instanceId = params.instanceId;

    const [details, setDetails] = React.useState<SessionDetail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [regrading, setRegrading] = React.useState(false);

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

    async function handleRegrade() {
        if (!details || regrading) return;
        setRegrading(true);
        try {
            const updated = await ivasApi.regradeSession(sessionId);
            setDetails(prev => prev ? { ...prev, session: { ...prev.session, status: updated.status } } : prev);
            // Re-fetch full details after a short delay to let grading finish or show progress
            const refreshed = await ivasApi.getSessionDetails(sessionId);
            setDetails(refreshed);
        } catch (err) {
            // If regrade fails, just refresh to show current state
            const refreshed = await ivasApi.getSessionDetails(sessionId);
            setDetails(refreshed);
        } finally {
            setRegrading(false);
        }
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
                <Skeleton className="h-8 w-64" />
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

    const scorePct = session.total_score !== null && session.max_possible !== null && session.max_possible > 0
        ? Math.round((session.total_score / session.max_possible) * 100)
        : null;

    return (
        <TooltipProvider>
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Back */}
            <Button variant="ghost" size="sm" asChild className="gap-1.5 px-0 text-muted-foreground hover:text-foreground self-start">
                <Link href={`/instructor/courses/${instanceId}/assignments/${assignmentId}/viva`}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Viva Sessions
                </Link>
            </Button>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Mic2 className="h-6 w-6" />
                        Session Review
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {(session.assignment_context?.title as string | undefined) ?? session.assignment_id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(session.started_at), "EEEE, MMMM d, yyyy 'at' HH:mm")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={session.status} />
                    {(session.status === "completed" || session.status === "grading_failed" || session.status === "abandoned") && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegrade}
                            disabled={regrading}
                            className="gap-1.5"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${regrading ? "animate-spin" : ""}`} />
                            {regrading ? "Regrading…" : "Regrade"}
                        </Button>
                    )}
                </div>
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
                                    ? "Answers are being evaluated. Results will appear here once grading is done."
                                    : session.status === "grading_failed"
                                        ? "An error occurred during grading. Click \"Regrade\" above to try again."
                                        : session.status === "abandoned"
                                            ? "This viva session ended without completing the assessment. You can click \"Regrade\" to attempt scoring anyway."
                                            : "Transcript and scoring will appear once the session ends."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <StudentIdCell studentId={session.student_id} />
                </div>
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
                {(session.assignment_context?.programming_language as string | undefined) && (
                    <div className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        <span>{session.assignment_context.programming_language as string}</span>
                    </div>
                )}
            </div>

            {/* Competency Scores & Override (User Story 7) */}
            {session.status === "completed" && (
                <CompetencyScoresSection
                    studentId={session.student_id}
                    assignmentId={assignmentId}
                    sessionId={sessionId}
                />
            )}

            {/* Voice Verification */}
            {details.voice_auth_events && details.voice_auth_events.length > 0 && (
                <VoiceVerificationSection events={details.voice_auth_events} />
            )}

            {/* Code context */}
            {(session.assignment_context?.code_context as string | undefined) && (
                <CodeBlock code={session.assignment_context.code_context as string} />
            )}

            {/* Transcript */}
            {transcripts.length > 0 && (
                <TranscriptSection transcripts={transcripts} defaultExpanded={session.status === "completed" || session.status === "grading_failed"} />
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
        </TooltipProvider>
    );
}
