"use client";

import { Pause, Play, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAYBACK_SPEEDS } from "@/lib/playback-engine";

interface PlaybackControlsProps {
    isPlaying: boolean;
    speed: number;
    eventIndex: number;
    totalEvents: number;
    currentTimestamp: number;   // ms since session start
    durationSeconds: number;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (index: number) => void;
    onSpeedChange: (speed: number) => void;
}

function formatMs(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PlaybackControls({
    isPlaying,
    speed,
    eventIndex,
    totalEvents,
    currentTimestamp,
    durationSeconds,
    onPlay,
    onPause,
    onSeek,
    onSpeedChange,
}: PlaybackControlsProps) {
    const progress = totalEvents > 0 ? eventIndex / totalEvents : 0;

    return (
        <div className="flex flex-col gap-2 px-4 py-3 border-t border-border bg-card select-none">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground w-10 shrink-0">
                    {formatMs(currentTimestamp)}
                </span>

                <div className="relative flex-1 h-2 bg-muted rounded-full overflow-hidden cursor-pointer group">
                    {/* filled portion */}
                    <div
                        className="h-full bg-primary rounded-full transition-none"
                        style={{ width: `${progress * 100}%` }}
                    />
                    {/* invisible hit-area input */}
                    <input
                        type="range"
                        min={0}
                        max={totalEvents}
                        value={eventIndex}
                        onChange={(e) => onSeek(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>

                <span className="text-xs tabular-nums text-muted-foreground w-10 shrink-0 text-right">
                    {formatSec(durationSeconds)}
                </span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3">
                {/* Reset */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { onPause(); onSeek(0); }}
                    title="Reset"
                >
                    <SkipBack className="h-4 w-4" />
                </Button>

                {/* Play / Pause */}
                <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={isPlaying ? onPause : onPlay}
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying
                        ? <Pause className="h-4 w-4" />
                        : <Play className="h-4 w-4" />
                    }
                </Button>

                {/* Speed selector */}
                <div className="flex items-center gap-1 ml-2">
                    {PLAYBACK_SPEEDS.map((s) => (
                        <button
                            key={s}
                            onClick={() => onSpeedChange(s)}
                            className={cn(
                                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                speed === s
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                        >
                            {s}×
                        </button>
                    ))}
                </div>

                {/* Event counter */}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {eventIndex.toLocaleString()} / {totalEvents.toLocaleString()} events
                </span>
            </div>
        </div>
    );
}
