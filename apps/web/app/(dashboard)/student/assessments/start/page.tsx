"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic2, BookOpen, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { ivasApi } from "@/lib/ivas-api";
import { useAuthStore } from "@/lib/stores/authStore";
import type { IvasAssignment, VoiceProfileStatus } from "@/types/ivas";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function StartAssessmentPage() {
    const router = useRouter();
    const { addToast } = useToast();
    const user = useAuthStore((s) => s.user);

    const [assignments, setAssignments] = React.useState<IvasAssignment[]>([]);
    const [selectedAssignment, setSelectedAssignment] = React.useState<string>("");
    const [loading, setLoading] = React.useState(true);
    const [starting, setStarting] = React.useState(false);
    const [voiceProfileStatus, setVoiceProfileStatus] = React.useState<VoiceProfileStatus | null>(null);

    React.useEffect(() => {
        let mounted = true;
        async function loadAssignments() {
            try {
                setLoading(true);
                // TODO: Filter assignments by student's enrolled courses when course context is available
                const data = await ivasApi.listAssignments();
                if (mounted) {
                    setAssignments(data);
                    if (data.length > 0 && !selectedAssignment) {
                        setSelectedAssignment(data[0].id);
                    }
                }
            } catch (error) {
                if (mounted) {
                    addToast({
                        title: "Failed to load assignments",
                        variant: "error",
                        description: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }
        loadAssignments();
        return () => { mounted = false; };
    }, [addToast]);

    // Check voice profile on mount
    React.useEffect(() => {
        if (!user?.id) return;
        let mounted = true;
        async function checkVoiceProfile() {
            try {
                const status = await ivasApi.getVoiceProfile(user!.id);
                if (mounted) setVoiceProfileStatus(status);
            } catch {
                // No profile found
                if (mounted) setVoiceProfileStatus(null);
            }
        }
        checkVoiceProfile();
        return () => { mounted = false; };
    }, [user?.id]);

    const selectedData = assignments.find(a => a.id === selectedAssignment);

    const handleStartAssessment = async () => {
        if (!selectedAssignment || !user?.id) {
            addToast({
                title: "Missing information",
                variant: "warning",
                description: "Please select an assignment and ensure you're logged in."
            });
            return;
        }

        try {
            setStarting(true);

            // Fetch full assignment details to build context for the AI
            const assignment = await ivasApi.getAssignment(selectedAssignment);

            const assignmentContext: Record<string, unknown> = {
                title: assignment.title,
                description: assignment.description,
                programming_language: assignment.programming_language,
            };

            // Add questions if available
            if (assignment.questions && assignment.questions.length > 0) {
                assignmentContext.questions = assignment.questions.map((q: { question_text: string }) => q.question_text);
            }

            // Add grading criteria if available
            if (assignment.criteria && assignment.criteria.length > 0) {
                assignmentContext.grading_criteria = assignment.criteria.map((c: { description: string | null }) => c.description);
            }

            const session = await ivasApi.createSession({
                assignment_id: selectedAssignment,
                student_id: user.id,
                assignment_context: assignmentContext,
            });

            addToast({
                title: "Session created!",
                variant: "success",
                description: "Redirecting to your viva session..."
            });

            router.push(`/student/assessments/viva/${session.id}`);
        } catch (error) {
            addToast({
                title: "Failed to start assessment",
                variant: "error",
                description: error instanceof Error ? error.message : "Please try again."
            });
        } finally {
            setStarting(false);
        }
    };

    if (!user?.id) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Authentication Required
                        </CardTitle>
                        <CardDescription>
                            Please log in to start a viva assessment.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Start Viva Assessment</h1>
                    <p className="text-sm text-muted-foreground">
                        Select an assignment and begin your AI-powered oral examination.
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Assignment Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Select Assignment
                        </CardTitle>
                        <CardDescription>
                            Choose the assignment you want to be assessed on.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No assignments available.</p>
                                <p className="text-xs">Contact your instructor to create assignments.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="assignment-select">Assignment</Label>
                                <Select
                                    value={selectedAssignment}
                                    onValueChange={setSelectedAssignment}
                                >
                                    <SelectTrigger id="assignment-select" className="w-full">
                                        <SelectValue placeholder="Select an assignment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assignments.map((assignment) => (
                                            <SelectItem
                                                key={assignment.id}
                                                value={assignment.id}
                                            >
                                                {assignment.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedData && (
                                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/60">
                                        <p className="text-xs text-muted-foreground mb-2 font-medium">Selected Assignment:</p>
                                        <p className="text-sm font-semibold">{selectedData.title}</p>
                                        {selectedData.description && (
                                            <p className="text-xs text-muted-foreground mt-1">{selectedData.description}</p>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                {selectedData.programming_language}
                                            </span>
                                            {selectedData.course_id && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                    {selectedData.course_id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Voice Profile Warning */}
                {(!voiceProfileStatus || !voiceProfileStatus.is_complete) && !loading && (
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                Voice profile required
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                You must enroll your voice before starting a viva session. This ensures identity verification during the exam.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 gap-1.5"
                                onClick={() => router.push("/student/assessments/voice-enrollment")}
                            >
                                <Mic2 className="h-3.5 w-3.5" />
                                Enroll Voice
                            </Button>
                        </div>
                    </div>
                )}

                {/* Start Button */}
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={starting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleStartAssessment}
                        disabled={starting || !selectedAssignment || assignments.length === 0 || !voiceProfileStatus?.is_complete}
                        className="gap-2"
                    >
                        {starting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <Mic2 className="h-4 w-4" />
                                Start Voice Viva
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Instructions */}
            <Card className="bg-muted/50 border-dashed">
                <CardHeader>
                    <CardTitle className="text-base">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            1
                        </div>
                        <p className="text-muted-foreground">
                            Select an assignment from the list above. Make sure you&apos;ve completed the required work.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            2
                        </div>
                        <p className="text-muted-foreground">
                            Click &quot;Start Voice Viva&quot; — your browser will connect to the AI examiner via real-time audio.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            3
                        </div>
                        <p className="text-muted-foreground">
                            The AI will ask you questions about your code. Speak naturally — it adapts follow-ups based on your answers.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            4
                        </div>
                        <p className="text-muted-foreground">
                            Your voice is verified during the session. Every score comes with a written justification — nothing is black-box.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
