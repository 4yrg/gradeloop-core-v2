"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Mic,
    MicOff,
    PhoneOff,
    Loader2,
    AlertCircle,
    Wifi,
    ShieldAlert,
    ShieldCheck,
    VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ivasApi } from "@/lib/ivas-api";
import type { VivaSession, WsMessageIncoming, ChatMessage } from "@/types/ivas";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";
type AiState = "idle" | "speaking" | "listening";

const PING_INTERVAL_MS = 25_000;

export default function VivaSessionPage() {
    const params = useParams<{ sessionId: string }>();
    const router = useRouter();
    const { addToast } = useToast();
    const sessionId = params.sessionId;

    // Session state
    const [session, setSession] = React.useState<VivaSession | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // WebSocket & audio state
    const [connectionState, setConnectionState] = React.useState<ConnectionState>("disconnected");
    const [aiState, setAiState] = React.useState<AiState>("idle");
    const [isRecording, setIsRecording] = React.useState(false);
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [sessionEnded, setSessionEnded] = React.useState(false);
    const sessionEndedRef = React.useRef(false);
    const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
    const reconnectAttemptsRef = React.useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 3;
    const [showEndConfirm, setShowEndConfirm] = React.useState(false);
    const [audioSuspended, setAudioSuspended] = React.useState(false);

    // Voice verification state
    const [voiceStatus, setVoiceStatus] = React.useState<"unverified" | "match" | "uncertain" | "mismatch">("unverified");
    const [voiceSimilarity, setVoiceSimilarity] = React.useState<number | null>(null);
    const voiceWarningTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs
    const wsRef = React.useRef<WebSocket | null>(null);
    const playbackCtxRef = React.useRef<AudioContext | null>(null);
    const micCtxRef = React.useRef<AudioContext | null>(null);
    const playingSourcesRef = React.useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextPlayStartRef = React.useRef(0);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const transcriptEndRef = React.useRef<HTMLDivElement>(null);
    const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    // Load session info
    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const s = await ivasApi.getSession(sessionId);
                if (mounted) {
                    setSession(s);
                    if (s.status === "completed" || s.status === "abandoned" || s.status === "grading" || s.status === "grading_failed") {
                        sessionEndedRef.current = true;
                        setSessionEnded(true);
                    }
                }
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load session");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [sessionId]);

    // Poll session status while grading is in progress
    React.useEffect(() => {
        if (!sessionEnded) return;
        if (session?.status === "completed" || session?.status === "abandoned" || session?.status === "grading_failed") return;

        const pollInterval = setInterval(async () => {
            try {
                const s = await ivasApi.getSession(sessionId);
                setSession(s);
                if (s.status === "completed" || s.status === "abandoned" || s.status === "grading_failed") {
                    clearInterval(pollInterval);
                }
            } catch { /* retry on next interval */ }
        }, 3000);
        return () => clearInterval(pollInterval);
    }, [sessionEnded, session?.status, sessionId]);

    // Scroll transcript to bottom on update
    React.useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Append or extend the last streaming message for a role.
    const appendTranscript = React.useCallback(
        (role: "user" | "assistant", chunk: string, finished: boolean) => {
            setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === role && last.streaming) {
                    next[next.length - 1] = {
                        ...last,
                        content: last.content + chunk,
                        streaming: !finished,
                    };
                } else {
                    if (last && last.streaming) {
                        next[next.length - 1] = { ...last, streaming: false };
                    }
                    next.push({
                        id: crypto.randomUUID(),
                        role,
                        content: chunk,
                        timestamp: new Date(),
                        streaming: !finished,
                    });
                }
                return next;
            });
        },
        [],
    );

    // --- Audio Playback ---
    const playAudioChunk = React.useCallback((base64Data: string) => {
        try {
            const ctx = playbackCtxRef.current;
            if (!ctx || ctx.state !== "running") return;

            const raw = atob(base64Data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
            }

            const buffer = ctx.createBuffer(1, float32.length, 24000);
            buffer.getChannelData(0).set(float32);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            const startAt = Math.max(ctx.currentTime, nextPlayStartRef.current);
            source.start(startAt);
            nextPlayStartRef.current = startAt + buffer.duration;

            playingSourcesRef.current.add(source);
            source.onended = () => playingSourcesRef.current.delete(source);
        } catch (err) {
            console.error("Audio playback error:", err);
        }
    }, []);

    const stopAllPlayback = React.useCallback(() => {
        for (const src of playingSourcesRef.current) {
            try { src.stop(); } catch { /* already stopped */ }
        }
        playingSourcesRef.current.clear();
        nextPlayStartRef.current = 0;
    }, []);

    // --- Resume suspended AudioContext ---
    const resumeAudioContext = React.useCallback(() => {
        const ctx = playbackCtxRef.current;
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
    }, []);

    // --- Microphone Recording ---
    const startRecording = React.useCallback(async () => {
        try {
            // Clean up any existing processor/stream from a previous session or
            // reconnect — prevents duplicate mic streams fighting for hardware.
            if (processorRef.current) {
                processorRef.current.disconnect();
                processorRef.current = null;
            }
            // If we have a pre-granted stream from connectWebSocket, reuse it.
            // Otherwise request a fresh one.
            let stream = mediaStreamRef.current;
            if (!stream || !stream.active) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
                });
                mediaStreamRef.current = stream;
            }

            // Close any stale mic AudioContext before creating a fresh one.
            if (micCtxRef.current) {
                try { micCtxRef.current.close(); } catch { /* ignore */ }
                micCtxRef.current = null;
            }

            micCtxRef.current = new AudioContext({ sampleRate: 16000 });
            const ctx = micCtxRef.current;
            if (ctx.state === "suspended") await ctx.resume();

            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                const bytes = new Uint8Array(pcm16.buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);

                wsRef.current.send(JSON.stringify({ type: "audio", data: base64 }));
            };

            source.connect(processor);
            processor.connect(ctx.destination);

            setIsRecording(true);
            setAiState("listening");
        } catch {
            addToast({
                title: "Microphone access denied",
                variant: "error",
                description: "Please allow microphone access to participate in the viva.",
            });
        }
    }, [addToast]);

    const stopRecording = React.useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        // Close the mic AudioContext to free the OS audio device.
        if (micCtxRef.current) {
            micCtxRef.current.close().catch(() => {});
            micCtxRef.current = null;
        }
        setIsRecording(false);
        setAiState("idle");
    }, []);

    // --- WebSocket Connection ---
    const connectWebSocket = React.useCallback(() => {
        if (sessionEndedRef.current) return;

        // CRITICAL: create and resume the playback AudioContext *here*, while
        // we're still inside a user-gesture event handler (the Connect button
        // click). If we create it later inside ws.onmessage, Chrome's autoplay
        // policy leaves it suspended and ctx.resume() becomes a no-op — which
        // is exactly what caused the initial greeting to be silent and then
        // blast out in parallel with a later response when the mic button
        // finally resumed the context.
        if (!playbackCtxRef.current) {
            try {
                playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
            } catch (err) {
                console.error("Failed to create playback AudioContext:", err);
            }
        }
        if (playbackCtxRef.current && playbackCtxRef.current.state === "suspended") {
            playbackCtxRef.current.resume().catch(() => {});
        }
        // Monitor AudioContext state — detect when Chrome suspends it (tab
        // switch, OS focus change) so we can prompt the student to resume.
        if (playbackCtxRef.current) {
            playbackCtxRef.current.onstatechange = () => {
                if (playbackCtxRef.current?.state === "suspended") {
                    setAudioSuspended(true);
                } else if (playbackCtxRef.current?.state === "running") {
                    setAudioSuspended(false);
                }
            };
        }
        nextPlayStartRef.current = 0;

        // Pre-request mic access while we're still inside the user-gesture
        // (Connect button click). This guarantees Chrome's autoplay policy
        // allows getUserMedia. The stream is stored but not wired to the
        // processor until session_started arrives and startRecording() runs.
        if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
            navigator.mediaDevices
                .getUserMedia({
                    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
                })
                .then((stream) => {
                    mediaStreamRef.current = stream;
                })
                .catch(() => {});
        }

        // Tear down any previous socket before opening a new one so we can't
        // have two live connections streaming audio in parallel. Critically,
        // detach the handlers first — otherwise the old socket's onclose
        // fires and schedules *another* reconnect on top of the one we want,
        // multiplying sockets exponentially.
        if (wsRef.current) {
            const old = wsRef.current;
            wsRef.current = null;
            old.onopen = null;
            old.onmessage = null;
            old.onerror = null;
            old.onclose = null;
            try { old.close(); } catch { /* ignore */ }
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        // Clear any existing ping interval
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }

        const url = ivasApi.getVivaWebSocketUrl(sessionId);
        setConnectionState("connecting");

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionState("connected");
            // Start sending periodic pings to keep the connection alive through
            // reverse proxies and load balancers with idle timeouts (typically
            // 30-60s). The student may pause to think during a viva, so without
            // pings the WS would be silently dropped.
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = setInterval(() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "ping" }));
                }
            }, PING_INTERVAL_MS);
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessageIncoming = JSON.parse(event.data);

                switch (msg.type) {
                    case "viva_loading":
                        // Backend is preparing the assessment (selecting questions
                        // etc.) — we stay in "connecting" state and show the
                        // loading hint.
                        break;

                    case "session_started":
                        reconnectAttemptsRef.current = 0;
                        setReconnectAttempts(0);
                        setAiState("idle");
                        nextPlayStartRef.current = 0;
                        setVoiceStatus("unverified");
                        setVoiceSimilarity(null);
                        startRecording();
                        break;

                    case "audio":
                        setAiState("speaking");
                        if (msg.data) {
                            playAudioChunk(msg.data);
                        }
                        break;

                    case "user_transcript":
                        if (msg.data) {
                            appendTranscript("user", msg.data, !!msg.finished);
                        }
                        break;

                    case "ai_transcript":
                        if (msg.data) {
                            appendTranscript("assistant", msg.data, !!msg.finished);
                        }
                        break;

                    case "text":
                        if (msg.data) {
                            appendTranscript("assistant", msg.data, true);
                        }
                        break;

                    case "turn_complete":
                        setAiState("idle");
                        setMessages((prev) => {
                            if (prev.length === 0) return prev;
                            const last = prev[prev.length - 1];
                            if (!last.streaming) return prev;
                            const next = [...prev];
                            next[next.length - 1] = { ...last, streaming: false };
                            return next;
                        });
                        break;

                    case "session_ended":
                        stopRecording();
                        stopAllPlayback();
                        if (pingIntervalRef.current) {
                            clearInterval(pingIntervalRef.current);
                            pingIntervalRef.current = null;
                        }
                        sessionEndedRef.current = true;
                        setSessionEnded(true);
                        setConnectionState("disconnected");
                        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
                        setReconnectAttempts(MAX_RECONNECT_ATTEMPTS);
                        ivasApi.getSession(sessionId).then(setSession).catch(() => {});
                        break;

                    case "error":
                        if (msg.data === "Session already ended.") {
                            sessionEndedRef.current = true;
                            setSessionEnded(true);
                            setConnectionState("disconnected");
                            reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
                            setReconnectAttempts(MAX_RECONNECT_ATTEMPTS);
                            ivasApi.getSession(sessionId).then(setSession).catch(() => {});
                        } else {
                            setConnectionState("error");
                        }
                        addToast({
                            title: msg.data === "Session already ended." ? "Session ended" : "Viva error",
                            variant: "error",
                            description: msg.data || "Unknown error",
                        });
                        break;

                    case "voice_warning":
                        setVoiceStatus("mismatch");
                        setVoiceSimilarity(msg.similarity ?? 0);
                        break;

                    case "voice_status":
                        if (msg.is_match) {
                            setVoiceStatus("match");
                        } else {
                            setVoiceStatus("uncertain");
                        }
                        setVoiceSimilarity(msg.similarity ?? null);
                        break;

                    case "pong":
                        break;
                }
            } catch (err) {
                console.error("WS message parse error:", err);
            }
        };

        ws.onclose = () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            if (sessionEndedRef.current) return;

            const attempts = reconnectAttemptsRef.current;
            if (attempts < MAX_RECONNECT_ATTEMPTS) {
                setConnectionState("disconnected");
                const delay = Math.min(1000 * Math.pow(2, attempts), 5000);
                reconnectTimeoutRef.current = setTimeout(() => {
                    reconnectAttemptsRef.current += 1;
                    setReconnectAttempts(reconnectAttemptsRef.current);
                    connectWebSocket();
                }, delay);
            } else {
                setConnectionState("error");
                addToast({
                    title: "Connection lost",
                    variant: "error",
                    description: "Unable to reconnect. Please refresh the page.",
                });
            }
        };

        ws.onerror = () => {
            setConnectionState("error");
        };
    }, [sessionId, playAudioChunk, appendTranscript, addToast, startRecording, stopRecording, stopAllPlayback]);

    // --- End Viva ---
    const endViva = React.useCallback(() => {
        setShowEndConfirm(true);
    }, []);

    const confirmEndViva = React.useCallback(() => {
        setShowEndConfirm(false);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            stopRecording();
            wsRef.current.send(JSON.stringify({ type: "end_session" }));
        }
    }, [stopRecording]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (processorRef.current) processorRef.current.disconnect();
            if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (voiceWarningTimeoutRef.current) clearTimeout(voiceWarningTimeoutRef.current);
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            for (const src of playingSourcesRef.current) {
                try { src.stop(); } catch { /* already stopped */ }
            }
            playingSourcesRef.current.clear();
            if (playbackCtxRef.current) {
                playbackCtxRef.current.close().catch(() => {});
                playbackCtxRef.current = null;
            }
            if (micCtxRef.current) {
                micCtxRef.current.close().catch(() => {});
                micCtxRef.current = null;
            }
        };
    }, []);

    // --- Render ---
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            Session Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error || "Session not found."}</p>
                        <Button className="mt-4" onClick={() => router.push("/student/assessments/my-sessions")}>
                            Back to Sessions
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (sessionEnded) {
        const isGrading = session?.status === "grading";
        const isGradingFailed = session?.status === "grading_failed";
        const isAbandoned = session?.status === "abandoned";
        const isCompleted = session?.status === "completed";
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md text-center">
                    <CardHeader>
                        <CardTitle>
                            {isGradingFailed ? "Grading Failed" : isAbandoned ? "Viva Ended" : "Viva Complete"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isGrading ? (
                            <>
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" />
                                <p className="text-sm text-muted-foreground">
                                    Your answers are being evaluated. This may take a minute.
                                </p>
                            </>
                        ) : isGradingFailed ? (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                An error occurred while grading your viva. Please contact your instructor.
                            </p>
                        ) : isAbandoned ? (
                            <p className="text-sm text-muted-foreground">
                                This viva session ended without completing the assessment.
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Your oral examination has ended.
                            </p>
                        )}
                        {isCompleted && session?.total_score !== null && (
                            <p className="text-2xl font-black">
                                {session?.total_score} / {session?.max_possible}
                            </p>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => router.push("/student/assessments/my-sessions")}>
                                My Sessions
                            </Button>
                            {isCompleted && (
                                <Button onClick={() => router.push(`/student/assessments/results/${sessionId}`)}>
                                    View Results
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const statusLabel =
        connectionState !== "connected"
            ? connectionState === "connecting"
                ? "Connecting…"
                : connectionState === "error"
                    ? "Connection error"
                    : "Not connected"
            : aiState === "speaking"
                ? "Examiner is speaking"
                : aiState === "listening"
                    ? "Listening…"
                    : "Ready";

    return (
        <>
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto" onClick={resumeAudioContext}>
            {/* Top bar */}
            <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div
                            className={`h-2 w-2 rounded-full ${
                                connectionState === "connected"
                                    ? "bg-emerald-500"
                                    : connectionState === "connecting"
                                        ? "bg-amber-500 animate-pulse"
                                        : "bg-red-500"
                            }`}
                        />
                        <span className="text-xs text-muted-foreground">{statusLabel}</span>
                    </div>
                    {/* Persistent voice verification indicator */}
                    {connectionState === "connected" && voiceStatus !== "unverified" && (
                        <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
                            voiceStatus === "match"
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                                : voiceStatus === "uncertain"
                                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                                    : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                        }`}>
                            <ShieldCheck className={`h-3 w-3 ${
                                voiceStatus === "match"
                                    ? "text-emerald-500"
                                    : voiceStatus === "uncertain"
                                        ? "text-amber-500"
                                        : "text-red-500"
                            }`} />
                            <span>
                                {voiceStatus === "match"
                                    ? voiceSimilarity !== null ? `Verified (${(voiceSimilarity * 100).toFixed(0)}%)` : "Verified"
                                    : voiceStatus === "uncertain"
                                        ? "Uncertain"
                                        : "Voice mismatch"}
                            </span>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={endViva}
                    disabled={connectionState !== "connected"}
                    className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                >
                    <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
                    End viva
                </Button>
            </div>

            {/* Audio suspended banner — Chrome can suspend AudioContext on tab
                switch or OS focus change. Click anywhere to resume. */}
            {audioSuspended && connectionState === "connected" && (
                <div className="mx-1 mb-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                    <VolumeX className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Audio paused by your browser. Click anywhere to resume.
                    </p>
                </div>
            )}

            {/* Voice mismatch warning — stays visible until voice matches */}
            {connectionState === "connected" && voiceStatus === "mismatch" && (
                <div className="mx-1 mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Voice mismatch detected
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {voiceSimilarity !== null
                                ? `Voice similarity is low (${(voiceSimilarity * 100).toFixed(0)}%). Please ensure you are the enrolled speaker.`
                                : "Your voice does not match the enrolled profile. Please ensure you are the enrolled speaker."}
                        </p>
                    </div>
                </div>
            )}

            {/* Transcript area */}
            <div className="flex-1 overflow-y-auto px-1 pt-2 pb-6 space-y-5">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
                        <VoiceOrb state={aiState} connected={connectionState === "connected"} />
                        <p className="text-sm max-w-xs">
                            {connectionState === "connected"
                                ? "Viva in progress — speak naturally, the examiner is listening."
                                : "Connect to begin your viva. The conversation will be transcribed live."}
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <TranscriptBubble key={msg.id} message={msg} />
                    ))
                )}
                <div ref={transcriptEndRef} />
            </div>

            {/* Footer controls */}
            <div className="border-t border-border/40 pt-5 pb-3 flex flex-col items-center gap-3">
                {connectionState === "disconnected" || connectionState === "error" ? (
                    <Button onClick={connectWebSocket} size="lg" className="gap-2 rounded-full px-6">
                        <Wifi className="h-4 w-4" />
                        Connect to examiner
                    </Button>
                ) : connectionState === "connecting" ? (
                    <Button disabled size="lg" className="gap-2 rounded-full px-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting…
                    </Button>
                ) : (
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        aria-label={isRecording ? "Mute microphone" : "Start speaking"}
                        className={`relative flex items-center justify-center h-16 w-16 rounded-full transition-colors duration-200 shadow-lg ${
                            isRecording
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-foreground text-background hover:opacity-90"
                        }`}
                    >
                        {isRecording ? (
                            <MicOff className="h-6 w-6" />
                        ) : (
                            <Mic className="h-6 w-6" />
                        )}
                    </button>
                )}

                <p className="text-xs text-muted-foreground h-4">
                    {connectionState === "connected" &&
                        (isRecording ? "Tap to mute" : "Tap to unmute")}
                </p>
            </div>
        </div>

        {/* End Viva Confirmation */}
        <ConfirmDialog
            open={showEndConfirm}
            onOpenChange={setShowEndConfirm}
            title="End Viva Session?"
            description="This will submit your session for grading. You won't be able to continue after ending."
            confirmText="End Session"
            variant="destructive"
            onConfirm={confirmEndViva}
        />
        </>
    );
}

// ============================================================
// Presentational helpers
// ============================================================

function TranscriptBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] space-y-1">
                <p
                    className={`text-[10px] uppercase tracking-wide font-medium ${
                        isUser ? "text-right text-muted-foreground" : "text-muted-foreground"
                    }`}
                >
                    {isUser ? "You" : "Examiner"}
                </p>
                <div
                    className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                        isUser
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                    }`}
                >
                    {message.content}
                    {message.streaming && (
                        <span className="inline-block w-1.5 h-3.5 align-middle ml-1 bg-current opacity-60 animate-pulse" />
                    )}
                </div>
            </div>
        </div>
    );
}

function VoiceOrb({
    state,
    connected,
    size = "lg",
}: {
    state: AiState;
    connected: boolean;
    size?: "sm" | "lg";
}) {
    const dim = size === "lg" ? "h-24 w-24" : "h-10 w-10";
    const inner = size === "lg" ? "h-16 w-16" : "h-6 w-6";

    const active = connected && (state === "speaking" || state === "listening");
    const color =
        state === "speaking"
            ? "from-blue-500 to-indigo-500"
            : state === "listening"
                ? "from-emerald-500 to-teal-500"
                : "from-muted-foreground/30 to-muted-foreground/20";

    return (
        <div className={`relative ${dim} flex items-center justify-center`}>
            {active && (
                <span
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${color} opacity-40 animate-ping`}
                />
            )}
            <span
                className={`absolute inset-2 rounded-full bg-gradient-to-br ${color} ${
                    active ? "opacity-80" : "opacity-50"
                } blur-[2px]`}
            />
            <span
                className={`relative rounded-full ${inner} bg-gradient-to-br ${color} ${
                    active ? "animate-pulse" : ""
                }`}
            />
        </div>
    );
}