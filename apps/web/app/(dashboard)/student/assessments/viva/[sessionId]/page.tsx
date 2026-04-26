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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ivasApi } from "@/lib/ivas-api";
import type { VivaSession, WsMessageIncoming, ChatMessage } from "@/types/ivas";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";
type AiState = "idle" | "speaking" | "listening";

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

    // Voice verification warnings
    const [voiceWarning, setVoiceWarning] = React.useState<{ similarity: number; confidence: string } | null>(null);
    const voiceWarningTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs
    const wsRef = React.useRef<WebSocket | null>(null);
    // Two distinct AudioContexts: playback runs at 24kHz (Gemini Live output),
    // mic runs at 16kHz (Gemini Live input). Sharing one context caused the
    // mic to silently run at 24kHz, corrupting the audio sent upstream.
    const playbackCtxRef = React.useRef<AudioContext | null>(null);
    const micCtxRef = React.useRef<AudioContext | null>(null);
    const playingSourcesRef = React.useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextPlayStartRef = React.useRef(0);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const transcriptEndRef = React.useRef<HTMLDivElement>(null);
    const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Gemini Live sends incremental transcription chunks — we concat into the
    // latest message for that role while it is still streaming, then lock it
    // when `finished` is true or the turn switches.
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
                    // Seal any previous streaming message (role switch)
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
            // Context must already exist and be running — it is created inside
            // the Connect button click handler so autoplay policy allows it.
            // Dropping a chunk here is strictly better than queueing it onto a
            // suspended context, which is what caused the "two voices at once"
            // bug (every queued source fired in unison when ctx later resumed).
            if (!ctx || ctx.state !== "running") return;

            const raw = atob(base64Data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

            // PCM 16-bit to Float32
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

            // Schedule right after the previous chunk ends — no gaps
            const startAt = Math.max(ctx.currentTime, nextPlayStartRef.current);
            source.start(startAt);
            nextPlayStartRef.current = startAt + buffer.duration;

            // Track live sources so we can hard-stop on interruption/end.
            playingSourcesRef.current.add(source);
            source.onended = () => playingSourcesRef.current.delete(source);
        } catch (err) {
            console.error("Audio playback error:", err);
        }
    }, []);

    // Hard-stop any in-flight audio. Used when the user ends the session or
    // an interruption / error occurs, so lingering scheduled chunks can't
    // play over the next turn.
    const stopAllPlayback = React.useCallback(() => {
        for (const src of playingSourcesRef.current) {
            try { src.stop(); } catch { /* already stopped */ }
        }
        playingSourcesRef.current.clear();
        nextPlayStartRef.current = 0;
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
        nextPlayStartRef.current = 0;

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

        const url = ivasApi.getVivaWebSocketUrl(sessionId);
        setConnectionState("connecting");

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionState("connected");
            // Do NOT reset reconnectAttempts here. A terminal (already-ended)
            // session will accept the WS and fire onopen, then immediately
            // close — if we reset the counter here, every reconnect attempt
            // would succeed-open-close-reset-retry in a tight infinite loop.
            // We only reset once we've actually received `session_started`,
            // which a live session sends but a terminal session never does.
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessageIncoming = JSON.parse(event.data);

                switch (msg.type) {
                    case "session_started":
                        // Real live session confirmed — safe to reset the
                        // reconnect counter now. (See onopen comment.)
                        reconnectAttemptsRef.current = 0;
                        setReconnectAttempts(0);
                        setAiState("idle");
                        nextPlayStartRef.current = 0;
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
                        // Fallback for non-audio text responses (rare with Live API)
                        if (msg.data) {
                            appendTranscript("assistant", msg.data, true);
                        }
                        break;

                    case "turn_complete":
                        setAiState("idle");
                        // Don't reset nextPlayStartRef here — the scheduled
                        // tail of the current turn is still draining. It'll
                        // naturally catch up to ctx.currentTime on the next
                        // turn's first chunk via Math.max(...).
                        // Seal any in-flight streaming bubble
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
                        stopAllPlayback();
                        sessionEndedRef.current = true;
                        setSessionEnded(true);
                        setConnectionState("disconnected");
                        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
                        setReconnectAttempts(MAX_RECONNECT_ATTEMPTS);
                        ivasApi.getSession(sessionId).then(setSession).catch(() => {});
                        break;


                    case "error":
                        if (msg.data === "Session already ended.") {
                            // Backend rejected reconnection — session is in a terminal state.
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
                        setVoiceWarning({
                            similarity: msg.similarity ?? 0,
                            confidence: msg.confidence ?? "low",
                        });
                        // Auto-dismiss after 8 seconds
                        if (voiceWarningTimeoutRef.current) {
                            clearTimeout(voiceWarningTimeoutRef.current);
                        }
                        voiceWarningTimeoutRef.current = setTimeout(() => setVoiceWarning(null), 8000);
                        break;

                    case "voice_status":
                        // Silent tracking — no UI action needed for medium/high confidence
                        break;

                    case "pong":
                        break;
                }
            } catch (err) {
                console.error("WS message parse error:", err);
            }
        };

        ws.onclose = () => {
            // If the session has already ended (backend told us via
            // session_ended or "Session already ended" error), do NOT
            // attempt reconnection — it will always fail and produce
            // duplicate toast messages. Use the ref to avoid stale closure.
            if (sessionEndedRef.current) return;

            const attempts = reconnectAttemptsRef.current;
            if (attempts < MAX_RECONNECT_ATTEMPTS) {
                setConnectionState("disconnected");
                // Attempt reconnection with exponential backoff
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
    }, [sessionId, playAudioChunk, appendTranscript, addToast]);

    // --- Microphone Recording ---
    const startRecording = React.useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            mediaStreamRef.current = stream;

            // Dedicated 16kHz context for the mic path. Must NOT share the
            // 24kHz playback context — the ScriptProcessor inherits the
            // context's sample rate, so a shared context sends wrong-rate
            // PCM to the backend and the examiner never hears you correctly.
            if (!micCtxRef.current) {
                micCtxRef.current = new AudioContext({ sampleRate: 16000 });
            }
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
        setIsRecording(false);
        setAiState("idle");
    }, []);

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
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between pb-4">
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

            {/* Voice verification warning */}
            {voiceWarning && (
                <div className="mx-1 mb-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            Voice verification warning
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            Your voice similarity is low ({voiceWarning.similarity.toFixed(2)}).
                            Please ensure you are the enrolled speaker.
                        </p>
                    </div>
                </div>
            )}

            {/* Transcript area */}
            <div className="flex-1 overflow-y-auto px-1 pt-2 pb-6 space-y-5">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
                        {/* Idle orb */}
                        <VoiceOrb state={aiState} connected={connectionState === "connected"} />
                        <p className="text-sm max-w-xs">
                            {connectionState === "connected"
                                ? "Tap the microphone to start speaking with your examiner."
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
                        (isRecording ? "Tap to mute" : "Tap microphone to speak")}
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
