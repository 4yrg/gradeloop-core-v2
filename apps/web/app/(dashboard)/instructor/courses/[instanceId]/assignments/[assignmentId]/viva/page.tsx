"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
    Mic2,
    Search,
    AlertCircle,
    CheckCircle2,
    Clock,
    XCircle,
    Eye,
    ArrowLeft,
    Trash2,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ivasApi } from "@/lib/ivas-api";
import type { VivaSession } from "@/types/ivas";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function StatusBadge({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Completed
            </span>
        );
    }
    if (status === "in_progress" || status === "initializing") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Clock className="h-3 w-3" />
                Active
            </span>
        );
    }
    if (status === "grading") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Grading
            </span>
        );
    }
    if (status === "grading_failed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <XCircle className="h-3 w-3" />
                Grading Failed
            </span>
        );
    }
    if (status === "abandoned") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <XCircle className="h-3 w-3" />
                Abandoned
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <XCircle className="h-3 w-3" />
            {status}
        </span>
    );
}

export default function InstructorVivaDashboardPage() {
    const params = useParams();
    const assignmentId = params.assignmentId as string;
    const instanceId = params.instanceId as string;

    const [sessions, setSessions] = React.useState<VivaSession[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [hasCompetencies, setHasCompetencies] = React.useState<boolean | null>(null);

    // Filters
    const [studentFilter, setStudentFilter] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("all");

    // Delete session state
    const [sessionToDelete, setSessionToDelete] = React.useState<VivaSession | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    // Regrade session state
    const [regradingId, setRegradingId] = React.useState<string | null>(null);

    const handleDeleteSession = async () => {
        if (!sessionToDelete) return;
        setDeleting(true);
        try {
            await ivasApi.deleteSession(sessionToDelete.id);
            setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
            setSessionToDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    const handleRegradeSession = async (session: VivaSession) => {
        setRegradingId(session.id);
        try {
            const updated = await ivasApi.regradeSession(session.id);
            setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, status: updated.status, total_score: updated.total_score, max_possible: updated.max_possible } : s));
        } catch {
            // Silently refresh on error
        } finally {
            setRegradingId(null);
        }
    };

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const [sess, comps] = await Promise.all([
                    ivasApi.listSessions({ assignment_id: assignmentId }),
                    ivasApi.listAssignmentCompetencies(assignmentId).catch(() => null),
                ]);
                if (mounted) {
                    setSessions(sess);
                    if (comps !== null) setHasCompetencies(comps.length > 0);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [assignmentId]);

    const filteredSessions = React.useMemo(() => {
        return sessions.filter(s => {
            if (studentFilter && !s.student_id.toLowerCase().includes(studentFilter.toLowerCase())) return false;
            if (statusFilter !== "all" && s.status !== statusFilter) return false;
            return true;
        });
    }, [sessions, studentFilter, statusFilter]);

    // Stats
    const totalSessions = sessions.length;
    const completedCount = sessions.filter(s => s.status === "completed").length;
    const activeCount = sessions.filter(s => s.status === "in_progress" || s.status === "initializing").length;
    const avgScore = (() => {
        const completed = sessions.filter(s => s.status === "completed" && s.total_score !== null && s.max_possible !== null && s.max_possible > 0);
        if (completed.length === 0) return null;
        const sum = completed.reduce((acc, s) => acc + (s.total_score ?? 0), 0);
        const max = completed.reduce((acc, s) => acc + (s.max_possible ?? 0), 0);
        if (max === 0) return null;
        return Math.round((sum / max) * 100);
    })();

    return (
        <div className="flex flex-col gap-6 pb-8">
            {/* Back + Header */}
            <div className="border-b border-border/40 pb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Button variant="ghost" size="sm" asChild className="gap-1">
                        <Link href={`/instructor/courses/${instanceId}/assignments/${assignmentId}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to Assignment
                        </Link>
                    </Button>
                </div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <Mic2 className="h-6 w-6" />
                    Viva Sessions
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Monitor and review all student viva sessions for this assignment.
                </p>
            </div>

            {/* No grading criteria warning */}
            {hasCompetencies === false && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold text-sm">No grading criteria configured</p>
                        <p className="text-xs mt-0.5">Students cannot start viva sessions until you add competencies.{" "}
                            <Link href={`/instructor/courses/${instanceId}/assignments/${assignmentId}/viva/competencies`} className="underline font-medium">
                                Configure competencies
                            </Link>
                        </p>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-border/60 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Sessions</p>
                    <p className="text-2xl font-bold">{loading ? "—" : totalSessions}</p>
                </div>
                <div className="border border-border/60 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Completed</p>
                    <p className="text-2xl font-bold text-emerald-600">{loading ? "—" : completedCount}</p>
                </div>
                <div className="border border-border/60 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Active</p>
                    <p className="text-2xl font-bold text-blue-600">{loading ? "—" : activeCount}</p>
                </div>
                <div className="border border-border/60 rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                    <p className="text-2xl font-bold">{loading ? "—" : avgScore !== null ? `${avgScore}%` : "—"}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by student ID..."
                        value={studentFilter}
                        onChange={e => setStudentFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="initializing">Initializing</SelectItem>
                        <SelectItem value="in_progress">Active</SelectItem>
                        <SelectItem value="grading">Grading</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="grading_failed">Grading Failed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Sessions table */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                    <Mic2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No sessions found for this assignment.</p>
                </div>
            ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border/40">
                                <th className="text-left px-4 py-2 font-medium">Date</th>
                                <th className="text-left px-4 py-2 font-medium">Student</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-left px-4 py-2 font-medium">Score</th>
                                <th className="text-right px-4 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSessions.map(s => (
                                <tr key={s.id} className="border-b border-border/20 hover:bg-muted/20">
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {format(new Date(s.started_at), "MMM d, yyyy")}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{s.student_id}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={s.status} />
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {s.total_score !== null ? `${s.total_score}/${s.max_possible}` : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {(s.status === "grading_failed" || s.status === "completed" || s.status === "abandoned") && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRegradeSession(s)}
                                                    disabled={regradingId === s.id}
                                                    className="gap-1"
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${regradingId === s.id ? "animate-spin" : ""}`} />
                                                    {regradingId === s.id ? "Regenerating…" : "Regrade"}
                                                </Button>
                                            )}
                                            <Button asChild variant="ghost" size="sm">
                                                <Link href={`/instructor/courses/${instanceId}/assignments/${assignmentId}/viva/${s.id}`}>
                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                    Review
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => setSessionToDelete(s)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                open={sessionToDelete !== null}
                onOpenChange={(open) => { if (!open) setSessionToDelete(null); }}
                title="Delete Viva Session"
                description={
                    <>
                        Are you sure you want to delete the viva session for{" "}
                        <span className="font-mono font-semibold">{sessionToDelete?.student_id}</span>?
                        This will permanently remove the session, its transcript, and all grading data.
                        This action cannot be undone.
                    </>
                }
                confirmText="Delete Session"
                variant="destructive"
                onConfirm={handleDeleteSession}
                isLoading={deleting}
            />
        </div>
    );
}
