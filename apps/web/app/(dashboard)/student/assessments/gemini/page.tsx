"use client";

import * as React from "react";

const WS_URL = (process.env.NEXT_PUBLIC_IVAS_WS_URL || "ws://localhost:8000") + "/ws/ivas/viva";

type ConnState = "idle" | "connecting" | "connected" | "error";
type AiState   = "idle" | "speaking";

interface Message {
    id: string;
    role: "ai" | "system";
    text: string;
}

export default function GeminiPage() {
    const [connState, setConnState]   = React.useState<ConnState>("idle");
    const [aiState, setAiState]       = React.useState<AiState>("idle");
    const [recording, setRecording]   = React.useState(false);
    const [messages, setMessages]     = React.useState<Message[]>([]);

    const wsRef        = React.useRef<WebSocket | null>(null);
    const audioCtxRef  = React.useRef<AudioContext | null>(null);
    const streamRef    = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const playQueueRef = React.useRef<Promise<void>>(Promise.resolve());
    const bottomRef    = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const addMsg = (role: Message["role"], text: string) =>
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role, text }]);

    // ── Audio playback ─────────────────────────────────────────────────────
    const enqueueAudio = React.useCallback((b64: string) => {
        playQueueRef.current = playQueueRef.current
            .then(async () => {
                if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
                const ctx = audioCtxRef.current;
                if (ctx.state === "suspended") await ctx.resume();

                const raw   = atob(b64);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

                const pcm16 = new Int16Array(bytes.buffer);
                const f32   = new Float32Array(pcm16.length);
                for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;

                const buf = ctx.createBuffer(1, f32.length, 24000);
                buf.getChannelData(0).set(f32);

                await new Promise<void>(res => {
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.connect(ctx.destination);
                    src.onended = () => res();
                    src.start();
                });
            })
            .catch(() => {});
    }, []);

    // ── Mic recording ──────────────────────────────────────────────────────
    const startRecording = React.useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
            });
            streamRef.current = stream;

            if (!audioCtxRef.current || audioCtxRef.current.sampleRate !== 16000) {
                audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === "suspended") await ctx.resume();

            const source    = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) return;
                const input = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }
                let bin = "";
                const view = new Uint8Array(pcm16.buffer);
                for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
                wsRef.current.send(JSON.stringify({ type: "audio", data: btoa(bin) }));
            };

            source.connect(processor);
            processor.connect(ctx.destination);
            setRecording(true);
        } catch {
            addMsg("system", "Microphone access denied.");
        }
    }, []);

    const stopRecording = React.useCallback(() => {
        processorRef.current?.disconnect();
        processorRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setRecording(false);

        // Tell backend the user stopped talking so Gemini's VAD
        // knows the speech ended and can start generating a response
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log("[gemini] sending mic_stop");
            wsRef.current.send(JSON.stringify({ type: "mic_stop" }));
        }
    }, []);

    // ── WebSocket ──────────────────────────────────────────────────────────
    const connect = React.useCallback(() => {
        setConnState("connecting");
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[gemini] ws connected");
            setConnState("connected");
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data as string);
                console.log("[gemini] recv:", msg.type, msg.type === "audio" ? `(${msg.data?.length} chars)` : msg.data?.slice?.(0, 80) ?? "");

                if (msg.type === "audio" && msg.data) {
                    setAiState("speaking");
                    enqueueAudio(msg.data);
                } else if (msg.type === "text" && msg.data?.trim()) {
                    addMsg("ai", msg.data);
                } else if (msg.type === "turn_complete") {
                    setAiState("idle");
                } else if (msg.type === "session_ended") {
                    addMsg("system", "Session ended.");
                    // Don't call disconnect here — let onclose handle it
                } else if (msg.type === "error") {
                    console.error("[gemini] error:", msg.data);
                    addMsg("system", msg.data || "Unknown error");
                }
            } catch (err) {
                console.error("[gemini] parse error:", err);
            }
        };

        ws.onclose = (e) => {
            console.log("[gemini] ws closed, code:", e.code, "reason:", e.reason);
            setConnState("idle");
            setAiState("idle");
            stopRecording();
        };
        ws.onerror = (e) => {
            console.error("[gemini] ws error:", e);
            setConnState("error");
        };
    }, [enqueueAudio, stopRecording]);

    const disconnect = React.useCallback(() => {
        stopRecording();
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN)
                wsRef.current.send(JSON.stringify({ type: "end_viva" }));
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnState("idle");
        setAiState("idle");
    }, [stopRecording]);

    React.useEffect(() => () => disconnect(), [disconnect]);

    // ── Derived ────────────────────────────────────────────────────────────
    const isConnected   = connState === "connected";
    const isConnecting  = connState === "connecting";

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">

            {/* ── Header ── */}
            <div className="flex items-center justify-between pb-4 mb-2 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full transition-colors ${
                        isConnected  ? "bg-emerald-500 shadow-[0_0_6px_#22c55e]" :
                        isConnecting ? "bg-amber-400 animate-pulse" :
                        connState === "error" ? "bg-red-500" :
                        "bg-zinc-600"
                    }`} />
                    <span className="text-sm font-medium">Gemini Live</span>
                    {aiState === "speaking" && (
                        <span className="flex items-center gap-1 text-xs text-indigo-400">
                            <SoundWave />
                            Speaking
                        </span>
                    )}
                </div>
                {isConnected && (
                    <button
                        onClick={disconnect}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Disconnect
                    </button>
                )}
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {messages.length === 0 && !isConnected && !isConnecting && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center select-none">
                        <GeminiOrb />
                        <p className="text-sm text-muted-foreground">
                            Start a live voice conversation with Gemini
                        </p>
                    </div>
                )}
                {messages.length === 0 && isConnected && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                        <GeminiOrb pulse />
                        <p className="text-sm text-muted-foreground">
                            {recording ? "Listening…" : "Click the mic to speak"}
                        </p>
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === "system" ? "justify-center" : "justify-start"}`}>
                        {msg.role === "system" ? (
                            <p className="text-xs text-muted-foreground/60 italic">{msg.text}</p>
                        ) : (
                            <div className="flex gap-2.5 max-w-[85%]">
                                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                    <span className="text-[10px] text-indigo-400 font-bold">G</span>
                                </div>
                                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
                                    {msg.text}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* ── Controls ── */}
            <div className="pt-5 pb-1 flex flex-col items-center gap-4">
                {!isConnected && !isConnecting && (
                    <button
                        onClick={connect}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-medium px-8 py-3 rounded-full transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <MicIcon className="w-4 h-4" />
                        Start
                    </button>
                )}
                {isConnecting && (
                    <button disabled className="flex items-center gap-2 bg-zinc-700 text-zinc-400 text-sm font-medium px-8 py-3 rounded-full cursor-not-allowed">
                        <span className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                        Connecting…
                    </button>
                )}
                {isConnected && (
                    <button
                        onClick={recording ? stopRecording : startRecording}
                        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95
                            ${recording
                                ? "bg-red-500/20 border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                : "bg-indigo-500/20 border-2 border-indigo-500 text-indigo-400 hover:bg-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                            }`}
                    >
                        {recording ? (
                            <StopIcon className="w-6 h-6" />
                        ) : (
                            <MicIcon className="w-6 h-6" />
                        )}
                        {recording && (
                            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />
                        )}
                    </button>
                )}
                {isConnected && (
                    <p className="text-xs text-muted-foreground">
                        {recording ? "Recording — click to stop" : "Click to speak"}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Icons & decorative components ─────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
    );
}

function StopIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
    );
}

function SoundWave() {
    return (
        <span className="flex items-end gap-0.5 h-3">
            {[1, 2, 3, 4].map(i => (
                <span
                    key={i}
                    className="w-0.5 bg-indigo-400 rounded-full animate-bounce"
                    style={{ height: `${[8, 14, 10, 12][i - 1]}px`, animationDelay: `${i * 0.1}s` }}
                />
            ))}
        </span>
    );
}

function GeminiOrb({ pulse }: { pulse?: boolean }) {
    return (
        <div className={`relative w-24 h-24 ${pulse ? "animate-pulse" : ""}`}>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/20 blur-xl" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-purple-400 bg-clip-text text-transparent">G</span>
            </div>
        </div>
    );
}
