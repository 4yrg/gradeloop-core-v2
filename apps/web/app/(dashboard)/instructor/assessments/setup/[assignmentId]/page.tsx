"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Loader2,
    Mic2,
    ChevronDown,
    ChevronUp,
    Save,
    X,
    Trash2,
    CheckCircle2,
    Plus,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ivasApi } from "@/lib/ivas-api";
import type { AssignmentDetail, GradingCriteria, IvasQuestion } from "@/types/ivas";

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: "Beginner", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    2: { label: "Easy", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    3: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    4: { label: "Hard", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    5: { label: "Expert", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function DifficultyBadge({ level }: { level: number }) {
    const info = DIFFICULTY_LABELS[level] || DIFFICULTY_LABELS[3];
    return <Badge variant="outline" className={cn("border-0 text-xs", info.color)}>{info.label}</Badge>;
}

export default function AssessmentSetupPage() {
    const params = useParams<{ assignmentId: string }>();
    const router = useRouter();
    const { addToast } = useToast();
    const assignmentId = params.assignmentId;

    const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
    const [criteria, setCriteria] = React.useState<GradingCriteria[]>([]);
    const [questions, setQuestions] = React.useState<IvasQuestion[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Add criteria form
    const [showAddCriteria, setShowAddCriteria] = React.useState(false);
    const [newCriteriaCompetency, setNewCriteriaCompetency] = React.useState("");
    const [newCriteriaDesc, setNewCriteriaDesc] = React.useState("");
    const [addingCriteria, setAddingCriteria] = React.useState(false);

    // Add question form
    const [showAddQuestion, setShowAddQuestion] = React.useState(false);
    const [newQuestionText, setNewQuestionText] = React.useState("");
    const [newQuestionCompetency, setNewQuestionCompetency] = React.useState("");
    const [addingQuestion, setAddingQuestion] = React.useState(false);

    // Expanded rows
    const [expandedCriteria, setExpandedCriteria] = React.useState<Set<string>>(new Set());
    const [expandedQuestions, setExpandedQuestions] = React.useState<Set<string>>(new Set());

    // Load data
    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const detail = await ivasApi.getAssignment(assignmentId);
                if (!mounted) return;
                setAssignment(detail);
                setCriteria(detail.criteria);
                setQuestions(detail.questions);
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load assignment");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [assignmentId]);

    const refreshData = async () => {
        try {
            const detail = await ivasApi.getAssignment(assignmentId);
            setAssignment(detail);
            setCriteria(detail.criteria);
            setQuestions(detail.questions);
        } catch {
            // Silent refresh failure
        }
    };

    // --- Criteria Actions ---
    const handleAddCriteria = async () => {
        if (!newCriteriaCompetency.trim()) return;
        setAddingCriteria(true);
        try {
            await ivasApi.createCriteria(assignmentId, {
                competency: newCriteriaCompetency.trim(),
                description: newCriteriaDesc.trim() || undefined,
            });
            addToast({ title: "Criteria added", variant: "success" });
            setNewCriteriaCompetency("");
            setNewCriteriaDesc("");
            setShowAddCriteria(false);
            await refreshData();
        } catch (err) {
            addToast({ title: "Failed to add criteria", variant: "error", description: err instanceof Error ? err.message : "" });
        } finally {
            setAddingCriteria(false);
        }
    };

    const handleDeleteCriteria = async (id: string) => {
        try {
            await ivasApi.deleteCriteria(id);
            setCriteria(prev => prev.filter(c => c.id !== id));
            addToast({ title: "Criteria deleted", variant: "success" });
        } catch {
            addToast({ title: "Failed to delete", variant: "error" });
        }
    };

    // --- Question Actions ---
    const handleAddQuestion = async () => {
        if (!newQuestionText.trim()) return;
        setAddingQuestion(true);
        try {
            await ivasApi.createQuestion(assignmentId, {
                question_text: newQuestionText.trim(),
                competency: newQuestionCompetency.trim() || undefined,
            });
            addToast({ title: "Question added", variant: "success" });
            setNewQuestionText("");
            setNewQuestionCompetency("");
            setShowAddQuestion(false);
            await refreshData();
        } catch (err) {
            addToast({ title: "Failed to add question", variant: "error", description: err instanceof Error ? err.message : "" });
        } finally {
            setAddingQuestion(false);
        }
    };

    const handleToggleQuestionStatus = async (q: IvasQuestion) => {
        const newStatus = q.status === "approved" ? "draft" : "approved";
        try {
            const updated = await ivasApi.updateQuestion(q.id, { status: newStatus });
            setQuestions(prev => prev.map(x => x.id === q.id ? updated : x));
        } catch {
            addToast({ title: "Failed to update status", variant: "error" });
        }
    };

    const handleDeleteQuestion = async (id: string) => {
        try {
            await ivasApi.deleteQuestion(id);
            setQuestions(prev => prev.filter(q => q.id !== id));
            addToast({ title: "Question deleted", variant: "success" });
        } catch {
            addToast({ title: "Failed to delete", variant: "error" });
        }
    };

    // Toggle expanded
    const toggleCriteria = (id: string) => setExpandedCriteria(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return next;
    });
    const toggleQuestion = (id: string) => setExpandedQuestions(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return next;
    });

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6 pb-8">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    if (error || !assignment) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error || "Assignment not found."}</p>
                        <Button className="mt-4" variant="outline" onClick={() => router.back()}>Go Back</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-8">
            {/* Header */}
            <div className="border-b border-border/40 pb-6">
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <Mic2 className="h-6 w-6" />
                    Setup: {assignment.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {assignment.programming_language} &middot; {assignment.course_id || "No course"}
                </p>
            </div>

            {/* ===== Grading Criteria ===== */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Grading Criteria</CardTitle>
                        <CardDescription>{criteria.length} criteria defined</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAddCriteria(!showAddCriteria)}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Criteria
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Add form */}
                    {showAddCriteria && (
                        <div className="border border-dashed border-border/60 rounded-lg p-4 space-y-3 bg-muted/30">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Competency</Label>
                                    <Input placeholder="e.g. Recursion" value={newCriteriaCompetency} onChange={e => setNewCriteriaCompetency(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Description (optional)</Label>
                                    <Input placeholder="What to assess" value={newCriteriaDesc} onChange={e => setNewCriteriaDesc(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setShowAddCriteria(false)}><X className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" onClick={handleAddCriteria} disabled={addingCriteria || !newCriteriaCompetency.trim()} className="gap-1">
                                    {addingCriteria ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    )}

                    {criteria.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No criteria yet. Add some to define your rubric.</p>
                    ) : criteria.map(c => (
                        <div key={c.id} className="border border-border/60 rounded-lg">
<div
                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                                onClick={() => toggleCriteria(c.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleCriteria(c.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-medium text-sm">{c.competency}</span>
                                    <DifficultyBadge level={c.difficulty} />
                                    <span className="text-xs text-muted-foreground">max {c.max_score} pts, weight {c.weight}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDeleteCriteria(c.id); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {expandedCriteria.has(c.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            </div>
                            {expandedCriteria.has(c.id) && (
                                <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border/40 pt-2">
                                    {c.description || "No description."}
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* ===== Questions ===== */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Questions</CardTitle>
                        <CardDescription>
                            {questions.filter(q => q.status === "approved").length} approved / {questions.length} total
                        </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAddQuestion(!showAddQuestion)}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Question
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Add form */}
                    {showAddQuestion && (
                        <div className="border border-dashed border-border/60 rounded-lg p-4 space-y-3 bg-muted/30">
                            <div className="space-y-1">
                                <Label className="text-xs">Question Text</Label>
                                <Textarea rows={2} placeholder="e.g. Explain how your function handles edge cases" value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Competency (optional)</Label>
                                <Input placeholder="e.g. Error Handling" value={newQuestionCompetency} onChange={e => setNewQuestionCompetency(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setShowAddQuestion(false)}><X className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" onClick={handleAddQuestion} disabled={addingQuestion || !newQuestionText.trim()} className="gap-1">
                                    {addingQuestion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    Save
                                </Button>
                            </div>
                        </div>
                    )}

                    {questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No questions yet. Add questions for the viva examiner to use.</p>
                    ) : questions.map(q => (
                        <div key={q.id} className="border border-border/60 rounded-lg">
                            <div
                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                                onClick={() => toggleQuestion(q.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleQuestion(q.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{q.question_text}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {q.competency && <Badge variant="secondary" className="text-xs">{q.competency}</Badge>}
                                        <DifficultyBadge level={q.difficulty} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn("h-7 text-xs px-2", q.status === "approved" ? "text-emerald-600" : "text-amber-600")}
                                        onClick={(e) => { e.stopPropagation(); handleToggleQuestionStatus(q); }}
                                    >
                                        {q.status === "approved" ? (
                                            <><CheckCircle2 className="h-3 w-3 mr-1" />Approved</>
                                        ) : (
                                            "Draft"
                                        )}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {expandedQuestions.has(q.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            </div>
                            {expandedQuestions.has(q.id) && (
                                <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border/40 pt-2 space-y-1">
                                    <p><strong>Full text:</strong> {q.question_text}</p>
                                    {q.expected_topics && q.expected_topics.length > 0 && (
                                        <p><strong>Expected topics:</strong> {q.expected_topics.join(", ")}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
