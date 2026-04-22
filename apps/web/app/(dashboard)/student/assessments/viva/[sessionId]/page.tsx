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
    WifiOff,
    Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
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

    // Refs
    const wsRef = React.useRef<WebSocket | null>(null);
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const nextPlayStartRef = React.useRef(0);
    const mediaStreamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

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

    // Scroll messages to bottom
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Helper to add a message
    const addMessage = React.useCallback((role: "user" | "assistant" | "system", content: string) => {
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role,
            content,
            timestamp: new Date(),
        }]);
    }, []);

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
            addMessage("system", "Connected to viva examiner. Waiting for greeting...");
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessageIncoming = JSON.parse(event.data);

                switch (msg.type) {
                    case "session_started":
                        addMessage("system", "Session started. The AI examiner will greet you shortly.");
                        setAiState("speaking");
                        nextPlayStartRef.current = 0;
                        break;

                    case "audio":
                        setAiState("speaking");
                        if (msg.data) {
                            playAudioChunk(msg.data);
                        }
                        break;

                    case "text":
                        if (msg.data) {
                            addMessage("assistant", msg.data);
                        }
                        break;

                    case "turn_complete":
                        setAiState("idle");
                        nextPlayStartRef.current = 0;
                        break;

                    case "session_ended":
                        setSessionEnded(true);
                        setConnectionState("disconnected");
                        addMessage("system", `Session ended — ${msg.status || "completed"}`);
                        // Refresh session data
                        ivasApi.getSession(sessionId).then(setSession).catch(() => {});
                        break;

                    case "error":
                        addMessage("system", `Error: ${msg.data}`);
                        setConnectionState("error");
                        break;

                    case "pong":
                        break;
                }
            } catch (err) {
                console.error("WS message parse error:", err);
            }
        };

        ws.onclose = () => {
            if (!sessionEnded) {
                setConnectionState("disconnected");
            }
        };

        ws.onerror = () => {
            setConnectionState("error");
        };
    }, [sessionId, sessionEnded, playAudioChunk, addMessage]);

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
            addMessage("system", "Microphone active — speak now.");
        } catch {
            addToast({
                title: "Microphone access denied",
                variant: "error",
                description: "Please allow microphone access to participate in the viva.",
            });
        }
    }, [addToast, addMessage]);

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
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            stopRecording();
            wsRef.current.send(JSON.stringify({ type: "end_session" }));
            addMessage("system", "Ending viva... waiting for AI to wrap up.");
        }
    }, [stopRecording, addMessage]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (processorRef.current) processorRef.current.disconnect();
            if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
            if (wsRef.current) wsRef.current.close();
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

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        {connectionState === "connected" ? (
                            <Wifi className="h-4 w-4 text-emerald-500" />
                        ) : connectionState === "connecting" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                        ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-xs text-muted-foreground capitalize">{connectionState}</span>
                    </div>
                    {aiState === "speaking" && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Volume2 className="h-3 w-3 animate-pulse" />
                            AI speaking
                        </span>
                    )}
                    {aiState === "listening" && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <Mic className="h-3 w-3 animate-pulse" />
                            Listening
                        </span>
                    )}
                </div>
                <Button variant="destructive" size="sm" onClick={endViva} disabled={connectionState !== "connected"}>
                    <PhoneOff className="h-3.5 w-3.5 mr-1" />
                    End Viva
                </Button>
            </div>

            {/* Transcript area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                {messages.length === 0 && connectionState === "disconnected" && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center space-y-2">
                            <Mic className="h-12 w-12 mx-auto opacity-30" />
                            <p className="text-sm">Click &quot;Connect to Examiner&quot; to begin your viva</p>
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}
                    >
                        {msg.role === "system" ? (
                            <p className="text-xs text-muted-foreground italic px-3 py-1">{msg.content}</p>
                        ) : (
                            <div
                                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                }`}
                            >
                                {msg.content}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Controls */}
            <div className="border-t border-border/40 pt-4 flex items-center justify-center gap-4">
                {connectionState === "disconnected" || connectionState === "error" ? (
                    <Button onClick={connectWebSocket} className="gap-2">
                        <Wifi className="h-4 w-4" />
                        Connect to Examiner
                    </Button>
                ) : connectionState === "connecting" ? (
                    <Button disabled className="gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        variant={isRecording ? "destructive" : "default"}
                        className="rounded-full w-16 h-16"
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? (
                            <MicOff className="h-6 w-6" />
                        ) : (
                            <Mic className="h-6 w-6" />
                        )}
                    </Button>
                )}
            </div>
            {connectionState === "connected" && (
                <p className="text-center text-xs text-muted-foreground mt-2 pb-2">
                    {isRecording ? "Recording... click to mute" : "Click microphone to speak"}
                </p>
            )}
        </div>
    );
}
