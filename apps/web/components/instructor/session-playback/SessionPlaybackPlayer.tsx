"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, ShieldCheck, ShieldAlert, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePlaybackEngine } from "@/lib/playback-engine";
import type { PlaybackData } from "@/lib/api/keystroke";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackTimeline } from "./PlaybackTimeline";

// Monaco is heavyweight — lazy-load only on client
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-muted/30">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ),
});

interface SessionPlaybackPlayerProps {
    data: PlaybackData;
    language?: string;
}

function riskVariant(risk: number): "destructive" | "secondary" | "default" {
    if (risk >= 0.5) return "destructive";
    if (risk >= 0.3) return "secondary";
    return "default";
}

function riskLabel(risk: number): string {
    if (risk >= 0.5) return "High risk";
    if (risk >= 0.3) return "Moderate";
    return "Authenticated";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );
}

function RiskStatusCard({
    risk,
    similarity,
    isAnomaly,
    anomalyType,
    isStruggling,
    confidence,
}: {
    risk: number;
    similarity: number;
    isAnomaly: boolean;
    anomalyType?: string | null;
    isStruggling: boolean;
    confidence: string;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-4 flex flex-col gap-2 transition-colors duration-300",
                isAnomaly
                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                    : risk >= 0.3
                    ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30"
                    : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
            )}
        >
            <div className="flex items-center gap-2">
                {isAnomaly ? (
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                ) : risk >= 0.3 ? (
                    <ShieldAlert className="h-5 w-5 text-yellow-500" />
                ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                )}
                <span className="font-semibold text-sm">{riskLabel(risk)}</span>
                <Badge variant={riskVariant(risk)} className="ml-auto text-xs">
                    {confidence}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-background/60 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</p>
                    <p className="text-lg font-black tabular-nums">
                        {(risk * 100).toFixed(0)}%
                    </p>
                </div>
                <div className="rounded-lg bg-background/60 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Similarity</p>
                    <p className="text-lg font-black tabular-nums">
                        {(similarity * 100).toFixed(0)}%
                    </p>
                </div>
            </div>

            {isStruggling && (
                <div className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
                    <Zap className="h-3 w-3" />
                    Student is struggling
                </div>
            )}
            {isAnomaly && anomalyType && (
                <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {anomalyType}
                </div>
            )}
        </div>
    );
}

export function SessionPlaybackPlayer({ data, language = "python" }: SessionPlaybackPlayerProps) {
    const {
        text,
        monacoCursor,
        eventIndex,
        currentTimestamp,
        isPlaying,
        speed,
        authEntry,
        play,
        pause,
        seekToEvent,
        setSpeed,
    } = usePlaybackEngine(data.events, data.auth_timeline);

    // Keep Monaco cursor in sync
    const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>>[0] | null>(null);

    useEffect(() => {
        if (!editorRef.current) return;
        editorRef.current.setPosition(monacoCursor);
        editorRef.current.revealPositionInCenterIfOutsideViewport(monacoCursor);
    }, [monacoCursor]);

    // Seek by time (from PlaybackTimeline click)
    function seekToTime(ms: number) {
        const events = data.events;
        if (!events.length) return;
        // Binary search for closest event index
        let lo = 0, hi = events.length - 1, best = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (events[mid].timestamp <= ms) { best = mid + 1; lo = mid + 1; }
            else hi = mid - 1;
        }
        seekToEvent(best);
    }

    // Derive current auth state (fallback to summary when no auth entries yet)
    const currentRisk = authEntry?.risk_score ?? data.summary.average_risk_score;
    const currentSimilarity = authEntry?.similarity_score ?? (1 - data.summary.average_risk_score);
    const currentAnomaly = authEntry?.is_anomaly ?? false;
    const currentAnomalyType = authEntry?.anomaly_type ?? null;
    const currentStruggling = authEntry?.is_struggling ?? false;
    const currentConfidence = authEntry?.confidence_level ?? "LOW";

    const isAnomaly = currentAnomaly;

    return (
        <div className="flex flex-col h-full rounded-xl overflow-hidden border border-border bg-background">
            {/* ── Anomaly alert banner ────────────────────────────────────── */}
            {isAnomaly && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 dark:bg-red-950/40 dark:border-red-900">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">
                        Anomaly detected at this point in the session
                        {currentAnomalyType ? ` — ${currentAnomalyType}` : ""}
                    </span>
                </div>
            )}

            {/* ── Main body: editor + risk panel ──────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Editor */}
                <div className="flex-1 min-w-0 h-full">
                    <MonacoEditor
                        height="100%"
                        language={language}
                        value={text}
                        options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            renderLineHighlight: "line",
                            cursorBlinking: "phase",
                            theme: "vs-dark",
                        }}
                        onMount={(editor) => {
                            editorRef.current = editor;
                        }}
                    />
                </div>

                {/* Risk panel */}
                <div className="w-52 shrink-0 border-l border-border p-3 flex flex-col gap-3 overflow-y-auto bg-card">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Auth Status
                    </p>
                    <RiskStatusCard
                        risk={currentRisk}
                        similarity={currentSimilarity}
                        isAnomaly={currentAnomaly}
                        anomalyType={currentAnomalyType}
                        isStruggling={currentStruggling}
                        confidence={currentConfidence}
                    />

                    {/* Session summary */}
                    <div className="rounded-xl border p-3 text-xs space-y-1.5 mt-auto">
                        <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                            Session
                        </p>
                        <Row label="Avg risk" value={`${(data.summary.average_risk_score * 100).toFixed(0)}%`} />
                        <Row label="Max risk" value={`${(data.summary.max_risk_score * 100).toFixed(0)}%`} />
                        <Row label="Anomalies" value={data.summary.anomaly_count} />
                        <Row label="Auth failures" value={data.summary.authentication_failures} />
                        <Row label="Total events" value={data.total_events.toLocaleString()} />
                    </div>
                </div>
            </div>

            {/* ── Auth confidence timeline ─────────────────────────────────── */}
            <div className="border-t border-border pt-2">
                <PlaybackTimeline
                    authTimeline={data.auth_timeline}
                    durationSeconds={data.session_duration_seconds}
                    currentTimestamp={currentTimestamp}
                    onSeekToTime={seekToTime}
                />
            </div>

            {/* ── Playback controls ────────────────────────────────────────── */}
            <PlaybackControls
                isPlaying={isPlaying}
                speed={speed}
                eventIndex={eventIndex}
                totalEvents={data.events.length}
                currentTimestamp={currentTimestamp}
                durationSeconds={data.session_duration_seconds}
                onPlay={play}
                onPause={pause}
                onSeek={seekToEvent}
                onSpeedChange={setSpeed}
            />
        </div>
    );
}
