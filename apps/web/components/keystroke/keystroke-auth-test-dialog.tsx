"use client";

/**
 * KeystrokeAuthTestDialog
 *
 * Product-demo dialog: the student types freely in a Monaco editor and
 * the system runs open-set identification ("who is this?") against ALL
 * enrolled users, showing the top matches with similarity scores.
 *
 * Flow:
 *  1. Collect ≥70 keystrokes locally (no Redis needed).
 *  2. After every REANALYZE_EVERY new keystrokes call POST /api/keystroke/identify.
 *  3. Display the ranked candidate list live.
 */

import * as React from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTheme } from "next-themes";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditorPanel } from "@/components/ide";
import {
    Fingerprint,
    Loader2,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    RotateCcw,
    Info,
    Trophy,
    Medal,
} from "lucide-react";
import {
    keystrokeApi,
    type RawKeystrokeEvent,
    type IdentifyMatch,
    type IdentifyResponse,
} from "@/lib/api/keystroke";
import { useAuthStore } from "@/lib/stores/authStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_EVENTS_TO_ANALYZE = 70;
const REANALYZE_EVERY = 20; // re-run identify every N new keystrokes

const IGNORED_KEYS = new Set([
    "Shift","Control","Alt","Meta","CapsLock","Tab","Escape",
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "Home","End","PageUp","PageDown","Insert","Delete",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
]);

const PYTHON_LANG_ID = 71;

const STARTER =
`# Type freely — the system will identify you from your
# typing rhythm, not from what you write.
#
# It will compare your keystrokes against every enrolled
# student and rank the best matches below.

def hello(name):
    return f"Hello, {name}!"
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(similarity: number) {
    if (similarity >= 0.80) return "text-emerald-600 dark:text-emerald-400";
    if (similarity >= 0.60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
}

function confidenceBar(similarity: number) {
    if (similarity >= 0.80) return "bg-emerald-500";
    if (similarity >= 0.60) return "bg-amber-400";
    return "bg-red-400";
}

function RankIcon({ rank }: { rank: number }) {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
    return <span className="h-4 w-4 inline-flex items-center justify-center text-xs font-bold text-muted-foreground">#{rank}</span>;
}

function ConfidenceLabel({ level }: { level?: string }) {
    if (!level) return null;
    const map: Record<string, { label: string; className: string }> = {
        HIGH:   { label: "High confidence",   className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
        MEDIUM: { label: "Medium confidence", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
        LOW:    { label: "Low confidence",    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    };
    const m = map[level];
    if (!m) return null;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.className}`}>
            {level === "HIGH" ? <ShieldCheck className="h-3 w-3" /> : level === "MEDIUM" ? <ShieldAlert className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
            {m.label}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onClose: () => void;
}

export function KeystrokeAuthTestDialog({ open, onClose }: Props) {
    const user = useAuthStore((s) => s.user);
    const { theme: systemTheme } = useTheme();
    const monacoTheme = (systemTheme === "dark" ? "dark" : "light") as "dark" | "light";

    // ── State ─────────────────────────────────────────────────────────────────
    const [code, setCode] = React.useState(STARTER);
    const [eventCount, setEventCount] = React.useState(0);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [result, setResult] = React.useState<IdentifyResponse | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    // ── Refs ─────────────────────────────────────────────────────────────────
    const monacoRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const allEvents = React.useRef<RawKeystrokeEvent[]>([]);
    const keyDownTimes = React.useRef<Map<string, number>>(new Map());
    const lastKeyUpTime = React.useRef<number>(0);
    const userRef = React.useRef(user);
    const sinceLastAnalysis = React.useRef(0);

    React.useEffect(() => { userRef.current = user; }, [user]);

    // Reset when dialog opens
    React.useEffect(() => {
        if (open) {
            allEvents.current = [];
            keyDownTimes.current.clear();
            lastKeyUpTime.current = 0;
            sinceLastAnalysis.current = 0;
            setCode(STARTER);
            setEventCount(0);
            setIsAnalyzing(false);
            setResult(null);
            setError(null);
            monacoRef.current?.setValue(STARTER);
            monacoRef.current?.setPosition({ lineNumber: 1, column: 1 });
        }
    }, [open]);

    // ── Identify call ─────────────────────────────────────────────────────────
    const runIdentify = React.useCallback(async (events: RawKeystrokeEvent[]) => {
        if (events.length < MIN_EVENTS_TO_ANALYZE) return;
        setIsAnalyzing(true);
        setError(null);
        try {
            const res = await keystrokeApi.identify(events, 5);
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    // ── Monaco mount ──────────────────────────────────────────────────────────
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
                const flightTime = lastKeyUpTime.current === 0
                    ? 0
                    : Math.max(0, Math.round(pressTime - lastKeyUpTime.current));

                lastKeyUpTime.current = now;
                keyDownTimes.current.delete(key);

                allEvents.current.push({
                    userId: userRef.current.id,
                    sessionId: `demo_identify_${userRef.current.id}`,
                    timestamp: Date.now(),
                    key,
                    keyCode: e.browserEvent.keyCode,
                    dwellTime,
                    flightTime,
                });

                const total = allEvents.current.length;
                setEventCount(total);
                sinceLastAnalysis.current += 1;

                // Trigger on first threshold crossing, then every REANALYZE_EVERY
                if (
                    total >= MIN_EVENTS_TO_ANALYZE &&
                    sinceLastAnalysis.current >= REANALYZE_EVERY
                ) {
                    sinceLastAnalysis.current = 0;
                    runIdentify([...allEvents.current]);
                }
            });
        },

        [runIdentify]
    );

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleReset = () => {
        allEvents.current = [];
        keyDownTimes.current.clear();
        lastKeyUpTime.current = 0;
        sinceLastAnalysis.current = 0;
        setCode(STARTER);
        setEventCount(0);
        setResult(null);
        setError(null);
        monacoRef.current?.setValue(STARTER);
        monacoRef.current?.setPosition({ lineNumber: 1, column: 1 });
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const progressPct = Math.min((eventCount / MIN_EVENTS_TO_ANALYZE) * 100, 100);
    const ready = eventCount >= MIN_EVENTS_TO_ANALYZE;
    const bestMatch: IdentifyMatch | undefined = result?.best_match ?? result?.matches?.[0];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto gap-0 p-0">
                {/* Header */}
                <DialogHeader className="px-8 pt-8 pb-6 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-black font-serif tracking-tight">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Fingerprint className="h-6 w-6 text-primary" />
                            </div>
                            Identity Test
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="h-8 rounded-full gap-1.5 text-xs font-bold hover:bg-muted"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </Button>
                    </div>
                    <DialogDescription className="text-sm leading-relaxed mt-2">
                        The system analyses your keystroke rhythm and identifies you from our enrolled database — no passwords needed.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Info tip */}
                    <div className="flex items-start gap-3 rounded-2xl border border-info-border bg-info-muted/30 px-4 py-3 text-xs text-info-muted-foreground">
                        <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-info" />
                        <p className="leading-relaxed">
                            Analysis runs automatically after <strong>{MIN_EVENTS_TO_ANALYZE}</strong> keystrokes
                            and refreshes every <strong>{REANALYZE_EVERY}</strong> new keys.
                        </p>
                    </div>

                    {/* Monaco editor */}
                    <div className="rounded-lg overflow-hidden border border-border/60" style={{ height: "220px" }}>
                        <EditorPanel
                            value={code}
                            onChange={setCode}
                            language={PYTHON_LANG_ID}
                            theme={monacoTheme}
                            onEditorMount={handleMonacoMount}
                        />
                    </div>

                    {/* Keystroke counter / progress */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Keystrokes captured</span>
                            <span className={`tabular-nums font-medium ${ready ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                                {eventCount}{!ready && <span className="text-muted-foreground"> / {MIN_EVENTS_TO_ANALYZE} needed</span>}
                            </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden shadow-inner">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-500 shadow-[0_0_8px_rgba(38,208,124,0.3)]"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Results panel */}
                    <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
                            <span className="text-sm font-semibold">Identity Matches</span>
                            <div className="flex items-center gap-2">
                                {isAnalyzing && (
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Analysing…
                                    </span>
                                )}
                                {result && !isAnalyzing && (
                                    <ConfidenceLabel level={result.confidence_level} />
                                )}
                            </div>
                        </div>

                        {/* Before threshold */}
                        {!ready && (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                                <Fingerprint className="h-8 w-8 opacity-30" />
                                <p className="text-sm">Keep typing…</p>
                                <p className="text-xs opacity-70">{MIN_EVENTS_TO_ANALYZE - eventCount} more keystrokes needed</p>
                            </div>
                        )}

                        {/* Loading first result */}
                        {ready && !result && isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                                <p className="text-sm">Running biometric analysis…</p>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
                        )}

                        {/* Match list */}
                        {result && result.matches.length > 0 && (
                            <ul className="divide-y divide-border/50">
                                {result.matches.map((match) => {
                                    const isYou = match.userId === user?.id;
                                    const pct = Math.round(match.similarity * 100);
                                    return (
                                        <li
                                            key={match.userId}
                                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                                match.rank === 1
                                                    ? "bg-primary/5 dark:bg-primary/10"
                                                    : "hover:bg-muted/40"
                                            }`}
                                        >
                                            {/* Rank */}
                                            <div className="flex-shrink-0 w-5 flex justify-center">
                                                <RankIcon rank={match.rank} />
                                            </div>

                                            {/* User id + you badge */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-mono font-medium truncate">
                                                        {match.userId}
                                                    </span>
                                                    {isYou && (
                                                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                                            You
                                                        </Badge>
                                                    )}
                                                </div>
                                                {/* Bar */}
                                                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${confidenceBar(match.similarity)}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <span className={`flex-shrink-0 text-base font-bold tabular-nums ${confidenceColor(match.similarity)}`}>
                                                {pct}%
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {/* No matches */}
                        {result && result.matches.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                                <ShieldX className="h-8 w-8 opacity-30" />
                                <p className="text-sm">{result.message ?? "No enrolled users to match against."}</p>
                            </div>
                        )}
                    </div>

                    {/* Best-match callout */}
                    {bestMatch && !isAnalyzing && (
                        <div className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
                            bestMatch.similarity >= 0.80
                                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10"
                                : bestMatch.similarity >= 0.60
                                ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10"
                                : "border-red-200 bg-red-50/60 dark:border-red-800/40 dark:bg-red-900/10"
                        }`}>
                            {bestMatch.similarity >= 0.80
                                ? <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                : bestMatch.similarity >= 0.60
                                ? <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                : <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                            }
                            <p className="text-sm">
                                Best match:{" "}
                                <strong className="font-mono">{bestMatch.userId}</strong>
                                {bestMatch.userId === user?.id && " (that's you!)"}
                                {" "}— <strong>{Math.round(bestMatch.similarity * 100)}%</strong> similarity
                                {result?.enrolled_users !== undefined && (
                                    <span className="text-muted-foreground">
                                        {" "}from {result.enrolled_users} enrolled student{result.enrolled_users !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
