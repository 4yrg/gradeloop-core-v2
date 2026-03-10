"use client";

import { useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AuthTimelineEntry } from "@/lib/api/keystroke";
import { cn } from "@/lib/utils";

interface PlaybackTimelineProps {
    authTimeline: AuthTimelineEntry[];
    durationSeconds: number;
    currentTimestamp: number;   // ms since session start
    onSeekToTime: (ms: number) => void;
}

function riskColor(risk: number): string {
    if (risk >= 0.5) return "bg-red-500";
    if (risk >= 0.3) return "bg-yellow-400";
    return "bg-emerald-500";
}

function formatSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PlaybackTimeline({
    authTimeline,
    durationSeconds,
    currentTimestamp,
    onSeekToTime,
}: PlaybackTimelineProps) {
    const barRef = useRef<HTMLDivElement>(null);

    function handleClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!barRef.current) return;
        const rect = barRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeekToTime(ratio * durationSeconds * 1000);
    }

    const totalMs = durationSeconds * 1000 || 1;
    const playheadPct = Math.min(100, (currentTimestamp / totalMs) * 100);

    // Build segments between consecutive auth events
    const segments: Array<{
        startPct: number;
        widthPct: number;
        risk: number;
    }> = [];

    if (authTimeline.length > 0) {
        // Fill from 0 to first entry as neutral
        const sortedAuth = [...authTimeline].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

        sortedAuth.forEach((entry, i) => {
            const start = entry.timestamp_ms / totalMs;
            const end =
                i + 1 < sortedAuth.length
                    ? sortedAuth[i + 1].timestamp_ms / totalMs
                    : 1;
            segments.push({
                startPct: Math.min(100, start * 100),
                widthPct: Math.max(0.2, (end - start) * 100),
                risk: entry.risk_score,
            });
        });
    }

    return (
        <TooltipProvider delayDuration={80}>
            <div className="px-4 pb-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    Auth confidence timeline
                </p>

                {/* Main bar */}
                <div
                    ref={barRef}
                    onClick={handleClick}
                    className="relative h-5 bg-muted rounded-full overflow-hidden cursor-pointer"
                >
                    {/* Risk segments */}
                    {segments.length > 0 ? (
                        segments.map((seg, i) => (
                            <div
                                key={i}
                                className={cn("absolute top-0 h-full opacity-80", riskColor(seg.risk))}
                                style={{
                                    left: `${seg.startPct}%`,
                                    width: `${seg.widthPct}%`,
                                }}
                            />
                        ))
                    ) : (
                        <div className="absolute inset-0 bg-muted-foreground/10 rounded-full" />
                    )}

                    {/* Anomaly / struggle markers */}
                    {authTimeline.map((entry, i) => {
                        if (!entry.is_anomaly && !entry.is_struggling) return null;
                        const pct = (entry.timestamp_ms / totalMs) * 100;
                        return (
                            <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "absolute top-0 bottom-0 w-1 cursor-pointer",
                                            entry.is_anomaly
                                                ? "bg-red-700"
                                                : "bg-yellow-600"
                                        )}
                                        style={{ left: `${Math.min(99, pct)}%` }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[180px]">
                                    <p className="font-semibold">
                                        {entry.is_anomaly ? "⚠ Anomaly" : "⚡ Struggling"}
                                    </p>
                                    <p>At {formatSec(entry.offset_seconds)}</p>
                                    {entry.anomaly_type && (
                                        <p className="opacity-70">{entry.anomaly_type}</p>
                                    )}
                                    <p>Risk: {(entry.risk_score * 100).toFixed(0)}%</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}

                    {/* Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
                        style={{ left: `${playheadPct}%` }}
                    />
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-1.5">
                    {[
                        { color: "bg-emerald-500", label: "Authenticated" },
                        { color: "bg-yellow-400", label: "Moderate risk" },
                        { color: "bg-red-500", label: "High risk / anomaly" },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <div className={cn("h-2 w-2 rounded-full opacity-80", color)} />
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
