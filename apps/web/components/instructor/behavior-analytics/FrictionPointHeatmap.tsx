"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FrictionPoint } from "@/lib/api/keystroke";

interface FrictionPointHeatmapProps {
    frictionPoints: FrictionPoint[];
    durationSeconds: number;
}

function formatSec(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

function intensityColor(deletion_rate: number, severity: string): string {
    if (severity === "high" || deletion_rate > 0.5) return "bg-red-500";
    if (deletion_rate > 0.3) return "bg-orange-400";
    return "bg-yellow-400";
}

export function FrictionPointHeatmap({ frictionPoints, durationSeconds }: FrictionPointHeatmapProps) {
    const totalMs = Math.max(1, durationSeconds);

    if (!frictionPoints || frictionPoints.length === 0) {
        return (
            <div className="flex items-center justify-center h-12 text-sm text-muted-foreground rounded-lg bg-muted/30">
                No friction points detected — student typed smoothly.
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={80}>
            <div className="space-y-2">
                {/* Timeline bar */}
                <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                    {frictionPoints.map((fp, i) => {
                        const leftPct = Math.min(99, (fp.offset_seconds / totalMs) * 100);
                        // Width scales with duration (capped at 5% min visible)
                        const widthPct = Math.max(
                            1.5,
                            Math.min(10, (fp.duration / totalMs) * 100)
                        );

                        return (
                            <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "absolute top-0 h-full rounded-sm cursor-pointer opacity-80 hover:opacity-100 transition-opacity",
                                            intensityColor(fp.deletion_rate, fp.severity)
                                        )}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs space-y-0.5">
                                    <p className="font-semibold">
                                        {fp.severity === "high" ? "⚠ High friction" : "⚡ Medium friction"}
                                    </p>
                                    <p>At {formatSec(fp.offset_seconds)}</p>
                                    <p>Duration: {fp.duration.toFixed(1)}s</p>
                                    <p>Deletion rate: {(fp.deletion_rate * 100).toFixed(0)}%</p>
                                    <p>Long pauses: {fp.long_pauses}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}

                    {/* Tick marks */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                        <div
                            key={tick}
                            className="absolute top-0 bottom-0 w-px bg-border/40"
                            style={{ left: `${tick * 100}%` }}
                        />
                    ))}
                </div>

                {/* Time labels */}
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                    <span>0:00</span>
                    <span>{formatSec(Math.floor(durationSeconds * 0.25))}</span>
                    <span>{formatSec(Math.floor(durationSeconds * 0.5))}</span>
                    <span>{formatSec(Math.floor(durationSeconds * 0.75))}</span>
                    <span>{formatSec(durationSeconds)}</span>
                </div>

                {/* Legend & count */}
                <div className="flex items-center gap-4 flex-wrap">
                    {[
                        { color: "bg-yellow-400", label: "Moderate friction" },
                        { color: "bg-orange-400", label: "High deletion rate" },
                        { color: "bg-red-500", label: "Severe friction" },
                    ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <div className={cn("h-2.5 w-2.5 rounded-sm opacity-80", color)} />
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                        </div>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground font-medium">
                        {frictionPoints.length} friction point{frictionPoints.length !== 1 ? "s" : ""} detected
                    </span>
                </div>
            </div>
        </TooltipProvider>
    );
}
