"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Loader2,
    XCircle,
    AlertTriangle,
    BarChart3,
    Square,
    List,
    Activity,
    BrainCircuit,
    Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ivasApi } from "@/lib/ivas-api";
import { useAuthStore } from "@/lib/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import type {
    ChatMessage,
    QuestionWithContext,
    SessionDetailsOut,
    CompetencySummary,
} from "@/types/ivas";

// ── Audio Queue (module-level singleton to survive React re-renders) ──────────

const audioQueue: string[] = [];
let audioIsPlaying = false;

function playNextInQueue() {
    if (audioQueue.length === 0) {
        audioIsPlaying = false;
        return;
    }
    audioIsPlaying = true;
    const url = audioQueue.shift()!;
    const audio = new window.Audio(url);
    audio.onended = () => {
        URL.revokeObjectURL(url);
        playNextInQueue();
    };
    audio.onerror = () => {
        URL.revokeObjectURL(url);
        playNextInQueue();
    };
    audio.play().catch(() => {
        audioIsPlaying = false;
    });
}

function enqueueBase64Audio(base64Data: string, cancelPrevious = false) {
    if (!base64Data) return;
    if (cancelPrevious) {
        audioQueue.length = 0;
        document.querySelectorAll("audio").forEach((a) => {
            a.pause();
            a.currentTime = 0;
        });
        audioIsPlaying = false;
    }
    try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        audioQueue.push(url);
        if (!audioIsPlaying) playNextInQueue();
    } catch {
        // ignore malformed audio
    }
}

// ── Transcript Panel ──────────────────────────────────────────────────────────

function TranscriptPanel({ messages }: { messages: ChatMessage[] }) {
    return (
        <ScrollArea className="h-[calc(100vh-80px)] p-6 z-50">
            <div className="space-y-6 pb-20">
                {messages.map((msg, i) => (
                    <div key={msg.id || i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                        <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider mb-1.5 ml-1">
                            {msg.role === 'user' ? 'You' : 'IVAS'}
                        </span>
                        <div className={cn(
                            "px-4 py-3 rounded-2xl max-w-[85%] text-[15px] leading-relaxed",
                            msg.role === 'user'
                                ? "bg-emerald-600/20 text-emerald-100 border border-emerald-500/20 rounded-tr-sm"
                                : "bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 rounded-tl-sm"
                        )}>
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

// ── AI Core Orb ──────────────────────────────────────────────────────────────

interface AICoreOrbProps {
    state: "idle" | "ai_speaking" | "user_speaking" | "thinking";
}

function AICoreOrb({ state }: AICoreOrbProps) {
    return (
        <div className="relative flex items-center justify-center">
            {/* Outer Glow */}
            <motion.div
                animate={{
                    scale: state === "user_speaking" ? [1, 1.2, 1] : [1, 1.05, 1],
                    opacity: state === "idle" ? 0.3 : 0.6,
                }}
                transition={{
                    duration: state === "user_speaking" ? 0.8 : 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className={cn(
                    "absolute h-64 w-64 rounded-full blur-[60px]",
                    state === "user_speaking" ? "bg-emerald-500/40" :
                        state === "ai_speaking" ? "bg-teal-500/40" : "bg-emerald-500/20"
                )}
            />

            {/* Pulsing Rings */}
            {[...Array(3)].map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        scale: state === "ai_speaking" ? [1, 1.4 + i * 0.1] : [1, 1.1 + i * 0.05],
                        opacity: state === "ai_speaking" ? [0.5, 0] : [0.2, 0],
                    }}
                    transition={{
                        duration: state === "user_speaking" ? 1 : 2,
                        repeat: Infinity,
                        delay: i * 0.4,
                        ease: "easeOut",
                    }}
                    className="absolute h-48 w-48 rounded-full border border-emerald-500/30"
                />
            ))}

            {/* Core Orb */}
            <motion.div
                animate={{
                    rotate: state === "thinking" ? 360 : 0,
                    scale: state === "user_speaking" ? 1.1 : 1,
                }}
                transition={{
                    rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                    scale: { duration: 0.5 }
                }}
                className={cn(
                    "relative h-40 w-40 rounded-full flex items-center justify-center border-2 overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)]",
                    state === "user_speaking"
                        ? "bg-emerald-500/20 border-emerald-400/50"
                        : "bg-zinc-900 border-zinc-800"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
                <BrainCircuit className={cn(
                    "h-16 w-16 transition-colors duration-500 z-10",
                    state !== "idle" ? "text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "text-zinc-600"
                )} />
            </motion.div>
        </div>
    );
}

// ── Voice Waveform ───────────────────────────────────────────────────────────

function VoiceWaveform({ audioData }: { audioData: number[] }) {
    return (
        <div className="flex items-center gap-1.5 h-12">
            {audioData.map((h, i) => (
                <motion.div
                    key={i}
                    animate={{ height: h }}
                    transition={{ type: 'spring', bounce: 0.1, duration: 0.1 }}
                    className="w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
            ))}
        </div>
    );
}


// ── Main Page ──────────────────────────────────────────────────────────────────

export default function VivaSessionPage() {
    const params = useParams<{ sessionId: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionId = params.sessionId;
    const user = useAuthStore((s) => s.user);

    // assignmentId passed as query param when starting new: ?assignmentId=...
    const assignmentIdFromQuery = searchParams.get("assignmentId");

    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [session, setSession] = React.useState<SessionDetailsOut | null>(null);
    const [currentQuestion, setCurrentQuestion] = React.useState<QuestionWithContext | null>(null);
    const [isComplete, setIsComplete] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [initializing, setInitializing] = React.useState(true);
    const [initError, setInitError] = React.useState<string | null>(null);
    const [abandonConfirm, setAbandonConfirm] = React.useState(false);
    const [abandoning, setAbandoning] = React.useState(false);

    // Audio context for visualization
    const [audioData, setAudioData] = React.useState<number[]>(Array(5).fill(20));

    // Keep reference to the active websocket
    const wsRef = React.useRef<WebSocket | null>(null);
    // Keep a ref to currentQuestion so the WS closure can read the latest value
    const currentQuestionRef = React.useRef<QuestionWithContext | null>(null);
    React.useEffect(() => {
        currentQuestionRef.current = currentQuestion;
    }, [currentQuestion]);

    // Web Speech API hook logic
    const [isRecording, setIsRecording] = React.useState(false);
    const [sessionElapsed, setSessionElapsed] = React.useState(0);
    const [interimTranscript, setInterimTranscript] = React.useState("");
    const recognitionRef = React.useRef<any>(null);
    const sessionTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const visualizerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

    // Session elapsed timer — starts when session loads and we're in_progress
    const startSessionTimer = React.useCallback(() => {
        if (sessionTimerRef.current) return;
        sessionTimerRef.current = setInterval(() => {
            setSessionElapsed((prev) => prev + 1);
        }, 1000);
    }, []);

    // Simulate audio volume for visuals
    React.useEffect(() => {
        if (isRecording || sending) {
            visualizerIntervalRef.current = setInterval(() => {
                setAudioData(Array.from({ length: 5 }, () => Math.random() * 40 + 10));
            }, 100);
        } else {
            if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);
            setAudioData(Array(5).fill(10));
        }
        return () => {
            if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);
        };
    }, [isRecording, sending]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch { /* ignore */ }
            }
        };
    }, []);

    const addMessage = React.useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
        setMessages((prev) => [
            ...prev,
            { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
        ]);
    }, []);

    const hydrateFromTranscript = React.useCallback(
        async (sessionData: SessionDetailsOut) => {
            const transcript = await ivasApi.getTranscript(sessionId);
            const hydrated: ChatMessage[] = [];

            for (const exchange of transcript.exchanges) {
                hydrated.push({
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: exchange.question_text,
                    timestamp: new Date(exchange.asked_at),
                    metadata: {
                        competency: exchange.competency,
                        difficulty: exchange.difficulty,
                        questionType: exchange.question_type,
                    },
                });
                if (exchange.student_answer) {
                    hydrated.push({
                        id: crypto.randomUUID(),
                        role: "user",
                        content: exchange.student_answer,
                        timestamp: exchange.answered_at
                            ? new Date(exchange.answered_at)
                            : new Date(),
                    });
                }
                if (exchange.feedback_text) {
                    hydrated.push({
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: exchange.feedback_text,
                        timestamp: new Date(),
                        metadata: {
                            isFeedback: true,
                            score: exchange.evaluation_score ?? undefined,
                            misconceptions: exchange.detected_misconceptions ?? undefined,
                        },
                    });
                }
            }

            setMessages(hydrated);

            if (sessionData.session.status === "in_progress") {
                const answeredInstIds = new Set(
                    sessionData.responses.map((r) => r.question_instance_id)
                );
                const unanswered = sessionData.questions_asked.find(
                    (q) => !answeredInstIds.has(q.id)
                );
                if (unanswered) {
                    // Try to get the question text from the transcript
                    const matchingExchange = transcript.exchanges.find(
                        (e) => !e.student_answer
                    );
                    const questionText =
                        unanswered.follow_up_question_text ??
                        matchingExchange?.question_text ??
                        "";
                    const q: QuestionWithContext = {
                        question_id: unanswered.question_id,
                        question_instance_id: unanswered.id,
                        question_text: questionText,
                        competency: unanswered.competency,
                        difficulty: unanswered.difficulty,
                        code_context: "",
                        hint: "",
                        is_follow_up: unanswered.follow_up_depth > 0,
                        question_type:
                            unanswered.follow_up_depth > 0 ? "follow_up" : "new",
                    };
                    setCurrentQuestion(q);
                    currentQuestionRef.current = q;
                }
            }
        },
        [sessionId]
    );

    // Initialize session
    React.useEffect(() => {
        if (!user?.id) return;
        let mounted = true;

        async function init() {
            try {
                setInitializing(true);

                if (sessionId === "new" && assignmentIdFromQuery) {
                    const result = await ivasApi.triggerAssessment({
                        student_id: user!.id,
                        assignment_id: assignmentIdFromQuery,
                    });
                    if (!mounted) return;
                    router.replace(`/student/assessments/viva/${result.session_id}`);
                    return;
                }

                const sessionData = await ivasApi.getSession(sessionId);
                if (!mounted) return;
                setSession(sessionData);

                if (sessionData.session.status === "completed") {
                    setIsComplete(true);
                    await hydrateFromTranscript(sessionData);
                } else if (sessionData.session.status === "abandoned") {
                    setIsComplete(true);
                    await hydrateFromTranscript(sessionData);
                } else {
                    // in_progress — hydrate existing exchanges, then start timer
                    if (sessionData.questions_asked.length > 0) {
                        await hydrateFromTranscript(sessionData);
                    }
                    startSessionTimer();
                }
            } catch (err) {
                if (mounted) {
                    setInitError(
                        err instanceof Error ? err.message : "Failed to load session."
                    );
                }
            } finally {
                if (mounted) setInitializing(false);
            }
        }

        init();
        return () => {
            mounted = false;
        };
    }, [sessionId, assignmentIdFromQuery, user?.id, router, hydrateFromTranscript, startSessionTimer]);

    // --- Voice WebSocket Connection ---
    React.useEffect(() => {
        if (!user?.id || !sessionId || sessionId === "new" || isComplete || initializing) return;

        const baseUrl = process.env.NEXT_PUBLIC_IVAS_API_URL || "https://ivas.sudila.com";
        const wsBaseUrl = baseUrl.replace(/^https?/, (m) =>
            m === "https" ? "wss" : "ws"
        );
        const wsUrl = `${wsBaseUrl}/api/v1/assessments/sessions/${encodeURIComponent(sessionId)}/voice`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            const q = currentQuestionRef.current;
            if (q?.question_instance_id) {
                ws.send(
                    JSON.stringify({
                        type: "start_session",
                        question_instance_id: q.question_instance_id,
                        question_text: q.question_text,
                    })
                );
                // Play the current question for the student to hear
                // Backend may send audio via next_question / instructor_response on start_session
                // but if not, we keep the on-screen text which the student can read
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);

                if (msg.type === "instructor_response") {
                    addMessage({ role: "system", content: "Instructor: " + msg.message });
                    if (msg.audio_b64) enqueueBase64Audio(msg.audio_b64, true);
                    setSending(false);
                } else if (msg.type === "evaluation") {
                    addMessage({
                        role: "assistant",
                        content: msg.feedback || "Evaluation complete",
                        metadata: {
                            isFeedback: true,
                            score: msg.score ?? undefined,
                            misconceptions: msg.misconceptions ?? undefined,
                        },
                    });
                    if (msg.audio_b64) enqueueBase64Audio(msg.audio_b64, true);
                    // Don't clear sending here — waitf for next_question or session_complete
                } else if (msg.type === "next_question") {
                    const q: QuestionWithContext = {
                        question_id: msg.question_id ?? "",
                        question_instance_id: msg.question_instance_id,
                        question_text: msg.question_text,
                        competency: msg.competency ?? "",
                        difficulty: msg.difficulty ?? 1,
                        code_context: msg.code_context ?? "",
                        hint: msg.hint ?? "",
                        is_follow_up: !!msg.is_follow_up,
                        question_type: msg.is_follow_up ? "follow_up" : "new",
                    };
                    setCurrentQuestion(q);
                    currentQuestionRef.current = q;
                    addMessage({
                        role: "assistant",
                        content: msg.question_text,
                        metadata: {
                            questionType: msg.is_follow_up ? "follow_up" : "new",
                        },
                    });
                    if (msg.audio_b64) enqueueBase64Audio(msg.audio_b64);
                    setSending(false);
                } else if (msg.type === "session_complete") {
                    setIsComplete(true);
                    if (sessionTimerRef.current) {
                        clearInterval(sessionTimerRef.current);
                        sessionTimerRef.current = null;
                    }
                    if (msg.message) addMessage({ role: "system", content: msg.message });
                    if (msg.audio_b64) enqueueBase64Audio(msg.audio_b64, true);
                    setCurrentQuestion(null);
                    currentQuestionRef.current = null;
                    setSending(false);
                } else if (msg.type === "error") {
                    addMessage({ role: "system", content: `Error: ${msg.message}` });
                    setSending(false);
                }

                // Fallback audio fields
                if (msg.audio) enqueueBase64Audio(msg.audio);
                else if (msg.audioContent) enqueueBase64Audio(msg.audioContent);
            } catch {
                // Raw base64 audio fallback
                if (typeof event.data === "string" && event.data.length > 20) {
                    enqueueBase64Audio(event.data);
                }
            }
        };

        ws.onerror = (err) => {
            console.error("Voice WebSocket error", err);
        };

        ws.onclose = () => {
            if (wsRef.current === ws) wsRef.current = null;
        };

        return () => {
            ws.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, isComplete, initializing, user?.id]);

    const handleSubmit = React.useCallback(
        (transcribedText: string) => {
            const q = currentQuestionRef.current;
            if (!transcribedText.trim() || !q || sending || isComplete) return;

            setSending(true);
            addMessage({ role: "user", content: transcribedText });

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "message",
                        question_instance_id: q.question_instance_id,
                        text: transcribedText,
                    })
                );
            } else {
                addMessage({
                    role: "system",
                    content: "Error: Connection is lost. Please refresh the page.",
                });
                setSending(false);
            }
        },
        [sending, isComplete, addMessage]
    );

    const startRecording = React.useCallback(() => {
        // Stop any ongoing TTS audio before capturing mic
        audioQueue.length = 0;
        audioIsPlaying = false;
        document.querySelectorAll("audio").forEach((a) => {
            a.pause();
            a.currentTime = 0;
        });

        const SR =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SR) {
            addMessage({
                role: "system",
                content:
                    "Error: Your browser does not support the Web Speech API. Please use Chrome or Edge.",
            });
            return;
        }

        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let finalTranscript = "";

        recognition.onstart = () => {
            setIsRecording(true);
            finalTranscript = "";
            setInterimTranscript("");
        };

        recognition.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setInterimTranscript(interim || finalTranscript);
        };

        recognition.onerror = (event: any) => {
            if (event.error !== "aborted" && event.error !== "no-speech") {
                addMessage({
                    role: "system",
                    content: `Speech recognition error: ${event.error}`,
                });
            }
            // Don't submit on error — let onend handle it
            recognitionRef.current = null;
            setIsRecording(false);
            setInterimTranscript("");
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            setIsRecording(false);
            setInterimTranscript("");
            if (finalTranscript.trim()) {
                handleSubmit(finalTranscript.trim());
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            console.error("Could not start recognition:", e);
        }
    }, [addMessage, handleSubmit]);

    const stopRecording = React.useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop(); // triggers onend → handleSubmit
            } catch {
                /* ignore */
            }
        }
    }, []);

    const handleAbandon = async () => {
        try {
            setAbandoning(true);
            await ivasApi.abandonSession(sessionId);
            setIsComplete(true);
            addMessage({ role: "system", content: "Session abandoned." });
            setAbandonConfirm(false);
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
        } catch {
            setAbandonConfirm(false);
        } finally {
            setAbandoning(false);
        }
    };

    if (initError) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                <div className="max-w-md w-full bg-red-950/90 border border-red-900/50 p-6 rounded-2xl shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-3 text-red-400 mb-2">
                        <AlertTriangle className="h-6 w-6" />
                        <h3 className="text-xl font-bold">Session Error</h3>
                    </div>
                    <p className="text-red-200/80 mb-6">{initError}</p>
                    <Button asChild className="w-full bg-red-600 hover:bg-red-500 text-white border-0">
                        <Link href="/student/assessments/dashboard">Return to Dashboard</Link>
                    </Button>
                </div>
            </div>
        );
    }

    if (initializing) {
        return (
            <div className="flex flex-col gap-4 h-[calc(100vh-160px)]">
                <Skeleton className="h-14 w-full rounded-xl" />
                <div className="flex-1 space-y-4 p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className={cn(
                                "h-16 rounded-2xl",
                                i % 2 === 1 ? "ml-auto w-2/3" : "w-3/4"
                            )}
                        />
                    ))}
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>
        );
    }

    const questionIndex = session
        ? session.answered_questions + 1
        : messages.filter((m) => m.role === "assistant" && !m.metadata?.isFeedback).length;

    const orbState = isComplete
        ? "idle"
        : sending
            ? "thinking"
            : isRecording
                ? "user_speaking"
                : "ai_speaking";

    return (
        <div className="fixed inset-0 z-40 flex flex-col w-full h-full bg-black text-emerald-50 overflow-hidden font-sans selection:bg-emerald-500/30">
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black">
                <motion.div
                    animate={{
                        opacity: sending ? 0.4 : 0.2,
                        scale: sending ? 1.15 : 1,
                        backgroundColor: sending
                            ? "rgba(20, 184, 166, 0.25)"
                            : "rgba(16, 185, 129, 0.15)",
                    }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                    className="absolute -top-[10%] -left-[10%] w-[80vw] h-[80vw] rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        opacity: isRecording ? 0.5 : 0.2,
                        scale: isRecording ? 1.25 : 1,
                        backgroundColor: isRecording
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(20, 184, 166, 0.15)",
                    }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                    className="absolute -bottom-[10%] -right-[10%] w-[70vw] h-[70vw] rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{ x: [0, 40, -40, 0], y: [0, -30, 30, 0] }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 opacity-20"
                >
                    <div className="absolute top-[25%] left-[35%] w-48 h-48 rounded-full bg-emerald-500/20 blur-[80px]" />
                    <div className="absolute bottom-[35%] right-[25%] w-64 h-64 rounded-full bg-teal-500/20 blur-[100px]" />
                </motion.div>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
            </div>

            {/* Header */}
            <header className="relative z-[100] flex items-center justify-between px-6 py-5 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                        <span className="text-sm font-semibold tracking-wider text-emerald-400/90 uppercase">
                            IVAS Session
                        </span>
                    </div>
                    {session && !isComplete && (
                        <div className="flex items-center gap-3 ml-4 bg-zinc-900/30 px-3 py-1 rounded-full border border-zinc-800/50">
                            <span className="text-xs font-medium text-zinc-400">
                                Q{questionIndex} / {session.total_questions}
                            </span>
                            <div className="h-3 w-[1px] bg-zinc-800" />
                            <span className="text-xs font-mono text-zinc-500">
                                {Math.floor(sessionElapsed / 60)}:
                                {(sessionElapsed % 60).toString().padStart(2, "0")}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white backdrop-blur-md rounded-full px-4 transition-all z-20"
                            >
                                <List className="h-4 w-4 mr-2" /> History
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="bg-zinc-950/95 border-zinc-800 text-zinc-100 p-0 sm:max-w-md w-[85vw] backdrop-blur-xl z-[200]">
                            <SheetHeader className="p-6 border-b border-zinc-800/60 bg-zinc-900/20">
                                <SheetTitle className="text-zinc-100 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-emerald-500" />
                                    Session History
                                </SheetTitle>
                            </SheetHeader>
                            <TranscriptPanel messages={messages} />
                        </SheetContent>
                    </Sheet>

                    {!isComplete ? (
                        <div className="flex gap-2 z-20">
                            {abandonConfirm ? (
                                <div className="flex items-center bg-red-950/40 border border-red-900/50 rounded-full pl-3 pr-1 py-1 backdrop-blur-md">
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-3 text-xs rounded-full bg-red-600/80 hover:bg-red-600"
                                        onClick={handleAbandon}
                                        disabled={abandoning}
                                    >
                                        {abandoning ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            "Confirm End"
                                        )}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-red-300 hover:text-red-100 hover:bg-white/10 rounded-full"
                                        onClick={() => setAbandonConfirm(false)}
                                    >
                                        <XCircle className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                    onClick={() => setAbandonConfirm(true)}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Button
                            asChild
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                            <Link href={`/student/assessments/results/${sessionId}`}>
                                <BarChart3 className="h-4 w-4 mr-2" /> Results
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            {/* Center Stage */}
            <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 w-full max-w-5xl mx-auto h-full overflow-y-auto pt-10 pb-40">
                <AICoreOrb state={orbState} />

                <div className="mt-16 w-full text-center space-y-8 select-none">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentQuestion?.question_instance_id ?? "done"}
                            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                            className="max-w-3xl mx-auto"
                        >
                            {isComplete ? (
                                <div className="space-y-6">
                                    <h2 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-400 tracking-tight">
                                        Session Complete
                                    </h2>
                                    <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
                                        You have successfully finished the viva assessment. View your
                                        detailed feedback in the results page.
                                    </p>
                                </div>
                            ) : (
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium text-zinc-100 leading-tight tracking-tight">
                                    {currentQuestion?.question_text ??
                                        "Preparing your first question…"}
                                </h2>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Voice Feedback Layer */}
                    <div className="min-h-[100px] flex flex-col items-center justify-center">
                        <AnimatePresence>
                            {isRecording && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="max-w-2xl px-4"
                                >
                                    <p className="text-lg sm:text-xl text-emerald-400/70 font-medium leading-normal italic text-center">
                                        {interimTranscript || "Listening…"}
                                    </p>
                                    <div className="mt-4 flex justify-center">
                                        <VoiceWaveform audioData={audioData} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!isRecording && sending && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ opacity: [0.2, 1, 0.2] }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                delay: i * 0.2,
                                            }}
                                            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
                                    Processing Response
                                </span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </main>

            {/* Voice Controls (Bottom Dock) */}
            <div className="fixed bottom-0 left-0 right-0 z-[100] pb-12 pt-10 pointer-events-none">
                <div className="max-w-md mx-auto flex flex-col items-center gap-4 pointer-events-auto">
                    {!isComplete && (
                        <div className="relative">
                            {isRecording && (
                                <motion.div
                                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeOut",
                                    }}
                                    className="absolute inset-0 rounded-full bg-emerald-500/30 -z-10"
                                />
                            )}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                    isRecording ? stopRecording() : startRecording()
                                }
                                disabled={sending}
                                className={cn(
                                    "flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]",
                                    isRecording
                                        ? "bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.4)]"
                                        : sending
                                            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                            : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                                )}
                            >
                                {sending ? (
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                ) : isRecording ? (
                                    <Square className="h-8 w-8 fill-current" />
                                ) : (
                                    <Mic className="h-9 w-9" />
                                )}
                            </motion.button>
                        </div>
                    )}

                    <AnimatePresence>
                        {!isComplete && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500"
                            >
                                {isRecording
                                    ? "Active Capture — tap to submit"
                                    : sending
                                        ? "Synchronizing"
                                        : "Tap to speak"}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
