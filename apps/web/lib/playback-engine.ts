/**
 * PlaybackEngine – virtual text buffer that reconstructs code state
 * by replaying raw keystroke events in sequence.
 *
 * Limitations:
 * - Clipboard operations (Ctrl+C/V/X) cannot reconstruct pasted content
 *   because the paste payload isn't stored in the raw event stream.
 * - Complex selection shortcuts (Ctrl+A, Shift+Click etc.) move the
 *   cursor to position 0 / end-of-text as a safe fallback.
 * - The result is a best-effort reconstruction; it will be accurate for
 *   most sessions that consist primarily of typing and backspacing.
 */

import type { PlaybackEvent, AuthTimelineEntry } from "./api/keystroke";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Engine class ─────────────────────────────────────────────────────────────

export class PlaybackEngine {
    private events: PlaybackEvent[];
    public text: string = "";
    public cursor: number = 0; // flat index into `text`

    constructor(events: PlaybackEvent[]) {
        // Sort defensively – should already be sorted by timestamp
        this.events = [...events].sort((a, b) => a.timestamp - b.timestamp);
    }

    get length(): number {
        return this.events.length;
    }

    /** Apply events [0, upTo) from scratch, resetting state first. */
    seekTo(upTo: number): void {
        this.text = "";
        this.cursor = 0;
        const limit = Math.min(upTo, this.events.length);
        for (let i = 0; i < limit; i++) {
            this.applyEvent(this.events[i]);
        }
    }

    /** Apply a single event, mutating `text` and `cursor`. */
    applyEvent(event: PlaybackEvent): void {
        const key = event.key;

        // Skip pure modifier keys
        if (
            key === "Control" ||
            key === "Shift" ||
            key === "Alt" ||
            key === "Meta" ||
            key === "CapsLock" ||
            key === "NumLock" ||
            key === "ScrollLock" ||
            key === "Pause" ||
            key === "ContextMenu" ||
            key.startsWith("F") && key.length <= 3 && !isNaN(Number(key.slice(1)))
        ) {
            return;
        }

        switch (key) {
            case "Enter": {
                this.text =
                    this.text.slice(0, this.cursor) +
                    "\n" +
                    this.text.slice(this.cursor);
                this.cursor += 1;
                break;
            }
            case "Tab": {
                // Indent with 4 spaces (common in IDEs)
                this.text =
                    this.text.slice(0, this.cursor) +
                    "    " +
                    this.text.slice(this.cursor);
                this.cursor += 4;
                break;
            }
            case "Backspace": {
                if (this.cursor > 0) {
                    this.text =
                        this.text.slice(0, this.cursor - 1) +
                        this.text.slice(this.cursor);
                    this.cursor -= 1;
                }
                break;
            }
            case "Delete": {
                if (this.cursor < this.text.length) {
                    this.text =
                        this.text.slice(0, this.cursor) +
                        this.text.slice(this.cursor + 1);
                }
                break;
            }
            case "ArrowLeft": {
                if (this.cursor > 0) this.cursor -= 1;
                break;
            }
            case "ArrowRight": {
                if (this.cursor < this.text.length) this.cursor += 1;
                break;
            }
            case "ArrowUp": {
                const lineStart = this.text.lastIndexOf("\n", this.cursor - 1) + 1;
                const col = this.cursor - lineStart;
                const prevLineEnd = lineStart - 1; // the '\n' char
                if (prevLineEnd >= 0) {
                    const prevLineStart =
                        this.text.lastIndexOf("\n", prevLineEnd - 1) + 1;
                    const prevLineLen = prevLineEnd - prevLineStart;
                    this.cursor = prevLineStart + Math.min(col, prevLineLen);
                } else {
                    this.cursor = 0;
                }
                break;
            }
            case "ArrowDown": {
                const lineStart2 =
                    this.text.lastIndexOf("\n", this.cursor - 1) + 1;
                const col2 = this.cursor - lineStart2;
                const lineEnd = this.text.indexOf("\n", this.cursor);
                if (lineEnd !== -1) {
                    const nextLineStart = lineEnd + 1;
                    const nextLineEnd = this.text.indexOf("\n", nextLineStart);
                    const nextLineLen =
                        nextLineEnd !== -1
                            ? nextLineEnd - nextLineStart
                            : this.text.length - nextLineStart;
                    this.cursor = nextLineStart + Math.min(col2, nextLineLen);
                } else {
                    this.cursor = this.text.length;
                }
                break;
            }
            case "Home": {
                this.cursor =
                    this.text.lastIndexOf("\n", this.cursor - 1) + 1;
                break;
            }
            case "End": {
                const eol = this.text.indexOf("\n", this.cursor);
                this.cursor = eol !== -1 ? eol : this.text.length;
                break;
            }
            case "PageUp":
            case "PageDown":
                break; // no meaningful reconstruction without viewport height

            default: {
                if (key.length === 1) {
                    this.text =
                        this.text.slice(0, this.cursor) +
                        key +
                        this.text.slice(this.cursor);
                    this.cursor += 1;
                }
                // Multi-char non-printable keys (e.g. "Unidentified") – skip
            }
        }
    }

    /** Convert flat cursor to Monaco-compatible { lineNumber, column } (1-based). */
    getMonacoCursor(): { lineNumber: number; column: number } {
        const before = this.text.slice(0, this.cursor);
        const lines = before.split("\n");
        return {
            lineNumber: lines.length,
            column: lines[lines.length - 1].length + 1,
        };
    }

    getEventAt(index: number): PlaybackEvent | null {
        return this.events[index] ?? null;
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface PlaybackState {
    text: string;
    monacoCursor: { lineNumber: number; column: number };
    eventIndex: number;
    currentTimestamp: number;   // ms since session start of last applied event
    isPlaying: boolean;
    speed: number;              // playback multiplier
    authEntry: AuthTimelineEntry | null; // most recent auth event at current time
    play: () => void;
    pause: () => void;
    seekToEvent: (index: number) => void;
    setSpeed: (s: number) => void;
}

export const PLAYBACK_SPEEDS = [1, 2, 5, 10, 50] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// Maximum real-time gap to simulate between events (ms). Prevents the
// player from stalling on long thinking pauses.
const MAX_GAP_MS = 1500;

export function usePlaybackEngine(
    events: PlaybackEvent[] | null | undefined,
    authTimeline: AuthTimelineEntry[] | null | undefined
): PlaybackState {
    const engineRef = useRef<PlaybackEngine | null>(null);

    const [text, setText] = useState("");
    const [monacoCursor, setMonacoCursor] = useState({ lineNumber: 1, column: 1 });
    const [eventIndex, setEventIndex] = useState(0);
    const [currentTimestamp, setCurrentTimestamp] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeedState] = useState<number>(1);
    const [authEntry, setAuthEntry] = useState<AuthTimelineEntry | null>(null);

    // Sorted auth timeline for binary search
    const sortedAuth = useRef<AuthTimelineEntry[]>([]);

    useEffect(() => {
        sortedAuth.current = [...(authTimeline ?? [])].sort(
            (a, b) => a.timestamp_ms - b.timestamp_ms
        );
    }, [authTimeline]);

    // Initialise engine when events change
    useEffect(() => {
        if (!events || events.length === 0) return;
        const engine = new PlaybackEngine(events);
        engineRef.current = engine;
        setText("");
        setMonacoCursor({ lineNumber: 1, column: 1 });
        setEventIndex(0);
        setCurrentTimestamp(0);
        setIsPlaying(false);
    }, [events]);

    function getAuthAtTime(ts: number): AuthTimelineEntry | null {
        const arr = sortedAuth.current;
        if (arr.length === 0) return null;
        let lo = 0,
            hi = arr.length - 1,
            best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (arr[mid].timestamp_ms <= ts) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best >= 0 ? arr[best] : null;
    }

    const seekToEvent = useCallback(
        (targetIndex: number) => {
            const engine = engineRef.current;
            if (!engine) return;
            engine.seekTo(targetIndex);
            const ev = engine.getEventAt(targetIndex - 1);
            const ts = ev?.timestamp ?? 0;
            setText(engine.text);
            setMonacoCursor(engine.getMonacoCursor());
            setEventIndex(targetIndex);
            setCurrentTimestamp(ts);
            setAuthEntry(getAuthAtTime(ts));
        },

        []
    );

    const play = useCallback(() => setIsPlaying(true), []);
    const pause = useCallback(() => setIsPlaying(false), []);
    const setSpeed = useCallback((s: number) => setSpeedState(s), []);

    // Playback loop
    useEffect(() => {
        if (!isPlaying) return;
        const engine = engineRef.current;
        if (!engine || !events) return;

        let cancelled = false;
        let idx = eventIndex; // local mutable copy so closure captures latest value
        let timeoutId: ReturnType<typeof setTimeout>;

        function advance() {
            if (cancelled || !engine) return;
            if (idx >= engine.length) {
                setIsPlaying(false);
                return;
            }

            const ev = engine.getEventAt(idx)!;
            engine.applyEvent(ev);
            idx += 1;

            setText(engine.text);
            setMonacoCursor(engine.getMonacoCursor());
            setEventIndex(idx);
            setCurrentTimestamp(ev.timestamp);
            setAuthEntry(getAuthAtTime(ev.timestamp));

            if (idx >= engine.length) {
                setIsPlaying(false);
                return;
            }

            // Wait time = real inter-event gap capped then divided by speed
            const nextEv = engine.getEventAt(idx)!;
            const gap = Math.min(
                Math.max(0, nextEv.timestamp - ev.timestamp),
                MAX_GAP_MS
            );
            timeoutId = setTimeout(advance, gap / speed);
        }

        timeoutId = setTimeout(advance, 0);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, speed]);

    return {
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
    };
}
