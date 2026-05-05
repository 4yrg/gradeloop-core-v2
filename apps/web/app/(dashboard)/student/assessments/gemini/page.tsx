"use client";

/**
 * Gemini Live Voice Chat
 *
 * Flow:
 *   1. User clicks "Start" → opens WebSocket + mic → audio streams continuously
 *   2. Gemini auto-detects when user stops talking (VAD) and responds with audio
 *   3. User can keep talking naturally — it's a live conversation
 *   4. User clicks "End" → mic stops, WebSocket closes
 */

import * as React from "react";

import { ivasApi } from "@/lib/ivas-api";

const WS_URL = ivasApi.getStandaloneVivaWebSocketUrl();

type SessionState = "idle" | "connecting" | "live" | "error";

export default function GeminiPage() {
    const [state, setState] = React.useState<SessionState>("idle");
    const [aiSpeaking, setAiSpeaking] = React.useState(false);

    const wsRef = React.useRef<WebSocket | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);
    const playCtxRef = React.useRef<AudioContext | null>(null);
    const nextStartRef = React.useRef(0);

    // ── Play one Gemini audio chunk through speakers (gapless) ───────
    const playChunk = React.useCallback((b64: string) => {
        if (!playCtxRef.current) {
            playCtxRef.current = new AudioContext({ sampleRate: 24000 });
        }
        const ctx = playCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();

        const raw = atob(b64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const pcm = new Int16Array(bytes.buffer);
        const f32 = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;

        const buf = ctx.createBuffer(1, f32.length, 24000);
        buf.getChannelData(0).set(f32);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);

        // Schedule this chunk right after the previous one ends — no gaps
        const startAt = Math.max(ctx.currentTime, nextStartRef.current);
        src.start(startAt);
        nextStartRef.current = startAt + buf.duration;
    }, []);

    // ── Start mic → stream PCM16 over WebSocket ──────────────────────
    const startMic = React.useCallback(
        async (ws: WebSocket) => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
            streamRef.current = stream;

            const ctx = new AudioContext({ sampleRate: 16000 });
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                const input = e.inputBuffer.getChannelData(0);
                const pcm = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }
                const view = new Uint8Array(pcm.buffer);
                let bin = "";
                for (let i = 0; i < view.length; i++)
                    bin += String.fromCharCode(view[i]);
                ws.send(JSON.stringify({ type: "audio", data: btoa(bin) }));
            };

            source.connect(processor);
            processor.connect(ctx.destination);
        },
        [],
    );

    // ── Stop mic ─────────────────────────────────────────────────────
    const stopMic = React.useCallback(() => {
        processorRef.current?.disconnect();
        processorRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    // ── Start session: connect WS + start mic ────────────────────────
    const start = React.useCallback(() => {
        setState("connecting");
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = async () => {
            try {
                await startMic(ws);
                setState("live");
            } catch {
                setState("error");
                ws.close();
            }
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data as string);
                if (msg.type === "audio" && msg.data) {
                    setAiSpeaking(true);
                    playChunk(msg.data);
                } else if (msg.type === "turn_complete") {
                    setAiSpeaking(false);
                    nextStartRef.current = 0;
                }
            } catch {
                /* ignore */
            }
        };

        ws.onclose = () => {
            stopMic();
            setState("idle");
            setAiSpeaking(false);
        };

        ws.onerror = () => setState("error");
    }, [startMic, stopMic, playChunk]);

    // ── End session ──────────────────────────────────────────────────
    const end = React.useCallback(() => {
        stopMic();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "end_session" }));
        }
        wsRef.current?.close();
        wsRef.current = null;
        setState("idle");
        setAiSpeaking(false);
        nextStartRef.current = 0;
    }, [stopMic]);

    // Cleanup on unmount
    React.useEffect(() => () => end(), [end]);

    // ── Render ───────────────────────────────────────────────────────
    const isLive = state === "live";

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] select-none">
            {/* Orb */}
            <div className="relative mb-10">
                <div
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isLive
                            ? aiSpeaking
                                ? "bg-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.4)]"
                                : "bg-emerald-500/15 shadow-[0_0_40px_rgba(34,197,94,0.25)]"
                            : "bg-zinc-800/50"
                    }`}
                >
                    <div
                        className={`w-24 h-24 rounded-full border flex items-center justify-center transition-all duration-500 ${
                            isLive
                                ? aiSpeaking
                                    ? "border-indigo-500/50 bg-indigo-500/10"
                                    : "border-emerald-500/40 bg-emerald-500/5"
                                : "border-zinc-700 bg-zinc-900/50"
                        }`}
                    >
                        <span
                            className={`text-3xl font-bold transition-colors ${
                                isLive
                                    ? aiSpeaking
                                        ? "text-indigo-400"
                                        : "text-emerald-400"
                                    : "text-zinc-600"
                            }`}
                        >
                            G
                        </span>
                    </div>
                </div>

                {/* Pulse ring when AI is speaking */}
                {aiSpeaking && (
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 animate-ping" />
                )}
            </div>

            {/* Status text */}
            <p className="text-sm text-muted-foreground mb-8 h-5">
                {state === "idle" && "Click Start to begin a voice conversation"}
                {state === "connecting" && "Connecting to Gemini…"}
                {isLive && !aiSpeaking && "Listening — just speak naturally"}
                {isLive && aiSpeaking && "Gemini is responding…"}
                {state === "error" && "Connection failed — try again"}
            </p>

            {/* Button */}
            {!isLive && state !== "connecting" && (
                <button
                    onClick={start}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-medium px-8 py-3 rounded-full transition-all shadow-lg shadow-indigo-500/20"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                    Start
                </button>
            )}
            {state === "connecting" && (
                <button
                    disabled
                    className="flex items-center gap-2 bg-zinc-700 text-zinc-400 text-sm px-8 py-3 rounded-full cursor-not-allowed"
                >
                    <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                    Connecting
                </button>
            )}
            {isLive && (
                <button
                    onClick={end}
                    className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 active:scale-95 text-white text-sm font-medium px-8 py-3 rounded-full transition-all"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    End
                </button>
            )}
        </div>
    );
}
