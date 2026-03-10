"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    Activity,
    RefreshCw,
    ArrowLeft,
    Loader2,
    AlertCircle,
    Clock,
    Users,
    Fingerprint,
    ChevronRight,
    CheckCircle2,
    Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/instructor/section-header";
import { KeystrokeTimeline } from "@/components/instructor/keystroke-timeline";
import { keystrokeApi } from "@/lib/api/keystroke";
import { usersApi } from "@/lib/api/users";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStatus = "COLLECTING_DATA" | "AUTHENTICATED" | "SUSPICIOUS" | "REJECTED";

interface StudentMonitorRow {
    user_id: string;
    session_id: string;
    display_name: string;
    student_id?: string;
    status: AuthStatus;
    risk_score: number;
    event_count: number;
    last_verification: string | null;
    session_started: string | null;
    is_live: boolean;
    anomaly_count: number;
    struggle_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<
    AuthStatus,
    { label: string; icon: React.ElementType; color: string; bg: string; ring: string }
> = {
    AUTHENTICATED: {
        label: "Authenticated",
        icon: CheckCircle2,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        ring: "ring-emerald-500/30",
    },
    SUSPICIOUS: {
        label: "Suspicious",
        icon: AlertTriangle,
        color: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-950/40",
        ring: "ring-yellow-500/30",
    },
    REJECTED: {
        label: "High Risk",
        icon: ShieldAlert,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/40",
        ring: "ring-red-500/30",
    },
    COLLECTING_DATA: {
        label: "Collecting Data",
        icon: Activity,
        color: "text-muted-foreground",
        bg: "bg-muted",
        ring: "ring-border",
    },
};

function StatusBadgeCell({ status }: { status: AuthStatus }) {
    const meta = STATUS_META[status] ?? STATUS_META.COLLECTING_DATA;
    const Icon = meta.icon;
    return (
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1", meta.bg, meta.color, meta.ring)}>
            <Icon className="h-3 w-3" />
            {meta.label}
        </span>
    );
}

function RiskBar({ score }: { score: number }) {
    // score is risk_score (0–1). Similarity = 1 − risk. Show similarity so
    // instructors see "match %" — higher = more like the enrolled user.
    const similarity = Math.round((1 - score) * 100);
    const color =
        similarity >= 50 ? "bg-emerald-500" : similarity >= 30 ? "bg-yellow-400" : "bg-red-500";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${similarity}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-14">
                {similarity}% match
            </span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function AssignmentMonitoringPage({
    params,
}: {
    params: Promise<{ instanceId: string; assignmentId: string }>;
}) {
    const { assignmentId } = React.use(params);
    const searchParams = useSearchParams();
    const router = useRouter();

    // Selected student for timeline detail
    const selectedUserId = searchParams.get("userId");
    const selectedSessionId = searchParams.get("sessionId");
    const selectedName = searchParams.get("name");

    const [students, setStudents] = React.useState<StudentMonitorRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
    const [page, setPage] = React.useState(1);

    // ── Data fetching ─────────────────────────────────────────────────────────
    const fetchData = React.useCallback(
        async (options?: { silent?: boolean }) => {
            if (!options?.silent) setIsLoading(true);
            else setIsRefreshing(true);

            try {
                setError(null);

                // Fetch live (Redis) and historical (DB) sessions in parallel
                const [liveResult, histResult] = await Promise.allSettled([
                    keystrokeApi.getActiveSessionsByAssignment(assignmentId),
                    keystrokeApi.getAssignmentStudentSummaries(assignmentId),
                ]);

                const liveRows: StudentMonitorRow[] = [];
                const histRows: StudentMonitorRow[] = [];

                if (liveResult.status === "fulfilled") {
                    for (const s of liveResult.value.sessions) {
                        liveRows.push({
                            user_id: s.user_id,
                            session_id: s.session_id,
                            display_name: s.user_id,
                            status: s.status,
                            risk_score: s.risk_score,
                            event_count: s.event_count,
                            last_verification: s.last_verification,
                            session_started: s.session_started ?? null,
                            is_live: true,
                            anomaly_count: 0,
                            struggle_count: 0,
                        });
                    }
                }

                if (histResult.status === "fulfilled") {
                    for (const s of histResult.value.students) {
                        // Prefer live data — skip duplicates
                        if (liveRows.some((r) => r.session_id === s.session_id)) continue;
                        histRows.push({
                            user_id: s.user_id,
                            session_id: s.session_id,
                            display_name: s.user_id,
                            status: s.status as AuthStatus,
                            risk_score: s.avg_risk_score,
                            event_count: s.event_count,
                            last_verification: s.last_event_at ?? null,
                            session_started: s.session_started_at ?? null,
                            is_live: false,
                            anomaly_count: s.anomaly_count ?? 0,
                            struggle_count: s.struggle_count ?? 0,
                        });
                    }
                }

                const allRows = [...liveRows, ...histRows];

                // Batch-resolve display names from IAM
                const uniqueIds = [...new Set(allRows.map((r) => r.user_id))];
                const nameMap = new Map<string, { name: string; studentId?: string }>();
                await Promise.allSettled(
                    uniqueIds.map(async (uid) => {
                        try {
                            const user = await usersApi.get(uid);
                            nameMap.set(uid, {
                                name: user.full_name ?? uid,
                                studentId: user.student_id,
                            });
                        } catch {
                            /* fallback to uid */
                        }
                    })
                );

                setStudents(
                    allRows.map((r) => ({
                        ...r,
                        display_name: nameMap.get(r.user_id)?.name ?? r.user_id,
                        student_id: nameMap.get(r.user_id)?.studentId,
                    }))
                );
                setLastRefresh(new Date());
            } catch {
                setError("Failed to load monitoring data. Make sure the keystroke service is running.");
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [assignmentId]
    );

    // Initial load + auto-refresh every 10 s
    React.useEffect(() => {
        fetchData();
        const t = setInterval(() => fetchData({ silent: true }), 10_000);
        return () => clearInterval(t);
    }, [fetchData]);

    // ── Navigate to student timeline ──────────────────────────────────────────
    const openTimeline = (row: StudentMonitorRow) => {
        const sp = new URLSearchParams({
            userId: row.user_id,
            sessionId: row.session_id,
            name: row.display_name,
        });
        router.push(`?${sp.toString()}`, { scroll: false });
    };

    const closeTimeline = () => {
        router.push("?", { scroll: false });
    };

    // ─── Detail view (timeline) ───────────────────────────────────────────────
    if (selectedUserId && selectedSessionId) {
        return (
            <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-200">
                {/* Back bar */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={closeTimeline} className="gap-1.5 -ml-1">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Monitor
                    </Button>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm font-medium">{selectedName ?? selectedUserId}</span>
                </div>

                <KeystrokeTimeline
                    userId={selectedUserId}
                    sessionId={selectedSessionId}
                    assignmentId={assignmentId}
                />
            </div>
        );
    }

    // ─── KPI summary bar ──────────────────────────────────────────────────────
    const liveCount = students.filter((s) => s.is_live).length;
    const highRiskCount = students.filter((s) => s.status === "REJECTED").length;
    const suspiciousCount = students.filter((s) => s.status === "SUSPICIOUS").length;
    const authenticatedCount = students.filter((s) => s.status === "AUTHENTICATED").length;

    // ─── Pagination ───────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
    const pageStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // ─── List view ────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6 pb-8 animate-in fade-in duration-200">
            <SectionHeader
                title="Auth Monitor"
                description="Real-time keystroke authentication status for students taking this assignment."
                action={
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchData({ silent: true })}
                            disabled={isRefreshing}
                            className="gap-1.5"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                }
            />

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Live Now", value: liveCount, icon: Radio, color: "text-primary" },
                    { label: "Authenticated", value: authenticatedCount, icon: ShieldCheck, color: "text-emerald-600" },
                    { label: "Suspicious", value: suspiciousCount, icon: AlertTriangle, color: "text-yellow-600" },
                    { label: "High Risk", value: highRiskCount, icon: ShieldAlert, color: "text-red-600" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="border-border/60">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className={cn("rounded-lg p-2 bg-muted shrink-0", color)}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="text-xl font-black tabular-nums">{isLoading ? "—" : value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {(Object.entries(STATUS_META) as [AuthStatus, typeof STATUS_META[AuthStatus]][]).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                        <span key={key} className={cn("flex items-center gap-1.5", meta.color)}>
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                        </span>
                    );
                })}
                <span className="flex items-center gap-1.5 ml-auto">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Live (active session)
                </span>
            </div>

            {/* Student table */}
            <Card className="border-border/60">
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Sessions
                        {!isLoading && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                                {students.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="divide-y divide-border/40">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3.5 w-36" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-6 w-24 rounded-full" />
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-7 w-7 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <div className="rounded-2xl bg-muted p-4">
                                <Fingerprint className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="font-medium">No keystroke data yet</p>
                            <p className="text-sm text-muted-foreground max-w-[300px]">
                                Students who have keystroke authentication enrolled will appear here once they start the assignment.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-border/40">
                                {pageStudents.map((row) => (
                                    <button
                                        key={`${row.user_id}-${row.session_id}`}
                                        className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors group"
                                        onClick={() => openTimeline(row)}
                                    >
                                        {/* Avatar */}
                                        <div
                                            className={cn(
                                                "shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ring-2",
                                                STATUS_META[row.status]?.bg,
                                                STATUS_META[row.status]?.ring,
                                                STATUS_META[row.status]?.color
                                            )}
                                        >
                                            {row.display_name[0]?.toUpperCase() ?? "?"}
                                        </div>

                                        {/* Name + ID */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm truncate">
                                                    {row.display_name}
                                                </span>
                                                {row.is_live && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                                                        Live
                                                    </span>
                                                )}
                                            </div>
                                            {row.student_id && (
                                                <p className="text-xs text-muted-foreground font-mono">{row.student_id}</p>
                                            )}
                                            {row.session_started && (
                                                <p className="text-xs text-muted-foreground">
                                                    Started {formatDistanceToNow(new Date(row.session_started), { addSuffix: true })}
                                                </p>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="shrink-0">
                                            <StatusBadgeCell status={row.status} />
                                        </div>

                                        {/* Risk bar */}
                                        <div className="shrink-0 hidden sm:block">
                                            <RiskBar score={row.risk_score} />
                                        </div>

                                        {/* Anomaly / struggle flags */}
                                        <div className="shrink-0 hidden md:flex items-center gap-2">
                                            {row.anomaly_count > 0 && (
                                                <span title={`${row.anomaly_count} anomaly events`} className="flex items-center gap-0.5 text-xs text-red-500">
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    {row.anomaly_count}
                                                </span>
                                            )}
                                            {row.struggle_count > 0 && (
                                                <span title={`${row.struggle_count} struggle events`} className="flex items-center gap-0.5 text-xs text-yellow-500">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    {row.struggle_count}
                                                </span>
                                            )}
                                        </div>

                                        {/* Events */}
                                        <div className="shrink-0 hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {row.event_count} events
                                        </div>

                                        {/* Chevron */}
                                        <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </button>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 text-sm text-muted-foreground">
                                    <span>
                                        Page {page} of {totalPages} · {students.length} students
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => p - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page === totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Info note */}
            <p className="text-xs text-muted-foreground text-center">
                Live sessions update automatically every 10 seconds. Historical sessions come from the database.
            </p>
        </div>
    );
}
