"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
    Mic2,
    Loader2,
    Search,
    CheckCircle2,
    Clock,
    XCircle,
    Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ivasApi } from "@/lib/ivas-api";
import { useAuthStore } from "@/lib/stores/authStore";
import type { VivaSession, IvasAssignment } from "@/types/ivas";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function StatusBadge({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Completed
            </span>
        );
    }
    if (status === "in_progress" || status === "initializing") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Clock className="h-3 w-3" />
                Active
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <XCircle className="h-3 w-3" />
            {status}
        </span>
    );
}

export default function InstructorDashboardPage() {
    const user = useAuthStore((s) => s.user);

    const [sessions, setSessions] = React.useState<VivaSession[]>([]);
    const [assignments, setAssignments] = React.useState<IvasAssignment[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Filters
    const [studentFilter, setStudentFilter] = React.useState("");
    const [assignmentFilter, setAssignmentFilter] = React.useState("all");
    const [statusFilter, setStatusFilter] = React.useState("all");

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const [sess, asgns] = await Promise.allSettled([
                    ivasApi.listSessions(),
                    ivasApi.listAssignments(),
                ]);
                if (!mounted) return;
                if (sess.status === "fulfilled") setSessions(sess.value);
                if (asgns.status === "fulfilled") setAssignments(asgns.value);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    const assignmentMap = React.useMemo(
        () => new Map(assignments.map(a => [a.id, a.title])),
        [assignments]
    );

    const filteredSessions = React.useMemo(() => {
        return sessions.filter(s => {
            if (studentFilter && !s.student_id.toLowerCase().includes(studentFilter.toLowerCase())) return false;
            if (assignmentFilter !== "all" && s.assignment_id !== assignmentFilter) return false;
            if (statusFilter !== "all" && s.status !== statusFilter) return false;
            return true;
        });
    }, [sessions, studentFilter, assignmentFilter, statusFilter]);

    return (
        <div className="flex flex-col gap-6 pb-8">
            {/* Header */}
            <div className="border-b border-border/40 pb-6">
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <Mic2 className="h-6 w-6" />
                    Viva Sessions Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Monitor all student viva assessment sessions.
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by student ID..."
                        value={studentFilter}
                        onChange={e => setStudentFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Assignment" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Assignments</SelectItem>
                        {assignments.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="initializing">Initializing</SelectItem>
                        <SelectItem value="in_progress">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Sessions table */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                    <Mic2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No sessions found.</p>
                </div>
            ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border/40">
                                <th className="text-left px-4 py-2 font-medium">Date</th>
                                <th className="text-left px-4 py-2 font-medium">Student</th>
                                <th className="text-left px-4 py-2 font-medium">Assignment</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-left px-4 py-2 font-medium">Score</th>
                                <th className="text-right px-4 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSessions.map(s => (
                                <tr key={s.id} className="border-b border-border/20 hover:bg-muted/20">
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {format(new Date(s.started_at), "MMM d, yyyy")}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{s.student_id}</td>
                                    <td className="px-4 py-3">
                                        {assignmentMap.get(s.assignment_id) || s.assignment_id.slice(0, 8)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={s.status} />
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {s.total_score !== null ? `${s.total_score}/${s.max_possible}` : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/instructor/assessments/review/${s.id}`}>
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                Review
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
