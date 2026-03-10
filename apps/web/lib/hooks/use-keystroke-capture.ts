"use client";

/**
 * useKeystrokeCapture
 *
 * Attaches to a Monaco editor instance and continuously captures keystroke
 * dynamics for biometric authentication during assignment sessions.
 *
 * Usage:
 *   const { handleEditorMount } = useKeystrokeCapture({ userId, sessionId, assignmentId });
 *   <EditorPanel onEditorMount={handleEditorMount} … />
 */

import { useRef, useCallback, useEffect } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { keystrokeApi, type RawKeystrokeEvent, type MonitorResponse } from "@/lib/api/keystroke";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPTURE_BATCH_SIZE = 30;    // flush to /capture every N keystrokes
const MONITOR_INTERVAL_MS = 6000; // call /monitor every 6 s after first flush

const IGNORED_KEYS = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown",
    "Insert", "Delete",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
]);

// ─── Props / Return ───────────────────────────────────────────────────────────

export interface UseKeystrokeCaptureOptions {
    userId: string;
    sessionId: string;
    assignmentId?: string;
    courseId?: string;
    /** Called after every successful /monitor response */
    onAuthResult?: (result: MonitorResponse) => void;
}

export interface UseKeystrokeCaptureReturn {
    /** Pass to EditorPanel's onEditorMount prop */
    handleEditorMount: (editorInstance: MonacoEditor.IStandaloneCodeEditor) => void;
    /** Latest auth status from the monitor endpoint */
    authStatus: MonitorResponse["status"] | "IDLE";
    /** Total keystrokes captured so far */
    keystrokeCount: number;
    /**
     * Call on assignment submission — flushes remaining events, stops monitoring,
     * archives the full session to PostgreSQL, and cleans up Redis.
     */
    finalizeSession: (finalCode?: string) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKeystrokeCapture({
    userId,
    sessionId,
    assignmentId,
    courseId,
    onAuthResult,
}: UseKeystrokeCaptureOptions): UseKeystrokeCaptureReturn {
    const pendingEvents = useRef<RawKeystrokeEvent[]>([]);
    const keyDownTimes  = useRef<Map<string, number>>(new Map());
    const lastKeyUpTime = useRef<number>(0);
    const totalCaptured = useRef<number>(0);
    const monitorTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep refs to options so callbacks don't go stale
    const userIdRef       = useRef(userId);
    const sessionIdRef    = useRef(sessionId);
    const assignmentIdRef = useRef(assignmentId);
    const courseIdRef     = useRef(courseId);
    const onAuthResultRef = useRef(onAuthResult);

    useEffect(() => { userIdRef.current = userId; },         [userId]);
    useEffect(() => { sessionIdRef.current = sessionId; },   [sessionId]);
    useEffect(() => { assignmentIdRef.current = assignmentId; }, [assignmentId]);
    useEffect(() => { courseIdRef.current = courseId; },     [courseId]);
    useEffect(() => { onAuthResultRef.current = onAuthResult; }, [onAuthResult]);

    // ── Flush pending events to /capture ─────────────────────────────────────
    const flushEvents = useCallback(async (force = false) => {
        const batch = pendingEvents.current.splice(0);
        if (batch.length === 0) return;

        if (!force && batch.length < CAPTURE_BATCH_SIZE) {
            pendingEvents.current.unshift(...batch);
            return;
        }

        try {
            await keystrokeApi.capture(batch);
        } catch {
            // best-effort; drop on error so we don't leak memory
        }
    }, []);

    // ── Run /monitor ──────────────────────────────────────────────────────────
    const runMonitor = useCallback(async () => {
        const uid = userIdRef.current;
        const sid = sessionIdRef.current;
        if (!uid) return;

        await flushEvents(true);

        try {
            const result = await keystrokeApi.monitor(
                uid,
                sid,
                assignmentIdRef.current,
                courseIdRef.current,
            );
            onAuthResultRef.current?.(result);
        } catch {
            // silently ignore monitor errors — best effort
        }
    }, [flushEvents]);

    const startMonitoring = useCallback(() => {
        if (monitorTimer.current) return;
        monitorTimer.current = setInterval(runMonitor, MONITOR_INTERVAL_MS);
        runMonitor(); // run immediately
    }, [runMonitor]);

    const stopMonitoring = useCallback(() => {
        if (monitorTimer.current) {
            clearInterval(monitorTimer.current);
            monitorTimer.current = null;
        }
    }, []);

    // Stop monitoring when component unmounts
    useEffect(() => () => stopMonitoring(), [stopMonitoring]);

    // ── Monaco mount handler ──────────────────────────────────────────────────
    const handleEditorMount = useCallback(
        (editorInstance: MonacoEditor.IStandaloneCodeEditor) => {
            editorInstance.onKeyDown((e) => {
                const key = e.browserEvent.key;
                if (IGNORED_KEYS.has(key)) return;
                keyDownTimes.current.set(key, performance.now());
            });

            editorInstance.onKeyUp((e) => {
                const key = e.browserEvent.key;
                const uid = userIdRef.current;
                const sid = sessionIdRef.current;
                if (IGNORED_KEYS.has(key) || !uid) return;

                const now = performance.now();
                const pressTime = keyDownTimes.current.get(key);
                if (pressTime === undefined) return;

                const dwellTime  = Math.max(0, Math.round(now - pressTime));
                const flightTime = lastKeyUpTime.current === 0
                    ? 0
                    : Math.max(0, Math.round(pressTime - lastKeyUpTime.current));

                lastKeyUpTime.current = now;
                keyDownTimes.current.delete(key);

                pendingEvents.current.push({
                    userId:     uid,
                    sessionId:  sid,
                    timestamp:  Date.now(),
                    key,
                    keyCode:    e.browserEvent.keyCode,
                    dwellTime,
                    flightTime,
                    assignmentId: assignmentIdRef.current,
                    courseId:     courseIdRef.current,
                });

                totalCaptured.current += 1;

                // Flush every CAPTURE_BATCH_SIZE keystrokes
                if (pendingEvents.current.length >= CAPTURE_BATCH_SIZE) {
                    flushEvents();
                    startMonitoring(); // no-op if already running
                }
            });
        },
        [flushEvents, startMonitoring],
    );

    // ── Finalize on submission ────────────────────────────────────────────────
    const finalizeSession = useCallback(async (finalCode?: string) => {
        stopMonitoring();
        // Flush any remaining buffered events first
        await flushEvents(true);

        const uid = userIdRef.current;
        const sid = sessionIdRef.current;
        if (!uid || !sid) return;

        try {
            await keystrokeApi.finalizeSession({
                userId: uid,
                sessionId: sid,
                assignmentId: assignmentIdRef.current,
                courseId: courseIdRef.current,
                finalCode,
            });
        } catch (err) {
            // Non-fatal — submission should still proceed
            console.warn("[keystroke] finalize failed:", err);
        }
    }, [flushEvents, stopMonitoring]);

    return {
        handleEditorMount,
        finalizeSession,
        // These are intentionally not reactive state — update if you need live UI
        authStatus: "IDLE" as const,
        keystrokeCount: 0,
    };
}
