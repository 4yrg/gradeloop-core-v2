"use client";

import * as React from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import {
    BarChart3,
    Loader2,
    ChevronDown,
    ChevronUp,
    BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/stores/authStore";
import { ivasApi } from "@/lib/ivas-api";
import type { CompetencyScoreOut } from "@/types/ivas";

interface CompetencyGroup {
    competencyId: string;
    competencyName: string;
    maxScore: number;
    bestScore: number;
    assignmentCount: number;
    sessions: CompetencyScoreOut[];
}

function groupCompetencies(scores: CompetencyScoreOut[]): CompetencyGroup[] {
    const byComp = new Map<string, CompetencyScoreOut[]>();
    for (const s of scores) {
        if (s.competency_name === null || s.score === null) continue;
        const key = s.competency_id;
        if (!byComp.has(key)) byComp.set(key, []);
        byComp.get(key)!.push(s);
    }

    const groups: CompetencyGroup[] = [];
    for (const [compId, items] of byComp) {
        const name = items[0].competency_name!;
        const maxScore = items[0].max_score ?? 10;

        const bestByAssignment = new Map<string, CompetencyScoreOut>();
        for (const item of items) {
            if (!item.session_id) continue;
            const existing = bestByAssignment.get(item.session_id);
            if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
                bestByAssignment.set(item.session_id, item);
            }
        }
        const bestItems = [...bestByAssignment.values()];
        const bestScore = bestItems.length > 0
            ? Math.max(...bestItems.map(i => i.score ?? 0))
            : 0;
        const assignmentCount = bestByAssignment.size;

        groups.push({
            competencyId: compId,
            competencyName: name,
            maxScore,
            bestScore,
            assignmentCount,
            sessions: items,
        });
    }

    groups.sort((a, b) => a.competencyName.localeCompare(b.competencyName));
    return groups;
}

function OverallScore({ groups }: { groups: CompetencyGroup[] }) {
    if (groups.length === 0) return null;
    const totalPct = groups.reduce((sum, g) => sum + (g.maxScore > 0 ? (g.bestScore / g.maxScore) * 100 : 0), 0);
    const avgPct = Math.round(totalPct / groups.length);
    const color = avgPct >= 80 ? "text-emerald-600" : avgPct >= 60 ? "text-amber-600" : "text-red-600";
    const label = avgPct >= 80 ? "Excellent" : avgPct >= 60 ? "Good" : "Needs Improvement";

    return (
        <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Average Performance</p>
            <p className={`text-4xl font-black ${color}`}>{avgPct}%</p>
            <p className={`text-sm font-semibold ${color}`}>{label}</p>
        </div>
    );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
    return (
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
    );
}

export default function StudentCompetenciesPage() {
    const user = useAuthStore((s) => s.user);
    const studentId = user?.id || "";

    const [scores, setScores] = React.useState<CompetencyScoreOut[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!studentId) return;
        let mounted = true;
        ivasApi.listStudentCompetencyScores(studentId)
            .then(data => { if (mounted) setScores(data); })
            .catch(() => {})
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [studentId]);

    const groups = React.useMemo(() => groupCompetencies(scores), [scores]);

    const radarData = React.useMemo(() =>
        groups.map(g => ({
            competency: g.competencyName.length > 18 ? g.competencyName.slice(0, 15) + "..." : g.competencyName,
            score: g.maxScore > 0 ? Math.round((g.bestScore / g.maxScore) * 100) : 0,
            fullMark: 100,
        })),
        [groups]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (scores.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
                <BarChart3 className="h-10 w-10 text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-1">No competency scores yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                    Complete a viva session to see your competency performance here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-8 max-w-4xl mx-auto px-4 lg:px-6">
            <div className="border-b border-border/40 pb-4">
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    My Competencies
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track your performance across all viva assessments. Each competency shows your best score.
                </p>
            </div>

            {groups.length >= 3 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start gap-8">
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height={300}>
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
                                            name="Score"
                                            dataKey="score"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary))"
                                            fillOpacity={0.2}
                                            strokeWidth={2}
                                        />
                                        <Tooltip
                                            formatter={(value) => [`${value}%`, "Score"]}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="shrink-0 pt-8">
                                <OverallScore groups={groups} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                {groups.map(g => {
                    const pct = g.maxScore > 0 ? (g.bestScore / g.maxScore) * 100 : 0;
                    const colorClass = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
                    const isExpanded = expandedId === g.competencyId;

                    return (
                        <Card key={g.competencyId} className="transition-colors hover:bg-muted/30">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold leading-tight">
                                        {g.competencyName}
                                    </CardTitle>
                                    <span className={`text-lg font-black ${colorClass}`}>
                                        {g.maxScore > 0 ? Math.round(g.bestScore) : 0}
                                        <span className="text-xs font-normal text-muted-foreground">/{g.maxScore}</span>
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                                <ScoreBar score={g.bestScore} maxScore={g.maxScore} />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        {g.assignmentCount} session{g.assignmentCount !== 1 ? "s" : ""}
                                    </span>
                                    {g.sessions.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1 text-xs h-6 px-2"
                                            onClick={() => setExpandedId(isExpanded ? null : g.competencyId)}
                                        >
                                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            Details
                                        </Button>
                                    )}
                                </div>
                                {isExpanded && (
                                    <div className="border-t border-border/40 pt-2 space-y-1.5 mt-1">
                                        {g.sessions.map(s => (
                                            <div key={s.id} className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground truncate mr-2">
                                                    {new Date(s.created_at).toLocaleDateString()}
                                                </span>
                                                <span className={`font-semibold ${s.score !== null && s.max_score !== null && s.max_score > 0
                                                    ? ((s.score / s.max_score) * 100) >= 80
                                                        ? "text-emerald-600"
                                                        : ((s.score / s.max_score) * 100) >= 60
                                                            ? "text-amber-600"
                                                            : "text-red-600"
                                                    : ""
                                                }`}>
                                                    {s.score !== null ? Math.round(s.score) : "—"}
                                                    <span className="text-muted-foreground font-normal">/{s.max_score ?? 10}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}