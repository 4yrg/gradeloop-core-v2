"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    BookOpen,
    Plus,
    Trash2,
    Wand2,
    Edit2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Save,
    X,
    BarChart3,
    Users,
} from "lucide-react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ivasApi } from "@/lib/ivas-api";
import { instructorAssessmentsApi } from "@/lib/api/assessments";

import type {
    CompetencyOut,
    CompetencyAssignmentLinkOut,
    GeneratedCompetency,
    CompetencyScoreSummary,
} from "@/types/ivas";

function DifficultyBadge({ difficulty }: { difficulty: number }) {
    if (difficulty >= 3) {
        return (
            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
                Advanced
            </Badge>
        );
    }
    if (difficulty >= 2) {
        return (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                Intermediate
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
            Beginner
        </Badge>
    );
}

function CompetencyDashboard({
    scores,
    loading,
    error,
}: {
    scores: CompetencyScoreSummary[];
    loading: boolean;
    error: string | null;
}) {
    const uniqueCompetencies = React.useMemo(() => {
        const map = new Map<string, { id: string; name: string; maxScore: number }>();
        for (const s of scores) {
            if (!map.has(s.competency_id)) {
                map.set(s.competency_id, { id: s.competency_id, name: s.competency_name, maxScore: s.max_score });
            }
        }
        return [...map.values()];
    }, [scores]);

    const uniqueStudents = React.useMemo(() => [...new Set(scores.map(s => s.student_id))], [scores]);

    const byStudent = React.useMemo(() => {
        const map = new Map<string, CompetencyScoreSummary[]>();
        for (const s of scores) {
            if (!map.has(s.student_id)) map.set(s.student_id, []);
            map.get(s.student_id)!.push(s);
        }
        return map;
    }, [scores]);

    const radarData = React.useMemo(() =>
        uniqueCompetencies.map(c => {
            const compScores = scores.filter(s => s.competency_id === c.id && s.avg_score !== null);
            const avg = compScores.length > 0
                ? compScores.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / compScores.length
                : 0;
            const max = c.maxScore > 0 ? c.maxScore : 10;
            return {
                competency: c.name.length > 16 ? c.name.slice(0, 13) + "..." : c.name,
                score: Math.round((avg / max) * 100),
                fullMark: 100,
            };
        }),
        [uniqueCompetencies, scores]
    );

    const classAvg = React.useMemo(() => {
        if (scores.length === 0) return 0;
        const withScores = scores.filter(s => s.avg_score !== null);
        if (withScores.length === 0) return 0;
        return Math.round(withScores.reduce((sum, s) => sum + ((s.avg_score ?? 0) / (s.max_score || 10)) * 100, 0) / withScores.length);
    }, [scores]);

    const gapsCount = React.useMemo(() =>
        scores.filter(s => s.avg_score !== null && s.max_score > 0 && ((s.avg_score ?? 0) / s.max_score) * 100 < 60).length,
        [scores]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
            </div>
        );
    }

    if (scores.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No competency scores available yet.</p>
                <p className="text-xs mt-1">Scores appear after students complete viva sessions.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Class Average</p>
                        <p className={`text-2xl font-black ${classAvg >= 80 ? "text-emerald-600" : classAvg >= 60 ? "text-amber-600" : "text-red-600"}`}>
                            {classAvg}%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Students</p>
                        <p className="text-2xl font-black">{uniqueStudents.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Competencies</p>
                        <p className="text-2xl font-black">{uniqueCompetencies.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Knowledge Gaps</p>
                        <p className={`text-2xl font-black ${gapsCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {gapsCount}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Radar chart */}
            {uniqueCompetencies.length >= 3 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Class Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis
                                    dataKey="competency"
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <PolarRadiusAxis
                                    angle={90}
                                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                                    domain={[0, 100]}
                                />
                                <Radar
                                    name="Class Avg"
                                    dataKey="score"
                                    stroke="hsl(var(--primary))"
                                    fill="hsl(var(--primary))"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                                <Tooltip formatter={(value) => [`${value}%`, "Avg"]} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Per-competency bar chart */}
            {uniqueCompetencies.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Competency Averages</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={Math.max(200, uniqueCompetencies.length * 50)}>
                            <BarChart layout="vertical" data={uniqueCompetencies.map(c => {
                                const compScores = scores.filter(s => s.competency_id === c.id && s.avg_score !== null);
                                const avg = compScores.length > 0
                                    ? compScores.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / compScores.length
                                    : 0;
                                return { name: c.name, avg: Math.round(avg * 10) / 10, max: c.maxScore };
                            })} margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => [`${value}`, "Avg Score"]} />
                                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Avg Score" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Per-student breakdown */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Student Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...byStudent.entries()].map(([studentId, studentScores]) => {
                        const totalPct = studentScores.reduce((sum, s) => {
                            return sum + (s.max_score > 0 && s.avg_score !== null ? ((s.avg_score ?? 0) / s.max_score) * 100 : 0);
                        }, 0);
                        const avgPct = studentScores.length > 0 ? Math.round(totalPct / studentScores.length) : 0;

                        return (
                            <div key={studentId} className="border border-border/40 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-semibold text-sm">{studentId}</span>
                                    <span className={`text-sm font-bold ${avgPct >= 80 ? "text-emerald-600" : avgPct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                        {avgPct}% avg
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {studentScores.map(s => {
                                        const pct = s.avg_score !== null && s.max_score > 0 ? (s.avg_score / s.max_score) * 100 : 0;
                                        const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
                                        return (
                                            <div key={s.competency_id} className="flex items-center gap-3">
                                                <span className="text-xs font-medium text-muted-foreground w-32 truncate">{s.competency_name}</span>
                                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className="text-xs font-semibold w-12 text-right">
                                                    {s.avg_score !== null ? Math.round(s.avg_score) : "—"}
                                                    <span className="text-muted-foreground">/{s.max_score}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}

export default function CompetenciesPage() {
    const params = useParams();
    const assignmentId = params.assignmentId as string;
    const instanceId = params.instanceId as string;
    const basePath = `/instructor/courses/${instanceId}/assignments/${assignmentId}`;

    const [activeTab, setActiveTab] = React.useState<"setup" | "dashboard">("setup");

    // Dashboard state
    const [dashScores, setDashScores] = React.useState<CompetencyScoreSummary[]>([]);
    const [dashLoading, setDashLoading] = React.useState(false);
    const [dashError, setDashError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (activeTab !== "dashboard") return;
        let mounted = true;
        setDashLoading(true);
        ivasApi.listCompetencyScoresForAssignment(assignmentId)
            .then(data => { if (mounted) setDashScores(data); })
            .catch(err => { if (mounted) setDashError(err instanceof Error ? err.message : "Failed to load scores"); })
            .finally(() => { if (mounted) setDashLoading(false); });
        return () => { mounted = false; };
    }, [activeTab, assignmentId]);

    const [linkedCompetencies, setLinkedCompetencies] = React.useState<CompetencyAssignmentLinkOut[]>([]);
    const [allCompetencies, setAllCompetencies] = React.useState<CompetencyOut[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // AI generation
    const [generating, setGenerating] = React.useState(false);
    const [genResults, setGenResults] = React.useState<GeneratedCompetency[]>([]);
    const [showGenModal, setShowGenModal] = React.useState(false);
    const [addingName, setAddingName] = React.useState<string | null>(null);
    const [addedNames, setAddedNames] = React.useState<Set<string>>(new Set());

    // Add/edit form
    const [showForm, setShowForm] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [formName, setFormName] = React.useState("");
    const [formDescription, setFormDescription] = React.useState("");
    const [formDifficulty, setFormDifficulty] = React.useState(1);
    const [formMaxScore, setFormMaxScore] = React.useState(10);
    const [formWeight, setFormWeight] = React.useState(1.0);
    const [saving, setSaving] = React.useState(false);
    const weightDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Delete
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    // Delete global competency (from "Add from Course Competencies" section)
    const [deleteGlobalId, setDeleteGlobalId] = React.useState<string | null>(null);
    const [deletingGlobal, setDeletingGlobal] = React.useState(false);

    async function handleDeleteGlobalCompetency() {
        if (!deleteGlobalId) return;
        setDeletingGlobal(true);
        try {
            await ivasApi.deleteCompetency(deleteGlobalId);
            setAllCompetencies(prev => prev.filter(c => c.id !== deleteGlobalId));
            setLinkedCompetencies(prev => prev.filter(c => c.competency_id !== deleteGlobalId));
            setDeleteGlobalId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete competency");
        } finally {
            setDeletingGlobal(false);
        }
    }

    // Difficulty distribution
    const [distBeginner, setDistBeginner] = React.useState(0);
    const [distIntermediate, setDistIntermediate] = React.useState(0);
    const [distAdvanced, setDistAdvanced] = React.useState(0);

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                setLoading(true);
                const [linked, all] = await Promise.all([
                    ivasApi.listAssignmentCompetencies(assignmentId),
                    ivasApi.listCompetencies(),
                ]);
                if (!mounted) return;
                setLinkedCompetencies(linked);
                setAllCompetencies(all);

                // Compute difficulty distribution from linked competencies
                const counts = { 1: 0, 2: 0, 3: 0 };
                for (const c of linked) {
                    if (c.difficulty in counts) counts[c.difficulty as 1 | 2 | 3]++;
                }
                setDistBeginner(counts[1]);
                setDistIntermediate(counts[2]);
                setDistAdvanced(counts[3]);
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load competencies");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [assignmentId]);

    // Generate AI competencies
    async function handleGenerate() {
        try {
            setGenerating(true);
            setError(null);
            // Use the instructor-scoped endpoint which allows instructor access.
            // The general GET /assignments/:id requires admin role, so we fetch
            // via /instructor-assignments/me and find our assignment by ID.
            const myAssignments = await instructorAssessmentsApi.listMyAssignments(instanceId);
            const assignment = myAssignments.find(a => a.id === assignmentId);
            if (!assignment) {
                throw new Error("Assignment not found. Make sure you are the instructor for this assignment.");
            }
            const result = await ivasApi.generateCompetencies({
                assignment_id: assignmentId,
                code_context: assignment.code || undefined,
                description: assignment.description || undefined,
                title: assignment.title,
            });
            if (result.competencies.length === 0) {
                setError("AI did not generate any competencies. Try adding more context to the assignment (title, description, or code).");
            } else {
                setGenResults(result.competencies);
                setAddedNames(new Set());
                setShowGenModal(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Generation failed");
        } finally {
            setGenerating(false);
        }
    }

    async function handleAddGenerated(generated: GeneratedCompetency) {
        if (addingName || addedNames.has(generated.name)) return;
        setAddingName(generated.name);
        try {
            const created = await ivasApi.createCompetency(
                generated.name,
                generated.description,
                generated.difficulty,
                generated.max_score
            );
            // Link to assignment
            const linked = await ivasApi.setAssignmentCompetencies(assignmentId, {
                competencies: [
                    ...linkedCompetencies.map(c => ({ competency_id: c.competency_id, weight: c.weight })),
                    { competency_id: created.id, weight: generated.weight },
                ],
            });
            setLinkedCompetencies(linked);
            setAllCompetencies(prev => [...prev, created]);
            setAddedNames(prev => new Set(prev).add(generated.name));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add competency");
        } finally {
            setAddingName(null);
        }
    }

    function handleEditLink(competency: CompetencyAssignmentLinkOut) {
        setEditingId(competency.competency_id);
        setFormName(competency.name);
        setFormDescription(competency.description || "");
        setFormDifficulty(competency.difficulty);
        setFormMaxScore(competency.max_score);
        setFormWeight(competency.weight);
        setShowForm(true);
    }

    async function handleSaveEdit() {
        if (!editingId) return;
        try {
            setSaving(true);
            // Update the competency by ID
            await ivasApi.updateCompetency(editingId, formName, formDescription, formDifficulty, formMaxScore);

            // Update the weight on the assignment link
            const updated = linkedCompetencies.map(c =>
                c.competency_id === editingId
                    ? { ...c, weight: formWeight }
                    : c
            );
            const linked = await ivasApi.setAssignmentCompetencies(assignmentId, {
                competencies: updated.map(c => ({ competency_id: c.competency_id, weight: c.weight })),
            });
            setLinkedCompetencies(linked);
            setAllCompetencies(prev => prev.map(c =>
                c.id === editingId
                    ? { ...c, name: formName, description: formDescription, difficulty: formDifficulty, max_score: formMaxScore }
                    : c
            ));
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteLink(competencyId: string) {
        try {
            const remaining = linkedCompetencies.filter(c => c.competency_id !== competencyId);
            await ivasApi.setAssignmentCompetencies(assignmentId, {
                competencies: remaining.map(c => ({ competency_id: c.competency_id, weight: c.weight })),
            });
            setLinkedCompetencies(remaining);
            setDeleteId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed");
        }
    }

    async function handleCreateGlobal() {
        try {
            setSaving(true);
            const created = await ivasApi.createCompetency(formName, formDescription, formDifficulty, formMaxScore);
            const linked = await ivasApi.setAssignmentCompetencies(assignmentId, {
                competencies: [
                    ...linkedCompetencies.map(c => ({ competency_id: c.competency_id, weight: c.weight })),
                    { competency_id: created.id, weight: formWeight },
                ],
            });
            setLinkedCompetencies(linked);
            setAllCompetencies(prev => [...prev, created]);
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Create failed");
        } finally {
            setSaving(false);
        }
    }

    function resetForm() {
        setShowForm(false);
        setEditingId(null);
        setFormName("");
        setFormDescription("");
        setFormDifficulty(1);
        setFormMaxScore(10);
        setFormWeight(1.0);
    }

    const unlinkedCompetencies = allCompetencies.filter(
        c => !linkedCompetencies.find(l => l.competency_id === c.id)
    );

    return (
        <div className="flex flex-col gap-6 pb-8">
            {/* Header */}
            <div className="border-b border-border/40 pb-4">
                <div className="flex items-center gap-2 mb-4">
                    <Button variant="ghost" size="sm" asChild className="gap-1">
                        <Link href={`${basePath}/viva`}>
                            ← Back to Viva Sessions
                        </Link>
                    </Button>
                </div>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <BookOpen className="h-6 w-6" />
                            Competencies
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeTab === "setup"
                                ? "Manage the conceptual rubric for this assignment's viva. Competencies are reusable course-wide concepts."
                                : "Track student performance across competencies for this assignment."}
                        </p>
                    </div>
                    {activeTab === "setup" && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Add Competency
                            </Button>
                            <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                Generate with AI
                            </Button>
                        </div>
                    )}
                </div>
                {/* Tab switcher */}
                <div className="flex items-center gap-1 mt-4 border-b border-border/40 -mb-4">
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "setup"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setActiveTab("setup")}
                    >
                        <BookOpen className="h-3.5 w-3.5 inline mr-1.5" />
                        Setup
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "dashboard"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />
                        Dashboard
                    </button>
                </div>
            </div>

            {activeTab === "dashboard" ? (
                /* ====== DASHBOARD TAB ====== */
                <CompetencyDashboard scores={dashScores} loading={dashLoading} error={dashError} />
            ) : (
            <>
            {error && (
                <div className="flex gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Difficulty Distribution */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Difficulty Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Beginner</span>
                            <span className="font-bold text-lg">{distBeginner}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Intermediate</span>
                            <span className="font-bold text-lg">{distIntermediate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Advanced</span>
                            <span className="font-bold text-lg">{distAdvanced}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-auto">
                            Used in viva question selection
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Competencies Table */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
            ) : linkedCompetencies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm mb-2">No competencies configured for this assignment.</p>
                    <p className="text-xs">Generate with AI or add manually to get started.</p>
                </div>
            ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border/40">
                                <th className="text-left px-4 py-2.5 font-medium">Competency</th>
                                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                                <th className="text-left px-4 py-2.5 font-medium">Difficulty</th>
                                <th className="text-left px-4 py-2.5 font-medium">Weight</th>
                                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linkedCompetencies.map(c => (
                                <tr key={c.competency_id} className="border-b border-border/20 hover:bg-muted/20">
                                    <td className="px-4 py-3">
                                        <span className="font-semibold text-sm">{c.name}</span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">
                                        {c.description || <span className="italic">No description</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <DifficultyBadge difficulty={c.difficulty} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={10}
                                            step={0.1}
                                            value={c.weight}
                                            onChange={(e) => {
                                                const newWeight = parseFloat(e.target.value);
                                                const updated = linkedCompetencies.map(lc =>
                                                    lc.competency_id === c.competency_id
                                                        ? { ...lc, weight: newWeight }
                                                        : lc
                                                );
                                                setLinkedCompetencies(updated);
                                                if (weightDebounceRef.current) {
                                                    clearTimeout(weightDebounceRef.current);
                                                }
                                                weightDebounceRef.current = setTimeout(() => {
                                                    ivasApi.setAssignmentCompetencies(assignmentId, {
                                                        competencies: updated.map(lc => ({ competency_id: lc.competency_id, weight: lc.weight })),
                                                    }).catch((err: unknown) => {
                                                        setError(err instanceof Error ? err.message : "Failed to update weight");
                                                    });
                                                }, 500);
                                            }}
                                            className="w-20 h-8 text-xs text-center"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditLink(c)} className="gap-1">
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteId(c.competency_id)}
                                                className="gap-1 text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Unlinked global competencies */}
            {unlinkedCompetencies.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Add from Course Competencies</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {unlinkedCompetencies.map(c => (
                            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate">{c.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <DifficultyBadge difficulty={c.difficulty} />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            try {
                                                const linked = await ivasApi.setAssignmentCompetencies(assignmentId, {
                                                    competencies: [
                                                        ...linkedCompetencies.map(lc => ({ competency_id: lc.competency_id, weight: lc.weight })),
                                                        { competency_id: c.id, weight: 1 },
                                                    ],
                                                });
                                                setLinkedCompetencies(linked);
                                            } catch (err) {
                                                setError(err instanceof Error ? err.message : "Failed to add");
                                            }
                                        }}
                                        className="gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteGlobalId(c.id)}
                                        className="gap-1 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Competency Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background rounded-xl border border-border/60 shadow-xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                            <h2 className="text-lg font-bold">
                                {editingId ? "Edit Competency" : "New Competency"}
                            </h2>
                            <Button variant="ghost" size="sm" onClick={resetForm}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="e.g. Recursion"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="What does this competency assess?"
                                    className="resize-none min-h-[80px]"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Difficulty</Label>
                                    <select
                                        value={formDifficulty}
                                        onChange={e => setFormDifficulty(parseInt(e.target.value))}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value={1}>Beginner</option>
                                        <option value={2}>Intermediate</option>
                                        <option value={3}>Advanced</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Score</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={formMaxScore}
                                        onChange={e => setFormMaxScore(parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Weight</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={formWeight}
                                        onChange={e => setFormWeight(parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/40">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button
                                onClick={editingId ? handleSaveEdit : handleCreateGlobal}
                                disabled={!formName.trim() || saving}
                                className="gap-1.5"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {editingId ? "Save Changes" : "Create & Add"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Generation Results Modal */}
            {showGenModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background rounded-xl border border-border/60 shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 sticky top-0 bg-background">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Wand2 className="h-5 w-5" />
                                    AI-Generated Competencies
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Review and add the competencies you want to use for this assignment.
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setShowGenModal(false); setGenResults([]); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            {genResults.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-sm">No competencies generated. Try again with more assignment context.</p>
                                </div>
                            ) : (
                                genResults.map((gen, idx) => (
                                    <div key={idx} className="border border-border/60 rounded-xl p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{gen.name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{gen.description}</p>
                                            </div>
                                            <DifficultyBadge difficulty={gen.difficulty} />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>Max: {gen.max_score}</span>
                                                <span>·</span>
                                                <span>Weight: {gen.weight}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleAddGenerated(gen)}
                                                disabled={addingName === gen.name || addedNames.has(gen.name)}
                                                className="ml-auto gap-1"
                                            >
                                                {addingName === gen.name ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</>
                                                ) : addedNames.has(gen.name) ? (
                                                    <><CheckCircle2 className="h-3.5 w-3.5" />Added</>
                                                ) : (
                                                    <><Plus className="h-3.5 w-3.5" />Add</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end px-6 py-4 border-t border-border/40">
                            <Button variant="outline" onClick={() => { setShowGenModal(false); setGenResults([]); }}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation (unlink from assignment) */}
            <ConfirmDialog
                open={deleteId !== null}
                onOpenChange={open => { if (!open) setDeleteId(null); }}
                title="Remove Competency"
                description="Remove this competency from the assignment? Students will no longer be assessed on this concept."
                confirmText="Remove"
                variant="destructive"
                onConfirm={() => {
                    if (deleteId) handleDeleteLink(deleteId);
                }}
            />

            {/* Delete Global Competency Confirmation (permanent delete) */}
            <ConfirmDialog
                open={deleteGlobalId !== null}
                onOpenChange={open => { if (!open) setDeleteGlobalId(null); }}
                title="Delete Competency"
                description="Permanently delete this competency? It will be removed from all assignments and cannot be recovered."
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDeleteGlobalCompetency}
                isLoading={deletingGlobal}
            />
            </>
            )}
        </div>
    );
}
