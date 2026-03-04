"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    BookOpen,
    FileText,
    Calendar,
    ArrowRight,
    Clock,
    Loader2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/authStore";
import { studentCoursesApi } from "@/lib/api/academics";
import { assessmentApi } from "@/lib/api/assessments";
import type { Assignment } from "@/types/assessment.types";

interface UpcomingAssignment extends Assignment {
    course_title: string;
    course_code: string;
}

function formatRelativeDue(dateStr: string): { label: string; urgent: boolean } {
    const due = new Date(dateStr);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "Overdue", urgent: true };
    if (diffDays === 0) return { label: "Due today", urgent: true };
    if (diffDays === 1) return { label: "Due tomorrow", urgent: true };
    if (diffDays <= 3) return { label: `Due in ${diffDays} days`, urgent: true };
    return {
        label: due.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        urgent: false,
    };
}

export default function StudentDashboardPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [loading, setLoading] = React.useState(true);
    const [courseCount, setCourseCount] = React.useState(0);
    const [totalAssignments, setTotalAssignments] = React.useState(0);
    const [upcomingAssignments, setUpcomingAssignments] = React.useState<UpcomingAssignment[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const courses = await studentCoursesApi.listMyCourses();
                if (cancelled) return;
                setCourseCount(courses.length);

                const results = await Promise.allSettled(
                    courses.map((c) =>
                        assessmentApi
                            .getAssignmentsByCourseInstance(c.course_instance_id)
                            .then((res) =>
                                (res.assignments ?? []).map((a) => ({
                                    ...a,
                                    course_title: c.course_title,
                                    course_code: c.course_code,
                                }))
                            )
                    )
                );
                if (cancelled) return;

                const all: UpcomingAssignment[] = results.flatMap((r) =>
                    r.status === "fulfilled" ? r.value : []
                );
                const now = new Date();
                const upcoming = all
                    .filter((a) => a.due_at && new Date(a.due_at) >= now)
                    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

                setTotalAssignments(all.length);
                setUpcomingAssignments(upcoming.slice(0, 5));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const firstName = user?.full_name?.split(" ")[0] ?? "Student";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {firstName}
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    Here&apos;s a summary of your academic progress and upcoming work.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{courseCount}</div>
                                <p className="text-xs text-zinc-500 mt-1">Active course instances</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card
                    className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push("/student/assignments")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                        <FileText className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{totalAssignments}</div>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {upcomingAssignments.length} upcoming deadline{upcomingAssignments.length !== 1 ? "s" : ""}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
                        <Clock className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{upcomingAssignments.length}</div>
                                <p className="text-xs text-zinc-500 mt-1">assignments due soon</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming Deadlines list */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Upcoming Deadlines</CardTitle>
                        <CardDescription>Assignments due soonest first</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/student/assignments")}
                    >
                        View All
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading assignments…
                        </div>
                    ) : upcomingAssignments.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4">No upcoming deadlines — you&apos;re all caught up!</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingAssignments.map((a) => {
                                const { label, urgent } = formatRelativeDue(a.due_at!);
                                return (
                                    <div
                                        key={a.id}
                                        className="flex items-center gap-4 pb-3 last:pb-0 border-b last:border-0 border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-md px-1 -mx-1 transition-colors"
                                        onClick={() => router.push(`/student/assignments/${a.id}`)}
                                    >
                                        <div className="h-10 w-10 shrink-0 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <Calendar className="h-5 w-5 text-zinc-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{a.title}</p>
                                            <p className="text-xs text-zinc-500 truncate">
                                                {a.course_code} — {a.course_title}
                                            </p>
                                        </div>
                                        <Badge variant={urgent ? "destructive" : "secondary"} className="shrink-0 text-xs">
                                            {label}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
