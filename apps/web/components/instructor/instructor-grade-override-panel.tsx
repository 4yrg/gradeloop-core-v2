"use client";

import { useState } from "react";
import type { SubmissionGrade, GradeOverrideRequest } from "@/types/assessments.types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
    PenLine, ChevronDown, Check, AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { acafsApi } from "@/lib/api/assessments";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface InstructorGradeOverridePanelProps {
    grade: SubmissionGrade;
    submissionId: string;
    /** Instructor name/id recorded for audit trail. */
    instructorName: string;
    /** Called after a successful save with the updated grade. */
    onSaved?: (updated: SubmissionGrade) => void;
    className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-criterion override row
// ─────────────────────────────────────────────────────────────────────────────

interface CriterionOverrideState {
    score: string;
    reason: string;
}

function criterionPct(score: number, max: number): number {
    return max > 0 ? Math.round((score / max) * 100) : 0;
}

function scoreBorderClass(pct: number): string {
    if (pct >= 75) return "border-green-200 dark:border-green-800/40";
    if (pct >= 50) return "border-amber-200 dark:border-amber-800/40";
    return "border-red-200 dark:border-red-800/40";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function InstructorGradeOverridePanel({
    grade,
    submissionId,
    instructorName,
    onSaved,
    className,
}: InstructorGradeOverridePanelProps) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Per-criterion override state — keyed by criterion name
    const [criterionOverrides, setCriterionOverrides] = useState<
        Record<string, CriterionOverrideState>
    >(
        Object.fromEntries(
            grade.criteria_scores.map((c) => [
                c.name,
                {
                    score: c.instructor_override_score !== undefined && c.instructor_override_score !== null
                        ? String(c.instructor_override_score)
                        : "",
                    reason: c.instructor_override_reason ?? "",
                },
            ])
        )
    );

    // Grade-level instructor feedback
    const [instructorFeedback, setInstructorFeedback] = useState(
        grade.instructor_holistic_feedback ?? ""
    );

    const updateCriterion = (
        name: string,
        field: keyof CriterionOverrideState,
        value: string
    ) => {
        setCriterionOverrides((prev) => ({
            ...prev,
            [name]: { ...prev[name], [field]: value },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            // Only include criteria where the instructor actually entered a score
            const criteriaOverrides = grade.criteria_scores
                .filter((c) => {
                    const val = criterionOverrides[c.name]?.score.trim();
                    return val !== "" && val !== undefined;
                })
                .map((c) => ({
                    criterion_name: c.name,
                    override_score: parseFloat(criterionOverrides[c.name].score),
                    override_reason: criterionOverrides[c.name].reason.trim() || undefined,
                }));

            const body: GradeOverrideRequest = {
                criteria_overrides: criteriaOverrides.length > 0 ? criteriaOverrides : undefined,
                instructor_holistic_feedback: instructorFeedback.trim() || undefined,
                override_by: instructorName,
            };

            const updated = await acafsApi.overrideGrade(submissionId, body);
            setSaved(true);
            onSaved?.(updated);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save override.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={cn("w-full", className)}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 px-4 py-3",
                        "rounded-xl border border-purple-200 bg-purple-50/60",
                        "dark:border-purple-800/40 dark:bg-purple-900/10",
                        "text-sm font-semibold text-purple-800 dark:text-purple-300",
                        "hover:bg-purple-100/60 dark:hover:bg-purple-900/20 transition-colors"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <PenLine className="h-4 w-4 shrink-0" />
                        <span>Override AI Grade</span>
                        {(grade.instructor_override_score !== undefined && grade.instructor_override_score !== null) && (
                            <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300">
                                Override applied
                            </Badge>
                        )}
                    </div>
                    <ChevronDown
                        className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                    />
                </button>

            {open && (
                <div className="mt-2">
                <div className="rounded-xl border border-purple-200 dark:border-purple-800/40 overflow-hidden">
                    {/* ── Per-criterion overrides ─────────────────────────────── */}
                    <div className="p-4 flex flex-col gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Per-Criterion Scores
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Leave a score field empty to keep the AI-generated score.
                            Enter a value only to override it.
                        </p>

                        {grade.criteria_scores.map((criterion) => {
                            const state = criterionOverrides[criterion.name];
                            const aiScore = criterion.score;
                            const maxScore = criterion.max_score;
                            const aiPct = criterionPct(aiScore, maxScore);
                            const overrideVal = state.score.trim();
                            const overrideNum = overrideVal !== "" ? parseFloat(overrideVal) : NaN;
                            const isInvalid =
                                overrideVal !== "" &&
                                (isNaN(overrideNum) || overrideNum < 0 || overrideNum > maxScore);
                            const isLowConfidence =
                                criterion.confidence !== undefined &&
                                criterion.confidence !== null &&
                                criterion.confidence < 0.6;

                            return (
                                <div
                                    key={criterion.name}
                                    className={cn(
                                        "rounded-lg border p-3 bg-card",
                                        scoreBorderClass(aiPct)
                                    )}
                                >
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm font-semibold">
                                                    {criterion.name}
                                                </span>
                                                {criterion.band_selected && (
                                                    <span className="text-[9px] font-semibold uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                                                        {criterion.band_selected}
                                                    </span>
                                                )}
                                                {isLowConfidence && (
                                                    <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Low confidence — review recommended
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                                {criterion.reason}
                                            </p>
                                        </div>
                                        {/* AI score display */}
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-bold text-muted-foreground">
                                                AI: {aiScore}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {" "}/ {maxScore}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Override inputs */}
                                    <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
                                        <div className="w-28">
                                            <Label className="text-[10px] text-muted-foreground mb-1 block">
                                                Override Score
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={maxScore}
                                                step={0.5}
                                                placeholder={`0 – ${maxScore}`}
                                                value={state.score}
                                                onChange={(e) =>
                                                    updateCriterion(criterion.name, "score", e.target.value)
                                                }
                                                className={cn(
                                                    "h-8 text-sm",
                                                    isInvalid && "border-destructive focus-visible:ring-destructive"
                                                )}
                                            />
                                            {isInvalid && (
                                                <p className="text-[10px] text-destructive mt-0.5">
                                                    Must be 0–{maxScore}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground mb-1 block">
                                                Override Reason (optional)
                                            </Label>
                                            <Input
                                                placeholder="Why did you change this score?"
                                                value={state.reason}
                                                onChange={(e) =>
                                                    updateCriterion(criterion.name, "reason", e.target.value)
                                                }
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Separator />

                    {/* ── Instructor holistic feedback ────────────────────────── */}
                    <div className="p-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Instructor Feedback
                        </p>
                        <p className="text-xs text-muted-foreground">
                            This feedback appears below the AI feedback visible to the student.
                            Leave empty to show only the AI feedback.
                        </p>
                        <Textarea
                            placeholder="Add your instructor comments here…"
                            value={instructorFeedback}
                            onChange={(e) => setInstructorFeedback(e.target.value)}
                            rows={4}
                            className="text-sm resize-none"
                        />
                    </div>

                    <Separator />

                    {/* ── Save row ────────────────────────────────────────────── */}
                    <div className="p-4 flex items-center justify-between gap-3">
                        {error && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                {error}
                            </p>
                        )}
                        {saved && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Check className="h-3.5 w-3.5 shrink-0" />
                                Override saved successfully.
                            </p>
                        )}
                        {!error && !saved && (
                            <p className="text-xs text-muted-foreground">
                                Original AI scores are preserved and never deleted.
                            </p>
                        )}
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-700 dark:hover:bg-purple-600"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <PenLine className="h-3.5 w-3.5 mr-1.5" />
                                    Save Override
                                </>
                            )}
                        </Button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
}
