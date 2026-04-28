"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Wifi,
  Loader2,
  AlertCircle,
  PhoneOff,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ivasApi } from "@/lib/ivas-api";
import type { VivaSession, WsMessageIncoming, ChatMessage } from "@/types/ivas";
import { AudioVisualizer } from "@/components/assessments/viva/audio-visualizer";
import { VivaTranscript } from "@/components/assessments/viva/viva-transcript";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";
type AiState = "idle" | "preparing" | "speaking" | "listening";

const PING_INTERVAL_MS = 25_000;

const VIVA_TIPS = [
  "Speak clearly and at a natural pace — the examiner adapts to you.",
  "This is a conceptual viva — you'll be asked about your understanding, not code syntax.",
  "If you're unsure, say what you know — the examiner will guide you.",
  "Take a moment to think before answering — there's no time pressure.",
  "Your voice is being verified throughout the session for security.",
  "You can mute your mic anytime by tapping the microphone button.",
  "Listen carefully to each question before responding.",
  "Explain your reasoning — partial understanding still earns marks.",
];

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

  // Voice verification state
  const [voiceStatus, setVoiceStatus] = React.useState<"unverified" | "match" | "uncertain" | "mismatch">("unverified");
  const [voiceSimilarity, setVoiceSimilarity] = React.useState<number | null>(null);

  // Refs
  const wsRef = React.useRef<WebSocket | null>(null);
  const connectWebSocketRef = React.useRef<() => void>(() => {});
  const playbackCtxRef = React.useRef<AudioContext | null>(null);
  const micCtxRef = React.useRef<AudioContext | null>(null);
  const playingSourcesRef = React.useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayStartRef = React.useRef(0);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const transcriptEndRef = React.useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const tipIndexRef = React.useRef(0);
  const [currentTip, setCurrentTip] = React.useState(VIVA_TIPS[0]);
  const tipIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Cycle viva tips during connecting/preparing phase
  React.useEffect(() => {
    if (connectionState !== "connecting" && aiState !== "preparing") {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
      return;
    }
    if (!tipIntervalRef.current) {
      tipIndexRef.current = 0;
      setCurrentTip(VIVA_TIPS[0]);
      tipIntervalRef.current = setInterval(() => {
        tipIndexRef.current = (tipIndexRef.current + 1) % VIVA_TIPS.length;
        setCurrentTip(VIVA_TIPS[tipIndexRef.current]);
      }, 4000);
    }
    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    };
  }, [connectionState, aiState]);

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
    if (micCtxRef.current && micCtxRef.current.state === "suspended") {
      micCtxRef.current.resume().catch(() => {});
    }
  }, []);

  // --- Microphone Recording ---
  const startRecording = React.useCallback(async () => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
        });
        mediaStreamRef.current = stream;
      }

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
    } catch {
      addToast({
        title: "Microphone access denied",
        variant: "error",
        description: "Please allow microphone access to participate in the viva.",
      });
      setIsRecording(false);
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
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // --- WebSocket Connection ---
  const connectWebSocket = React.useCallback(() => {
    if (sessionEndedRef.current) return;

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
      setAiState("preparing");
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
            setAiState("preparing");
            break;

          case "session_started":
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
            nextPlayStartRef.current = 0;
            setVoiceStatus("unverified");
            setVoiceSimilarity(null);
            if (tipIntervalRef.current) {
              clearInterval(tipIntervalRef.current);
              tipIntervalRef.current = null;
            }
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
            setAiState(isRecording ? "listening" : "idle");
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
           connectWebSocketRef.current();
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
  }, [sessionId, playAudioChunk, appendTranscript, addToast, startRecording, stopAllPlayback, isRecording]);

  React.useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // --- Mic toggle ---
  const toggleMic = React.useCallback(() => {
    if (isRecording) {
      stopRecording();
      setAiState("idle");
    } else {
      startRecording();
      setAiState("listening");
    }
  }, [isRecording, startRecording, stopRecording]);

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
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
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

  // ============================================================
  // Render
  // ============================================================

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

  // --- State A: Disconnected / Error ---
  const isDisconnected = connectionState === "disconnected" || connectionState === "error";
  if (isDisconnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] max-w-3xl mx-auto text-center animate-in fade-in duration-300">
        <div className="mb-8">
          <AudioVisualizer state="idle" connected={false} size="lg" />
        </div>
        <div className="space-y-3 mb-8">
          <h1 className="text-2xl font-black tracking-tight font-heading">
            Ready for your viva
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Your oral examination is ready. Tap the button below to connect with your AI examiner.
          </p>
        </div>
        <Button
          onClick={connectWebSocket}
          size="lg"
          className="gap-2 rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-95"
        >
          <Wifi className="h-4 w-4" />
          Connect to examiner
        </Button>
        {connectionState === "error" && (
          <p className="text-xs text-red-500 mt-4">
            Connection failed. Please check your network and try again.
          </p>
        )}
      </div>
    );
  }

  // --- State B: Connecting / Preparing ---
  const isPreparing = connectionState === "connecting" || aiState === "preparing";
  if (isPreparing) {
    const statusText = connectionState === "connecting"
      ? "Connecting to your examiner…"
      : "Examiner is preparing your session…";

    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] max-w-3xl mx-auto text-center animate-in fade-in duration-300">
        <div className="mb-10">
          <AudioVisualizer state="preparing" connected={true} size="lg" />
        </div>
        <div className="space-y-4 max-w-sm">
          <p className="text-sm font-semibold animate-pulse">{statusText}</p>
          <div className="p-4 rounded-xl border border-border/40 bg-muted/30 text-left space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Quick tip
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed transition-all duration-500">
              {currentTip}
            </p>
          </div>
        </div>

        <div className="mt-10">
          <Button disabled size="lg" className="gap-2 rounded-full px-8 h-12">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting…
          </Button>
        </div>
      </div>
    );
  }

  // --- State C: Active conversation ---
  return (
    <>
      <div
        className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto animate-in fade-in duration-300"
        onClick={resumeAudioContext}
      >
        {/* Status bar */}
        <VivaStatusBar
          connectionState={connectionState}
          aiState={aiState}
          voiceStatus={voiceStatus}
          voiceSimilarity={voiceSimilarity}
        />

        {/* Voice mismatch warning */}
        {voiceStatus === "mismatch" && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
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

        {/* Transcript */}
        <VivaTranscript
          messages={messages}
          isEmpty={messages.length === 0}
          emptyMessage="Viva in progress — speak naturally, the examiner is listening.\nYour conversation will appear here."
          endRef={transcriptEndRef}
        />

        {/* Controls */}
        <div className="border-t border-border/40 pt-4 pb-3 px-4 flex items-end justify-between gap-4">
          <MicToggle isRecording={isRecording} onClick={toggleMic} />
          <button
            onClick={endViva}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/5 px-3 py-2 rounded-lg transition-colors"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End viva
          </button>
        </div>
      </div>

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
// Sub-components (no separate file — they reference no external deps)
// ============================================================

function VivaStatusBar({
  connectionState,
  aiState,
  voiceStatus,
  voiceSimilarity,
}: {
  connectionState: ConnectionState;
  aiState: AiState;
  voiceStatus: "unverified" | "match" | "uncertain" | "mismatch";
  voiceSimilarity: number | null;
}) {
  const statusConfig = {
    connecting: { dot: "bg-amber-500", pulse: true, text: "Connecting…" },
    connected: {
      dot:
        aiState === "speaking"
          ? "bg-blue-500"
          : aiState === "listening"
            ? "bg-emerald-500"
            : "bg-primary",
      pulse: false,
      text:
        aiState === "speaking"
          ? "Examiner is speaking"
          : aiState === "listening"
            ? "Listening…"
            : "Ready",
    },
    disconnected: { dot: "bg-slate-400", pulse: false, text: "Not connected" },
    error: { dot: "bg-red-500", pulse: false, text: "Connection error" },
  };

  const current = statusConfig[connectionState];

  const voiceIcons = {
    match: ShieldCheck,
    uncertain: Shield,
    mismatch: ShieldAlert,
    unverified: Shield,
  };

  const voiceColors = {
    match: "text-emerald-600 dark:text-emerald-400",
    uncertain: "text-amber-600 dark:text-amber-400",
    mismatch: "text-red-600 dark:text-red-400",
    unverified: "text-slate-400",
  };

  const VoiceIcon = voiceIcons[voiceStatus] ?? Shield;

  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${current.dot} ${current.pulse ? "animate-pulse" : ""}`} />
          <span className="text-xs font-medium text-muted-foreground">{current.text}</span>
        </div>

        {aiState === "speaking" && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 h-2.5 bg-blue-400 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {connectionState === "connected" && voiceStatus !== "unverified" && (
        <div
          className={`flex items-center gap-1 text-[10px] font-semibold ${voiceColors[voiceStatus]}`}
          title={
            voiceSimilarity !== null
              ? `Voice similarity: ${(voiceSimilarity * 100).toFixed(0)}%`
              : "Voice verification"
          }
        >
          <VoiceIcon className="h-3 w-3" />
          <span>
            {voiceStatus === "match"
              ? voiceSimilarity !== null
                ? `${(voiceSimilarity * 100).toFixed(0)}%`
                : "Verified"
              : voiceStatus === "uncertain"
                ? "Uncertain"
                : "Mismatch"}
          </span>
        </div>
      )}
    </div>
  );
}

function MicToggle({ isRecording, onClick }: { isRecording: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={isRecording ? "Mute microphone" : "Start speaking"}
        className={`relative flex items-center justify-center h-16 w-16 rounded-full transition-all duration-300 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/25"
            : "bg-foreground text-background hover:opacity-90 shadow-black/10 dark:shadow-white/10"
        }`}
      >
        {isRecording && <span className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" />}
        {isRecording ? (
          <MicOff className="h-6 w-6 relative z-10" />
        ) : (
          <Mic className="h-6 w-6 relative z-10" />
        )}
      </button>
      <span className="text-[10px] text-muted-foreground font-medium">
        {isRecording ? "Tap to mute" : "Tap to speak"}
      </span>
    </div>
  );
}
