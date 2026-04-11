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
    const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
    const MAX_RECONNECT_ATTEMPTS = 3;
    const [showEndConfirm, setShowEndConfirm] = React.useState(false);

    // Refs
    const wsRef = React.useRef<WebSocket | null>(null);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const nextPlayStartRef = React.useRef(0);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const transcriptEndRef = React.useRef<HTMLDivElement>(null);
    const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Load session info
    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const s = await ivasApi.getSession(sessionId);
                if (mounted) {
                    setSession(s);
                    if (s.status === "completed" || s.status === "abandoned") {
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
    const playAudioChunk = React.useCallback(async (base64Data: string) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }
            const ctx = audioContextRef.current;
            if (ctx.state === "suspended") await ctx.resume();

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
        } catch (err) {
            console.error("Audio playback error:", err);
        }
    }, []);

    // --- WebSocket Connection ---
    const connectWebSocket = React.useCallback(() => {
        if (sessionEnded) return;

        const url = ivasApi.getVivaWebSocketUrl(sessionId);
        setConnectionState("connecting");

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionState("connected");
            setReconnectAttempts(0); // Reset on successful connection
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessageIncoming = JSON.parse(event.data);

                switch (msg.type) {
                    case "session_started":
                        setAiState("speaking");
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
                        nextPlayStartRef.current = 0;
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
                        setSessionEnded(true);
                        setConnectionState("disconnected");
                        setReconnectAttempts(MAX_RECONNECT_ATTEMPTS); // Prevent reconnection
                        ivasApi.getSession(sessionId).then(setSession).catch(() => {});
                        break;

                    case "error":
                        setConnectionState("error");
                        addToast({
                            title: "Viva error",
                            variant: "error",
                            description: msg.data || "Unknown error",
                        });
                        break;

                    case "pong":
                        break;
                }
            } catch (err) {
                console.error("WS message parse error:", err);
            }
        };

        ws.onclose = () => {
            if (!sessionEnded && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setConnectionState("disconnected");
                // Attempt reconnection with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 5000);
                reconnectTimeoutRef.current = setTimeout(() => {
                    setReconnectAttempts(prev => prev + 1);
                    connectWebSocket();
                }, delay);
            } else if (!sessionEnded) {
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
    }, [sessionId, sessionEnded, playAudioChunk, appendTranscript, addToast, reconnectAttempts]);

    // --- Microphone Recording ---
    const startRecording = React.useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
            });
            mediaStreamRef.current = stream;

            const ctx = audioContextRef.current || new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = ctx;
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
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Viva Complete</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Your oral examination has ended.
                        </p>
                        {session.total_score !== null && (
                            <p className="text-2xl font-black">
                                {session.total_score} / {session.max_possible}
                            </p>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => router.push("/student/assessments/my-sessions")}>
                                My Sessions
                            </Button>
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
