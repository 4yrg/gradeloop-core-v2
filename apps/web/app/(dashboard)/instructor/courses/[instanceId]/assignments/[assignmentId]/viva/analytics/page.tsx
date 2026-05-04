"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    BarChart3,
    BookOpen,
    AlertCircle,
    Users,
    TrendingDown,
    Search,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ivasApi } from "@/lib/ivas-api";
import type { CompetencyScoreSummary } from "@/types/ivas";

function ScoreCell({ avg, max }: { avg: number | null; max: number }) {
    if (avg === null) {
        return <span className="text-xs text-muted-foreground italic">No data</span>;
    }
    const pct = max > 0 ? (avg / max) * 100 : 0;
    const color =
        pct >= 80 ? "text-emerald-600" :
        pct >= 60 ? "text-amber-600" :
        "text-red-600";
    return (
        <span className={`font-bold text-sm ${color}`}>
            {Math.round(avg)}<span className="text-xs font-normal text-muted-foreground">/{max}</span>
        </span>
    );
}

export default function VivaAnalyticsPage() {
    const params = useParams();
    const assignmentId = params.assignmentId as string;
    const instanceId = params.instanceId as string;
    const basePath = `/instructor/courses/${instanceId}/assignments/${assignmentId}`;

    const [scores, setScores] = React.useState<CompetencyScoreSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filters
    const [competencyFilter, setCompetencyFilter] = React.useState("all");
    const [studentSearch, setStudentSearch] = React.useState("");
    const [lowScoringOnly, setLowScoringOnly] = React.useState(false);

    // Expandable rows
    const [expandedStudents, setExpandedStudents] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                setLoading(true);
                const data = await ivasApi.listCompetencyScoresForAssignment(assignmentId);
                if (mounted) setScores(data);
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : "Failed to load analytics");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [assignmentId]);

    // Derive unique competencies and students
    const competencyIds = React.useMemo(() => {
        return [...new Set(scores.map(s => s.competency_id))];
    }, [scores]);

    // Pivot scores by student
    const scoresByStudent = React.useMemo(() => {
        const map = new Map<string, CompetencyScoreSummary[]>();
        for (const s of scores) {
            if (!map.has(s.student_id)) map.set(s.student_id, []);
            map.get(s.student_id)!.push(s);
        }
        return map;
    }, [scores]);

    // Low-scoring students per competency (user story 9)
    const lowScoringByCompetency = React.useMemo(() => {
        const map = new Map<string, CompetencyScoreSummary[]>();
        for (const s of scores) {
            if (s.avg_score === null) continue;
            const pct = s.max_score > 0 ? (s.avg_score / s.max_score) * 100 : 0;
            if (pct < 60) {
                if (!map.has(s.competency_id)) map.set(s.competency_id, []);
                map.get(s.competency_id)!.push(s);
            }
        }
        return map;
    }, [scores]);

    if (loading) {
        return (
            <div className="flex flex-col gap-6 pb-8">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

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
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    Viva Analytics
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track student performance across competencies and identify knowledge gaps.
                </p>
            </div>

            {error && (
                <div className="flex gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Cohort Gaps — students scoring low on each competency (User Story 9) */}
            {lowScoringByCompetency.size > 0 && (
                <Card className="border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                            <TrendingDown className="h-4 w-4" />
                            Knowledge Gaps — Students Needing Support
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Array.from(lowScoringByCompetency.entries()).map(([compId, studentList]) => {
                            const compName = studentList[0]?.competency_name ?? compId;
                            return (
                                <div key={compId} className="border-b border-red-200/30 dark:border-red-900/20 last:border-0 pb-3 last:pb-0">
                                    <p className="text-sm font-semibold mb-2">{compName}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {studentList.map(s => (
                                            <div key={s.student_id} className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-lg px-3 py-1.5 border border-red-200 dark:border-red-900/40">
                                                <Users className="h-3.5 w-3.5 text-red-500" />
                                                <span className="text-xs font-mono font-medium">{s.student_id}</span>
                                                <ScoreCell avg={s.avg_score} max={s.max_score} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by student ID..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={competencyFilter} onValueChange={setCompetencyFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All Competencies" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Competencies</SelectItem>
                        {competencyIds.map(cid => {
                            const comp = scores.find(s => s.competency_id === cid);
                            return (
                                <SelectItem key={cid} value={cid}>
                                    {comp?.competency_name ?? cid}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                <Button
                    variant={lowScoringOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLowScoringOnly(v => !v)}
                    className="gap-1.5"
                >
                    <TrendingDown className="h-4 w-4" />
                    Low Scores Only
                </Button>
            </div>

            {/* Per-Student Competency Breakdown (User Story 6 & 8) */}
            {scores.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No competency scores available yet.</p>
                    <p className="text-xs mt-1">Scores appear after students complete viva sessions.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {[...scoresByStudent.entries()].map(([studentId, studentScores]) => {
                        const isExpanded = expandedStudents.has(studentId);
                        return (
                            <Card key={studentId}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-mono font-semibold text-sm">{studentId}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {studentScores.filter(s => s.has_override).length > 0 && (
                                                    <Badge variant="outline" className="text-xs ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                                                        Has Overrides
                                                    </Badge>
                                                )}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setExpandedStudents(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(studentId)) next.delete(studentId);
                                                    else next.add(studentId);
                                                    return next;
                                                });
                                            }}
                                            className="gap-1"
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            {studentScores.length} competencies
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    {/* Summary row */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        {studentScores
                                            .filter(s => competencyFilter === "all" || s.competency_id === competencyFilter)
                                            .filter(s => !studentSearch || s.student_id.toLowerCase().includes(studentSearch.toLowerCase()))
                                            .map(s => (
                                                <div key={s.competency_id} className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-muted-foreground">{s.competency_name}</span>
                                                    <ScoreCell avg={s.avg_score} max={s.max_score} />
                                                </div>
                                            ))}
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="mt-4 border-t border-border/40 pt-4 space-y-3">
                                            {studentScores.map(s => {
                                                const pct = s.avg_score !== null && s.max_score > 0
                                                    ? Math.round((s.avg_score / s.max_score) * 100)
                                                    : null;
                                                return (
                                                    <div key={s.competency_id} className="flex items-start gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="text-sm font-medium">{s.competency_name}</span>
                                                                {s.has_override && (
                                                                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                                                                        Override
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                                {pct !== null && (
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${
                                                                            pct >= 80 ? "bg-emerald-500" :
                                                                            pct >= 60 ? "bg-amber-500" :
                                                                            "bg-red-500"
                                                                        }`}
                                                                        style={{ width: `${pct}%` }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <ScoreCell avg={s.avg_score} max={s.max_score} />
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {s.session_count} session{s.session_count !== 1 ? "s" : ""}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
