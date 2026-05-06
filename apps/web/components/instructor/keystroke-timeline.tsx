"use client";

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ShieldAlert,
    User,
    Wifi,
    WifiOff,
    Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineEvent {
    offset_seconds: number;
    similarity_score: number;
    risk_score: number;
    authenticated: boolean;
    is_anomaly: boolean;
    anomaly_type?: string;
    is_struggling: boolean;
    created_at?: string;
}

interface TimelinePayload {
    type?: string;
    events?: TimelineEvent[];
    offset_seconds?: number;
    risk_score?: number;
    similarity_score?: number;
    authenticated?: boolean;
    is_anomaly?: boolean;
    anomaly_type?: string;
    is_struggling?: boolean;
    timestamp?: string;
    events_captured?: number;
}

interface TimelineStats {
    total_events: number;
    anomaly_count: number;
    avg_risk_score: number;
    avg_similarity: number;
    struggle_count: number;
}

interface KeystrokeTimelineProps {
    userId: string;
    sessionId: string;
    assignmentId?: string;
    /** Override WebSocket gateway URL (defaults to NEXT_PUBLIC_WS_URL or 178.105.102.246:8000) */
    wsUrl?: string;

    /** Override REST API base URL (defaults to NEXT_PUBLIC_API_URL or 178.105.102.246:8000) */
    apiUrl?: string;
    className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventColor(event: TimelineEvent): string {
    if (event.is_anomaly) return "bg-red-500";
    if (event.is_struggling) return "bg-yellow-400";
    if (!event.authenticated) return "bg-orange-400";
    return "bg-emerald-500";
}

function getEventLabel(event: TimelineEvent): string {
    if (event.is_anomaly) return event.anomaly_type ?? "Anomaly";
    if (event.is_struggling) return "Struggling";
    if (!event.authenticated) return "Unverified";
    return "Authenticated";
}

function formatSeconds(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeStats(events: TimelineEvent[]): TimelineStats {
    if (events.length === 0) {
        return { total_events: 0, anomaly_count: 0, avg_risk_score: 0, avg_similarity: 0, struggle_count: 0 };
    }
    return {
        total_events: events.length,
        anomaly_count: events.filter((e) => e.is_anomaly).length,
        avg_risk_score: events.reduce((a, e) => a + e.risk_score, 0) / events.length,
        avg_similarity: events.reduce((a, e) => a + e.similarity_score, 0) / events.length,
        struggle_count: events.filter((e) => e.is_struggling).length,
    };
}

function normalizeTimelineEvent(payload: TimelinePayload): TimelineEvent {
    const riskScore = Number(payload.risk_score ?? 0);
    const similarityScore = Number(payload.similarity_score ?? Math.max(0, 1 - riskScore));

    return {
        offset_seconds: Number(payload.offset_seconds ?? 0),
        similarity_score: similarityScore,
        risk_score: riskScore,
        authenticated: Boolean(payload.authenticated ?? (payload.type === "status_update" ? false : riskScore < 0.3)),
        is_anomaly: Boolean(payload.is_anomaly ?? riskScore >= 0.6),
        anomaly_type: payload.anomaly_type,
        is_struggling: Boolean(payload.is_struggling ?? false),
        created_at: payload.timestamp,
    };
}

function stripApiV1(url: string): string {
    return url.replace(/\/api\/v1\/?$/, "");
}

function toWsUrl(url: string): string {
    return stripApiV1(url).replace(/^http/, "ws");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
    label,
    value,
    variant = "default",
}: {
    label: string;
    value: React.ReactNode;
    variant?: "default" | "danger" | "warning" | "success";
}) {
    const colors: Record<typeof variant, string> = {
        default: "bg-muted text-muted-foreground",
        danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    };
    return (
        <div className={cn("min-w-0 rounded-lg px-2 py-2 text-center sm:px-3", colors[variant])}>
            <p className="truncate text-[10px] font-medium uppercase opacity-70 sm:text-xs">{label}</p>
            <p className="text-base font-black tabular-nums sm:text-lg">{value}</p>
        </div>
    );
}

function EventDot({ event }: { event: TimelineEvent }) {
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "relative h-3 w-3 rounded-full cursor-pointer",
                            "ring-2 ring-background hover:scale-125 transition-transform duration-100",
                            getEventColor(event),
                            event.is_anomaly && "animate-pulse"
                        )}
                        style={{ marginTop: event.is_anomaly ? "-2px" : "0" }}
                    />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                    <div className="space-y-0.5">
                        <p className="font-semibold">{getEventLabel(event)}</p>
                        <p className="text-muted-foreground">@ {formatSeconds(event.offset_seconds)}</p>
                        <p>Risk: {(event.risk_score * 100).toFixed(0)}%</p>
                        <p>Similarity: {(event.similarity_score * 100).toFixed(0)}%</p>
                        {event.anomaly_type && <p className="text-red-500">⚠ {event.anomaly_type}</p>}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KeystrokeTimeline({
    userId,
    sessionId,
    wsUrl,
    apiUrl,
    className,
}: KeystrokeTimelineProps) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [liveRisk, setLiveRisk] = useState<number | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const resolvedApiBase = stripApiV1(
        apiUrl ??
        process.env.NEXT_PUBLIC_GATEWAY_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "http://178.105.102.246:8000"
    );

    const resolvedWsBase =
        wsUrl ??
        (process.env.NEXT_PUBLIC_WS_URL
            ? stripApiV1(process.env.NEXT_PUBLIC_WS_URL)
            : toWsUrl(resolvedApiBase));

    // ── Load historical timeline ──────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch(`${resolvedApiBase}/api/keystroke/timeline/${sessionId}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setEvents(data.events ?? []);
        } catch {
            // History fetch failure is non-fatal; live WS will populate events
        } finally {
            setIsLoadingHistory(false);
        }
    }, [resolvedApiBase, sessionId]);

    // ── WebSocket connection ──────────────────────────────────────────────────
    const connectWs = useCallback(function connect() {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const url = `${resolvedWsBase}/ws/monitor/${userId}/${sessionId}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsStatus("connected");
        ws.onclose = () => {
            setWsStatus("disconnected");
            // Reconnect after 5 s if component still mounted
            reconnectTimerRef.current = setTimeout(() => connect(), 5000);
        };
        ws.onerror = () => ws.close();

        ws.onmessage = (msg) => {
            try {
                const payload = JSON.parse(msg.data as string) as TimelinePayload;

                if (payload.type === "history" || payload.type === "timeline_history") {
                    setEvents(payload.events ?? []);
                    return;
                }

                if (
                    payload.type === "auth_update" ||
                    payload.type === "status_update" ||
                    payload.risk_score !== undefined
                ) {
                    setLiveRisk(payload.risk_score ?? null);

                    if (payload.offset_seconds !== undefined && (payload.type !== "status_update" || (payload.events_captured ?? 0) > 0)) {
                        const event = normalizeTimelineEvent(payload);
                        setEvents((prev) => {
                            const exists = prev.some((e) => e.offset_seconds === event.offset_seconds);
                            return exists ? prev : [...prev, event];
                        });
                    }
                }
            } catch {
                // non-JSON frames are ignored
            }
        };
    }, [resolvedWsBase, userId, sessionId]);

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        fetchHistory();
        connectWs();

        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [fetchHistory, connectWs]);

    // ── Derived state ─────────────────────────────────────────────────────────
    const stats = computeStats(events);
    const lastEvent = events[events.length - 1];
    const sessionDuration = lastEvent ? lastEvent.offset_seconds : 0;
    const riskPercent = liveRisk !== null ? liveRisk : stats.avg_risk_score;

    const overallStatus: "safe" | "warning" | "danger" =
        riskPercent > 0.6 ? "danger" : riskPercent > 0.3 ? "warning" : "safe";

    const statusMeta = {
        safe: { label: "Low Risk", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
        warning: { label: "Suspicious", icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400" },
        danger: { label: "High Risk", icon: ShieldAlert, color: "text-red-600 dark:text-red-400" },
    }[overallStatus];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Card className={cn("w-full max-w-full min-w-0 border-border/60 shadow-sm", className)}>
            <CardHeader className="min-w-0 pb-3">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-bold">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="truncate">Keystroke Timeline</span>
                    </CardTitle>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {/* Live risk badge */}
                        {liveRisk !== null && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "whitespace-nowrap text-xs tabular-nums",
                                    liveRisk > 0.6
                                        ? "border-red-500 text-red-500"
                                        : liveRisk > 0.3
                                            ? "border-yellow-500 text-yellow-500"
                                            : "border-emerald-500 text-emerald-500"
                                )}
                            >
                                <span className="mr-1 h-2 w-2 rounded-full bg-current inline-block animate-pulse" />
                                Live Risk: {(liveRisk * 100).toFixed(0)}%
                            </Badge>
                        )}

                        {/* Overall status */}
                        <Badge
                            variant="outline"
                            className={cn("whitespace-nowrap text-xs", statusMeta.color)}
                        >
                            <statusMeta.icon className="h-3 w-3 mr-1" />
                            {statusMeta.label}
                        </Badge>

                        {/* WebSocket connection indicator */}
                        <span
                            className={cn(
                                "flex items-center gap-1 whitespace-nowrap text-xs",
                                wsStatus === "connected"
                                    ? "text-emerald-500"
                                    : wsStatus === "connecting"
                                        ? "text-yellow-500"
                                        : "text-muted-foreground"
                            )}
                        >
                            {wsStatus === "connected" ? (
                                <Wifi className="h-3 w-3" />
                            ) : wsStatus === "connecting" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <WifiOff className="h-3 w-3" />
                            )}
                            {wsStatus}
                        </span>
                    </div>
                </div>

                {/* Metadata row */}
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="max-w-[min(18rem,70vw)] truncate">{userId}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatSeconds(sessionDuration)}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatPill label="Events" value={stats.total_events} />
                    <StatPill
                        label="Anomalies"
                        value={stats.anomaly_count}
                        variant={stats.anomaly_count > 0 ? "danger" : "success"}
                    />
                    <StatPill
                        label="Avg Risk"
                        value={`${(stats.avg_risk_score * 100).toFixed(0)}%`}
                        variant={stats.avg_risk_score > 0.6 ? "danger" : stats.avg_risk_score > 0.3 ? "warning" : "success"}
                    />
                    <StatPill
                        label="Avg Similarity"
                        value={`${(stats.avg_similarity * 100).toFixed(0)}%`}
                        variant={stats.avg_similarity < 0.4 ? "danger" : stats.avg_similarity < 0.6 ? "warning" : "success"}
                    />
                </div>

                {/* Timeline track */}
                <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Event Timeline
                    </p>

                    {isLoadingHistory ? (
                        <div className="h-10 flex items-center justify-center text-muted-foreground text-sm gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading history...
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex min-h-10 items-center justify-center px-2 text-center text-sm text-muted-foreground">
                            No events yet - waiting for keystroke data
                        </div>
                    ) : (
                        <div className="w-full min-w-0 rounded-md border border-border/50 bg-background px-3 py-3">
                            <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-3">
                                {events.map((event, i) => (
                                    <div key={`${event.offset_seconds}-${i}`} className="flex items-center gap-2">
                                        <EventDot event={event} />
                                        {i < events.length - 1 && (
                                            <span className="h-0.5 w-3 rounded-full bg-border" />
                                        )}
                                    </div>
                                ))}

                                {/* Live indicator */}
                                {wsStatus === "connected" && (
                                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
                    {[
                        { color: "bg-emerald-500", label: "Authenticated" },
                        { color: "bg-yellow-400", label: "Struggling" },
                        { color: "bg-orange-400", label: "Unverified" },
                        { color: "bg-red-500", label: "Anomaly" },
                    ].map(({ color, label }) => (
                        <span key={label} className="flex items-center gap-1.5">
                            <span className={cn("inline-block w-2.5 h-2.5 rounded-full", color)} />
                            {label}
                        </span>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
