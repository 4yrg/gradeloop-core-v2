"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    BookOpen,
    Plus,
    Trash2,
    Wand2,
    Edit2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Save,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ivasApi } from "@/lib/ivas-api";
import { instructorAssessmentsApi } from "@/lib/api/assessments";

import type {
    CompetencyOut,
    CompetencyAssignmentLinkOut,
    GeneratedCompetency,
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

interface EditableCompetency {
    competency_id: string;
    name: string;
    description: string;
    difficulty: number;
    max_score: number;
    weight: number;
    isNew?: boolean;
    isEditing?: boolean;
}

export default function CompetenciesPage() {
    const params = useParams();
    const router = useRouter();
    const assignmentId = params.assignmentId as string;
    const instanceId = params.instanceId as string;
    const basePath = `/instructor/courses/${instanceId}/assignments/${assignmentId}`;

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

    // Delete
    const [deleteId, setDeleteId] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);

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
            setDeleting(true);
            const remaining = linkedCompetencies.filter(c => c.competency_id !== competencyId);
            await ivasApi.setAssignmentCompetencies(assignmentId, {
                competencies: remaining.map(c => ({ competency_id: c.competency_id, weight: c.weight })),
            });
            setLinkedCompetencies(remaining);
            setDeleteId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed");
        } finally {
            setDeleting(false);
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
            <div className="border-b border-border/40 pb-6">
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
                            Manage the conceptual rubric for this assignment&apos;s viva. Competencies are reusable course-wide concepts.
                        </p>
                    </div>
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
                </div>
            </div>

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
                                            onChange={async (e) => {
                                                const newWeight = parseFloat(e.target.value);
                                                const updated = linkedCompetencies.map(lc =>
                                                    lc.competency_id === c.competency_id
                                                        ? { ...lc, weight: newWeight }
                                                        : lc
                                                );
                                                setLinkedCompetencies(updated);
                                                await ivasApi.setAssignmentCompetencies(assignmentId, {
                                                    competencies: updated.map(lc => ({ competency_id: lc.competency_id, weight: lc.weight })),
                                                });
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
        </div>
    );
}
