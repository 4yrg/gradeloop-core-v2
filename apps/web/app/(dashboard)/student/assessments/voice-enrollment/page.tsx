"use client";

import * as React from "react";
import {
    Mic,
    MicOff,
    CheckCircle2,
    Circle,
    Loader2,
    AlertCircle,
    Trash2,
    ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { ivasApi } from "@/lib/ivas-api";
import { useAuthStore } from "@/lib/stores/authStore";
import type { VoiceProfileStatus } from "@/types/ivas";
import { cn } from "@/lib/utils";

export default function VoiceEnrollmentPage() {
    const { addToast } = useToast();
    const user = useAuthStore((s) => s.user);

    const [profile, setProfile] = React.useState<VoiceProfileStatus | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [recording, setRecording] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [currentSample, setCurrentSample] = React.useState(1);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const [deleting, setDeleting] = React.useState(false);

    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const chunksRef = React.useRef<Blob[]>([]);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    const studentId = user?.id || "";

    // Load voice profile status
    React.useEffect(() => {
        if (!studentId) return;
        let mounted = true;
        async function load() {
            try {
                const status = await ivasApi.getVoiceProfile(studentId);
                if (mounted) setProfile(status);
            } catch (err) {
                console.error("Failed to load voice profile:", err);
                // No profile yet, that's fine
                if (mounted) setProfile({ student_id: studentId, enrolled: false, samples_count: 0, required_samples: 3, is_complete: false });
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [studentId]);

    // Start recording a voice sample
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { sampleRate: 16000, channelCount: 1 }
            });

            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());

                const blob = new Blob(chunksRef.current, { type: "audio/webm" });

                // Convert to WAV using AudioContext
                const wavBlob = await convertToWav(blob);
                const file = new File([wavBlob], `sample_${currentSample}.wav`, { type: "audio/wav" });

                setUploading(true);
                try {
                    const result = await ivasApi.enrollVoiceSample(studentId, currentSample, file);
                    setProfile({
                        student_id: studentId,
                        enrolled: result.is_complete,
                        samples_count: result.samples_count,
                        required_samples: result.required_samples,
                        is_complete: result.is_complete,
                    });

                    if (result.is_complete) {
                        addToast({ title: "Enrollment complete!", variant: "success", description: "Your voiceprint has been stored." });
                    } else {
                        addToast({ title: result.message, variant: "success" });
                        setCurrentSample(result.samples_count + 1);
                    }
                } catch (err) {
                    addToast({
                        title: "Upload failed",
                        variant: "error",
                        description: err instanceof Error ? err.message : "Failed to process audio sample.",
                    });
                } finally {
                    setUploading(false);
                }
            };

            mediaRecorder.start();
            setRecording(true);
            setRecordingTime(0);

            // Timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Microphone access error:", err);
            addToast({
                variant: "error",
                description: "Please allow microphone access for voice enrollment.",
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const deleteProfile = async () => {
        setDeleting(true);
        try {
            await ivasApi.deleteVoiceProfile(studentId);
            setProfile({ student_id: studentId, enrolled: false, samples_count: 0, required_samples: 3, is_complete: false });
            setCurrentSample(1);
            addToast({ title: "Voice profile deleted", variant: "success", description: "You can re-enroll at any time." });
        } catch (err) {
            addToast({ title: "Delete failed", variant: "error", description: err instanceof Error ? err.message : "Unknown error" });
        } finally {
            setDeleting(false);
        }
    };

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    if (!user?.id) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Authentication Required
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const required = profile?.required_samples || 3;
    const completed = profile?.samples_count || 0;
    const isEnrolled = profile?.is_complete || false;

    return (
        <div className="flex flex-col gap-8 pb-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="border-b border-border/40 pb-6">
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6" />
                    Voice Enrollment
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Record voice samples so we can verify your identity during viva assessments.
                </p>
            </div>

            {/* Status */}
            <Card className={isEnrolled ? "border-emerald-200 dark:border-emerald-900/40" : ""}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        {isEnrolled ? (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                Enrolled
                            </>
                        ) : (
                            <>
                                <Mic className="h-5 w-5" />
                                Enrollment Progress
                            </>
                        )}
                    </CardTitle>
                    <CardDescription>
                        {isEnrolled
                            ? "Your voiceprint is stored. You're ready for viva assessments."
                            : `Record ${required} voice samples (~5-10 seconds of speech each).`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Sample progress dots */}
                    <div className="flex items-center gap-3 mb-6">
                        {Array.from({ length: required }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                    i < completed
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : i === completed && !isEnrolled
                                            ? "bg-primary/10 text-primary border-2 border-primary"
                                            : "bg-muted text-muted-foreground"
                                )}>
                                    {i < completed ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                {i < required - 1 && (
                                    <div className={cn("w-8 h-0.5", i < completed ? "bg-emerald-400" : "bg-muted")} />
                                )}
                            </div>
                        ))}
                    </div>

                    {isEnrolled ? (
                        <Button variant="outline" size="sm" onClick={deleteProfile} disabled={deleting} className="gap-1 text-red-600 hover:text-red-700">
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Delete Voice Profile
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            {/* Recording controls */}
                            <div className="flex flex-col items-center gap-4">
                                {recording ? (
                                    <>
                                        <div className="relative">
                                            <Button
                                                size="lg"
                                                variant="destructive"
                                                className="rounded-full w-20 h-20"
                                                onClick={stopRecording}
                                            >
                                                <MicOff className="h-8 w-8" />
                                            </Button>
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-mono px-2 py-0.5 rounded-full animate-pulse">
                                                {recordingTime}s
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Speak naturally for at least 5 seconds, then click to stop.
                                        </p>
                                    </>
                                ) : uploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Processing sample...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            size="lg"
                                            className="rounded-full w-20 h-20"
                                            onClick={startRecording}
                                        >
                                            <Mic className="h-8 w-8" />
                                        </Button>
                                        <p className="text-sm text-muted-foreground">
                                            Click to record sample {currentSample} of {required}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="bg-muted/50 border-dashed">
                <CardHeader>
                    <CardTitle className="text-base">Tips for Good Voice Samples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>- Speak in a quiet environment with minimal background noise</p>
                    <p>- Use your natural speaking voice (the same voice you&apos;ll use during the viva)</p>
                    <p>- Each sample should be 5-10 seconds of continuous speech</p>
                    <p>- Read different passages or talk about different topics for each sample</p>
                    <p>- Include programming terms you might use in your viva (e.g., &quot;function&quot;, &quot;variable&quot;, &quot;loop&quot;)</p>
                </CardContent>
            </Card>
        </div>
    );
}

// Helper: convert webm blob to WAV
async function convertToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numChannels = 1;
    const sampleRate = 16000;
    const bitsPerSample = 16;

    // Resample to 16kHz mono
    const offlineCtx = new OfflineAudioContext(numChannels, audioBuffer.duration * sampleRate, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const rendered = await offlineCtx.startRendering();

    const channelData = rendered.getChannelData(0);
    const dataLength = channelData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    await audioContext.close();
    return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
