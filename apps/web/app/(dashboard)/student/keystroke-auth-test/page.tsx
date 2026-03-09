"use client";

import * as React from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTheme } from "next-themes";
import {
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    Loader2,
    Fingerprint,
    RotateCcw,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EditorPanel } from "@/components/ide";
import { keystrokeApi, type RawKeystrokeEvent, type MonitorResponse } from "@/lib/api/keystroke";
import { useAuthStore } from "@/lib/stores/authStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPTURE_BATCH_SIZE = 30;   // send a batch every N keystrokes
const MONITOR_INTERVAL_MS = 6000; // poll monitor every 6 s
const PYTHON_LANG_ID = 71;

const IGNORED_KEYS = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown", "Insert", "Delete",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
]);

const STARTER_CODE = `# Type here to test keystroke authentication.
# The system will verify your identity as you type.
# Need at least 150 keystrokes to start authentication.

def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}! Welcome to GradeLoop."

students = ["Alice", "Bob", "Charlie"]
for student in students:
    print(greet(student))
`;

// ─── Status helpers ───────────────────────────────────────────────────────────

type AuthStatus = MonitorResponse["status"] | "IDLE";

const STATUS_META: Record<AuthStatus, {
    label: string;
    icon: React.ReactNode;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
}> = {
    IDLE: {
        label: "Not started",
        icon: <Fingerprint className="h-4 w-4" />,
        variant: "secondary",
        color: "text-muted-foreground",
    },
    COLLECTING_DATA: {
        label: "Collecting data…",
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        variant: "outline",
        color: "text-blue-600 dark:text-blue-400",
    },
    AUTHENTICATED: {
        label: "Authenticated",
        icon: <ShieldCheck className="h-4 w-4" />,
        variant: "default",
        color: "text-emerald-600 dark:text-emerald-400",
    },
    SUSPICIOUS: {
        label: "Suspicious",
        icon: <ShieldAlert className="h-4 w-4" />,
        variant: "outline",
        color: "text-amber-600 dark:text-amber-400",
    },
    REJECTED: {
        label: "Not recognised",
        icon: <ShieldX className="h-4 w-4" />,
        variant: "destructive",
        color: "text-red-600 dark:text-red-400",
    },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KeystrokeAuthTestPage() {
    const user = useAuthStore((s) => s.user);
    const { theme: systemTheme } = useTheme();
    const monacoTheme = (systemTheme === "dark" ? "dark" : "light") as "dark" | "light";

    // Session id is stable for this page load
    const sessionId = React.useRef(
        `auth_test_${user?.id ?? "anon"}_${Date.now()}`
    ).current;

    // ── Editor state ──────────────────────────────────────────────────────────
    const [code, setCode] = React.useState(STARTER_CODE);
    const monacoRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

    // ── Keystroke capture ─────────────────────────────────────────────────────
    const pendingEvents = React.useRef<RawKeystrokeEvent[]>([]);
    const keyDownTimes = React.useRef<Map<string, number>>(new Map());
    const lastKeyUpTime = React.useRef<number>(0);
    const totalCaptured = React.useRef(0);
    const [displayCount, setDisplayCount] = React.useState(0);

    // ── Auth state ────────────────────────────────────────────────────────────
    const [status, setStatus] = React.useState<AuthStatus>("IDLE");
    const [lastResult, setLastResult] = React.useState<MonitorResponse | null>(null);
    const [monitorError, setMonitorError] = React.useState<string | null>(null);
    const [isMonitoring, setIsMonitoring] = React.useState(false);
    const monitorTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const userRef = React.useRef(user);
    React.useEffect(() => { userRef.current = user; }, [user]);

    // ── Flush pending events to capture endpoint ──────────────────────────────
    const flushEvents = React.useCallback(async (force = false) => {
        const batch = pendingEvents.current.splice(0); // drain the buffer
        if (batch.length === 0) return;

        if (!force && batch.length < CAPTURE_BATCH_SIZE) {
            // put them back — not enough yet
            pendingEvents.current.unshift(...batch);
            return;
        }

        try {
            await keystrokeApi.capture(batch);
        } catch {
            // best-effort; drop on error so we don't leak memory
        }
    }, []);

    // ── Poll monitor ──────────────────────────────────────────────────────────
    const runMonitor = React.useCallback(async () => {
        const uid = userRef.current?.id;
        if (!uid) return;

        // flush whatever is pending first
        await flushEvents(true);

        try {
            const result = await keystrokeApi.monitor(uid, sessionId);
            setLastResult(result);
            setStatus(result.status);
            setMonitorError(null);
        } catch (err) {
            setMonitorError(err instanceof Error ? err.message : "Monitor request failed");
        }
    }, [sessionId, flushEvents]);

    const startMonitoring = React.useCallback(() => {
        if (monitorTimerRef.current) return; // already running
        setIsMonitoring(true);
        monitorTimerRef.current = setInterval(runMonitor, MONITOR_INTERVAL_MS);
        // Also run immediately
        runMonitor();
    }, [runMonitor]);

    const stopMonitoring = React.useCallback(() => {
        if (monitorTimerRef.current) {
            clearInterval(monitorTimerRef.current);
            monitorTimerRef.current = null;
        }
        setIsMonitoring(false);
    }, []);

    // ── Monaco mount — wire keystroke capture ─────────────────────────────────
    const handleMonacoMount = React.useCallback(
        (editorInstance: MonacoEditor.IStandaloneCodeEditor) => {
            monacoRef.current = editorInstance;

            editorInstance.onKeyDown((e) => {
                const key = e.browserEvent.key;
                if (IGNORED_KEYS.has(key)) return;
                keyDownTimes.current.set(key, performance.now());
            });

            editorInstance.onKeyUp((e) => {
                const key = e.browserEvent.key;
                if (IGNORED_KEYS.has(key) || !userRef.current) return;

                const now = performance.now();
                const pressTime = keyDownTimes.current.get(key);
                if (pressTime === undefined) return;

                const dwellTime = Math.max(0, Math.round(now - pressTime));
                const flightTime =
                    lastKeyUpTime.current === 0
                        ? 0
                        : Math.max(0, Math.round(pressTime - lastKeyUpTime.current));

                lastKeyUpTime.current = now;
                keyDownTimes.current.delete(key);

                pendingEvents.current.push({
                    userId: userRef.current.id,
                    sessionId,
                    timestamp: Date.now(),
                    key,
                    keyCode: e.browserEvent.keyCode,
                    dwellTime,
                    flightTime,
                });

                totalCaptured.current += 1;
                setDisplayCount(totalCaptured.current);

                // Flush every CAPTURE_BATCH_SIZE keystrokes
                if (pendingEvents.current.length >= CAPTURE_BATCH_SIZE) {
                    flushEvents();
                    // Start monitoring after first flush
                    startMonitoring();
                }
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sessionId, flushEvents, startMonitoring]
    );

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = React.useCallback(() => {
        stopMonitoring();
        pendingEvents.current = [];
        keyDownTimes.current.clear();
        lastKeyUpTime.current = 0;
        totalCaptured.current = 0;
        setDisplayCount(0);
        setStatus("IDLE");
        setLastResult(null);
        setMonitorError(null);
        setCode(STARTER_CODE);
        if (monacoRef.current) {
            monacoRef.current.setValue(STARTER_CODE);
            monacoRef.current.setPosition({ lineNumber: 1, column: 1 });
        }
    }, [stopMonitoring]);

    // Cleanup on unmount
    React.useEffect(() => () => stopMonitoring(), [stopMonitoring]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const meta = STATUS_META[status];
    const similarity = lastResult?.average_similarity ?? lastResult?.risk_score !== undefined
        ? 1 - (lastResult?.average_risk_score ?? 0)
        : null;
    const riskScore = lastResult?.average_risk_score ?? null;
    const progressPct = Math.min((displayCount / 150) * 100, 100);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <Fingerprint className="h-6 w-6 text-primary" />
                        Keystroke Authentication Test
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Type in the editor below. The system will identify you from your
                        typing rhythm in real time.
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="flex-shrink-0 gap-1.5"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </Button>
            </div>

            {/* Status card */}
            <Card className={
                status === "AUTHENTICATED"
                    ? "border-emerald-300 dark:border-emerald-800"
                    : status === "REJECTED"
                    ? "border-red-300 dark:border-red-800"
                    : status === "SUSPICIOUS"
                    ? "border-amber-300 dark:border-amber-800"
                    : ""
            }>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Authentication Status</CardTitle>
                        <Badge
                            variant={meta.variant}
                            className={`gap-1.5 ${meta.color}`}
                        >
                            {meta.icon}
                            {meta.label}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Keystroke progress bar */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Keystrokes captured</span>
                            <span className="tabular-nums font-medium">
                                {displayCount}
                                {displayCount < 150 && (
                                    <span className="text-muted-foreground"> / 150 needed</span>
                                )}
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    displayCount >= 150
                                        ? "bg-emerald-500"
                                        : "bg-primary"
                                }`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Scores */}
                    {lastResult && status !== "COLLECTING_DATA" && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Similarity</p>
                                <p className={`text-2xl font-bold tabular-nums ${
                                    (similarity ?? 0) >= 0.7
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : (similarity ?? 0) >= 0.5
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                }`}>
                                    {similarity !== null ? `${(similarity * 100).toFixed(1)}%` : "—"}
                                </p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                                <p className={`text-2xl font-bold tabular-nums ${
                                    (riskScore ?? 0) <= 0.3
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : (riskScore ?? 0) <= 0.6
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                }`}>
                                    {riskScore !== null ? `${(riskScore * 100).toFixed(1)}%` : "—"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Message */}
                    {lastResult?.message && (
                        <p className="text-xs text-muted-foreground italic">{lastResult.message}</p>
                    )}

                    {/* Error */}
                    {monitorError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{monitorError}</p>
                    )}

                    {/* Polling indicator */}
                    {isMonitoring && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking every {MONITOR_INTERVAL_MS / 1000}s…
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info banner */}
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>
                    You must be <strong>fully enrolled</strong> (all 4 phases complete) for authentication
                    to work. Type anything — the system reads your rhythm, not the content.
                </p>
            </div>

            {/* Monaco editor */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Typing Area</CardTitle>
                    <CardDescription className="text-xs">
                        Type here. You can edit or extend the code freely.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 pb-1">
                    <div className="rounded-b-lg overflow-hidden" style={{ height: "380px" }}>
                        <EditorPanel
                            value={code}
                            onChange={setCode}
                            language={PYTHON_LANG_ID}
                            theme={monacoTheme}
                            onEditorMount={handleMonacoMount}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
