"use client";

/**
 * PhaseRecorderDialog
 *
 * The actual keystroke capture UI for each enrollment phase.
 *
 * How it works:
 * 1. Dialog opens with a phase-specific typing task (prompt text or code).
 * 2. Student types in the textarea.
 * 3. keydown/keyup listeners measure:
 *      - dwellTime  = time between keydown and keyup for the same key (ms)
 *      - flightTime = time between previous keyup and this keydown (ms)
 * 4. Once ≥ 150 events collected the "Submit" button activates.
 * 5. On submit, POST /api/keystroke/enroll/phase is called.
 * 6. onSuccess() is called so the parent page refreshes progress.
 */

import * as React from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Fingerprint,
    Clock,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Copy,
} from "lucide-react";
import { useTheme } from "next-themes";
import { EditorPanel } from "@/components/ide";
import { keystrokeApi, type RawKeystrokeEvent } from "@/lib/api/keystroke";
import { useAuthStore } from "@/lib/stores/authStore";
// ─── Phase content ────────────────────────────────────────────────────────────

// Judge0 language IDs: 43 = Plain Text, 62 = Java, 71 = Python 3.8
const PYTHON_LANG_ID = 71;
const JAVA_LANG_ID = 62;
const PLAINTEXT_LANG_ID = 43;

interface PhaseContent {
    title: string;
    instruction: string;
    /** Reference code shown alongside the editor (transcription phase) */
    referenceText?: string;
    /** Judge0 language ID for Monaco syntax highlighting */
    languageId: number;
    /** Starter code pre-filled in the editor */
    starterCode: string;
    /** Time limit in seconds (stress phase only) */
    timeLimitSeconds?: number;
}

const PHASE_CONTENT: Record<string, PhaseContent> = {
    baseline: {
        title: "Baseline — Free Typing",
        instruction:
            "Type naturally in the editor below without rushing. Write anything you like — sentences, thoughts, or a description of what you're doing. " +
            "We need at least 150 keystrokes to build your typing profile.",
        languageId: PLAINTEXT_LANG_ID,
        starterCode: "",
    },
    transcription: {
        title: "Transcription — Copy the Code",
        instruction:
            "Transcribe the Java code shown below into the editor exactly as written. " +
            "Focus on accuracy over speed — copy it character by character including brackets, semicolons and capitalisation. " +
            "This captures your pure typing mechanics without problem-solving.",
        referenceText:
`import java.util.ArrayList;

public class NumberUtils {

    public static boolean isPrime(int n) {
        if (n < 2) return false;
        for (int i = 2; i * i <= n; i++) {
            if (n % i == 0) return false;
        }
        return true;
    }

    public static int sumDigits(int number) {
        int total = 0;
        while (number > 0) {
            total += number % 10;
            number /= 10;
        }
        return total;
    }

    public static void main(String[] args) {
        ArrayList<Integer> primes = new ArrayList<>();
        for (int i = 2; i <= 50; i++) {
            if (isPrime(i)) primes.add(i);
        }
        System.out.println("Primes up to 50: " + primes);
        System.out.println("Sum of 1234 digits: " + sumDigits(1234));
    }
}`,
        languageId: JAVA_LANG_ID,
        starterCode: "",
    },
    stress: {
        title: "Stress — Timed Challenge",
        instruction:
            "You have 2 minutes to implement FizzBuzz. Work quickly — the timer is visible. " +
            "Don't worry if you don't finish; this captures your typing under time pressure.",
        languageId: PYTHON_LANG_ID,
        starterCode:
`def fizzbuzz():
    # Print numbers 1-100.
    # Multiples of 3  -> "Fizz"
    # Multiples of 5  -> "Buzz"
    # Multiples of both -> "FizzBuzz"
    pass
`,
        timeLimitSeconds: 120,
    },
    cognitive: {
        title: "Cognitive Load — Algorithm Implementation",
        instruction:
            "Implement a recursive Fibonacci function with memoisation in Python. " +
            "Read the requirements carefully and plan before you type. There is no time limit.",
        languageId: PYTHON_LANG_ID,
        starterCode:
`# Requirements:
# 1. Use recursion (not a loop)
# 2. Cache computed values (memoisation)
# 3. Handle n from 0 to 100

def fib(n, memo={}):
    # Your implementation here
    pass
`,
    },
};

// ─── Ignored keys ─────────────────────────────────────────────────────────────

const IGNORED_KEYS = new Set([
    "Shift", "Control", "Alt", "Meta", "CapsLock",
    "Tab", "Escape", "F1","F2","F3","F4","F5","F6",
    "F7","F8","F9","F10","F11","F12",
    "Insert","Home","End","PageUp","PageDown",
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "ContextMenu", "ScrollLock", "Pause", "NumLock",
]);

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(totalSeconds: number | undefined, started: boolean) {
    const [remaining, setRemaining] = React.useState(totalSeconds ?? 0);

    React.useEffect(() => {
        // Always reset to full time when not started (handles re-open after expiry)
        if (!started) {
            setRemaining(totalSeconds ?? 0);
            return;
        }
        if (!totalSeconds) return;
        setRemaining(totalSeconds);
        const id = setInterval(() => {
            setRemaining((t) => {
                if (t <= 1) {
                    clearInterval(id);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [totalSeconds, started]);

    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    return { remaining, formatted: `${mm}:${ss}`, expired: remaining === 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PhaseRecorderDialogProps {
    open: boolean;
    phase: string;
    onClose: () => void;
    /** Called after a successful phase submission */
    onSuccess: (phase: string) => void;
}

const MIN_EVENTS = 150;

export function PhaseRecorderDialog({
    open,
    phase,
    onClose,
    onSuccess,
}: PhaseRecorderDialogProps) {
    const user = useAuthStore((s) => s.user);
    const { theme: systemTheme } = useTheme();
    const monacoTheme = systemTheme === "dark" ? "dark" : "light";
    const content = PHASE_CONTENT[phase] ?? PHASE_CONTENT.baseline;

    // ── Editor + typing state ─────────────────────────────────────────────────
    const [code, setCode] = React.useState(content.starterCode);
    const [events, setEvents] = React.useState<RawKeystrokeEvent[]>([]);
    const keyDownTimes = React.useRef<Map<string, number>>(new Map());
    const lastKeyUpTime = React.useRef<number>(0);
    const monacoRef = React.useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    // Stable refs so Monaco listeners don't go stale
    const timerStartedRef = React.useRef(false);
    const userRef = React.useRef(user);
    React.useEffect(() => { userRef.current = user; }, [user]);

    // ── Submission state ──────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [submitted, setSubmitted] = React.useState(false);

    // ── Countdown (stress phase) ──────────────────────────────────────────────
    const [timerStarted, setTimerStarted] = React.useState(false);
    const { remaining, formatted, expired } = useCountdown(
        content.timeLimitSeconds,
        timerStarted
    );

    // Reset everything when the dialog opens for a new phase
    React.useEffect(() => {
        if (open) {
            const starter = (PHASE_CONTENT[phase] ?? PHASE_CONTENT.baseline).starterCode;
            setCode(starter);
            // Also reset Monaco editor content if already mounted
            if (monacoRef.current) {
                monacoRef.current.setValue(starter);
                monacoRef.current.setPosition({ lineNumber: 1, column: 1 });
            }
            setEvents([]);
            keyDownTimes.current.clear();
            lastKeyUpTime.current = 0;
            timerStartedRef.current = false;
            setIsSubmitting(false);
            setSubmitError(null);
            setSubmitted(false);
            setTimerStarted(false);
        }
    }, [open, phase]);

    // ── Monaco mount — wire keystroke capture ─────────────────────────────────
    const handleMonacoMount = React.useCallback(
        (editorInstance: MonacoEditor.IStandaloneCodeEditor) => {
            monacoRef.current = editorInstance;

            editorInstance.onKeyDown((e) => {
                const key = e.browserEvent.key;
                if (IGNORED_KEYS.has(key)) return;
                // Start stress timer on first keystroke
                if (!timerStartedRef.current) {
                    timerStartedRef.current = true;
                    setTimerStarted(true);
                }
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

                const evt: RawKeystrokeEvent = {
                    userId: userRef.current.id,
                    sessionId: `enroll_${phase}_${userRef.current.id}`,
                    timestamp: Date.now(),
                    key,
                    keyCode: e.browserEvent.keyCode,
                    dwellTime,
                    flightTime,
                };
                setEvents((prev) => [...prev, evt]);
            });
        },
        // phase is captured at mount time; timerStartedRef/keyDownTimes/lastKeyUpTime are refs

        [phase]
    );

    // ── Copy reference text ───────────────────────────────────────────────────
    const handleCopyRef = () => {
        if (content.referenceText) {
            navigator.clipboard.writeText(content.referenceText).catch(() => {});
        }
    };

    // ── Retry (stress phase) ─────────────────────────────────────────────────────
    const handleRetry = () => {
        const starter = content.starterCode ?? "";
        setCode(starter);
        monacoRef.current?.setValue(starter);
        monacoRef.current?.setPosition({ lineNumber: 1, column: 1 });
        setEvents([]);
        keyDownTimes.current.clear();
        lastKeyUpTime.current = 0;
        timerStartedRef.current = false;
        setSubmitError(null);
        setTimerStarted(false); // countdown resets via useCountdown effect
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!user || events.length < MIN_EVENTS) return;
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            await keystrokeApi.enrollPhase({
                userId: user.id,
                phase,
                keystrokeEvents: events,
                metadata: { typed_chars: code.length, phase },
            });
            setSubmitted(true);
            setTimeout(() => {
                onSuccess(phase);
                onClose();
            }, 1200);
        } catch (err) {
            setSubmitError(
                err instanceof Error ? err.message : "Failed to submit. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const eventCount = events.length;
    const progressPct = Math.min((eventCount / MIN_EVENTS) * 100, 100);
    const isStress = !!content.timeLimitSeconds;
    // Stress phase: once time expires, accept anything ≥ 30 keystrokes
    const MIN_STRESS_EXPIRED = 30;
    const canSubmit =
        !isSubmitting &&
        !submitted &&
        ((isStress && expired)
            ? eventCount >= MIN_STRESS_EXPIRED
            : eventCount >= MIN_EVENTS);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v && !isSubmitting) onClose(); }}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-black font-serif tracking-tight">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Fingerprint className="h-6 w-6 text-primary" />
                            </div>
                            {content.title}
                        </DialogTitle>
                        {/* Countdown badge — stress phase */}
                        {isStress && timerStarted && (
                            <Badge
                                variant={
                                    remaining <= 20
                                        ? "destructive"
                                        : remaining <= 60
                                        ? "outline"
                                        : "secondary"
                                }
                                className="tabular-nums text-sm px-3 py-1 flex items-center gap-1.5"
                            >
                                <Clock className="h-3.5 w-3.5" />
                                {formatted}
                            </Badge>
                        )}
                        {isStress && !timerStarted && (
                            <Badge variant="secondary" className="text-sm px-3 py-1 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                2:00 — starts on first keystroke
                            </Badge>
                        )}
                    </div>
                    <DialogDescription className="leading-relaxed text-sm">
                        {content.instruction}
                    </DialogDescription>
                </DialogHeader>

                {/* Reference text block */}
                {content.referenceText && (
                    <div className="relative rounded-lg border border-border/60 bg-muted/40">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40">
                            <span className="text-xs font-medium text-muted-foreground">Reference</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs gap-1"
                                onClick={handleCopyRef}
                            >
                                <Copy className="h-3 w-3" /> Copy
                            </Button>
                        </div>
                        <pre className="px-4 py-3 text-xs leading-relaxed overflow-x-auto font-mono text-foreground/90 whitespace-pre">
                            {content.referenceText}
                        </pre>
                    </div>
                )}

                {/* Typing area — Monaco IDE */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Type here
                    </label>
                    <div
                        className="rounded-md overflow-hidden border border-border/60"
                        style={{ height: "260px" }}
                    >
                        <EditorPanel
                            value={code}
                            onChange={setCode}
                            language={content.languageId}
                            theme={monacoTheme as "dark" | "light"}
                            readOnly={
                                isSubmitting ||
                                submitted ||
                                (isStress && expired)
                            }
                            onEditorMount={handleMonacoMount}
                        />
                    </div>
                    {isStress && expired && eventCount < MIN_STRESS_EXPIRED && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/30">
                            <p className="text-xs text-red-700 dark:text-red-400">
                                ⏱ Time&apos;s up — only <strong>{eventCount}</strong> keystrokes captured (need at least {MIN_STRESS_EXPIRED}). Try again.
                            </p>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-3 text-xs flex-shrink-0"
                                onClick={handleRetry}
                            >
                                Retry
                            </Button>
                        </div>
                    )}
                    {isStress && expired && eventCount >= MIN_STRESS_EXPIRED && !submitted && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⏱ Time&apos;s up — {eventCount} keystrokes captured. You can submit now.
                        </p>
                    )}
                </div>

                {/* Progress toward minimum */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Keystrokes captured</span>
                        <span
                            className={
                                eventCount >= MIN_EVENTS
                                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                    : "text-foreground tabular-nums"
                            }
                        >
                            {eventCount} / {MIN_EVENTS}
                        </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden shadow-inner">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500 shadow-[0_0_8px_rgba(38,208,124,0.3)]"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    {eventCount >= MIN_EVENTS && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Enough data collected — you can submit or keep typing for a more accurate profile.
                        </p>
                    )}
                </div>

                {/* Error */}
                {submitError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {submitError}
                    </div>
                )}

                {/* Success */}
                {submitted && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        Phase submitted successfully!
                    </div>
                )}

                <DialogFooter className="gap-2 pt-6 border-t border-border/40">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-full px-6"
                        disabled={isSubmitting || submitted}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="min-w-[140px] rounded-full px-8 shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting…
                            </>
                        ) : submitted ? (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Done
                            </>
                        ) : (
                            `Submit Phase`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
