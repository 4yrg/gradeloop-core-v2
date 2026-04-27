"use client";

import * as React from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/authStore";
import {
    BookOpen,
    FileText,
    Clock,
    CheckCircle2,
    Calendar,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { studentCoursesApi } from "@/lib/api/academics";
import { studentAssessmentsApi } from "@/lib/api/assessments";
import type { StudentCourseEnrollment } from "@/types/academics.types";
import type { AssignmentResponse } from "@/types/assessments.types";
import { handleApiError } from "@/lib/api/axios";
import { format, isPast, isToday, isTomorrow } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dueDateLabel(dateStr?: string): { label: string; urgent: boolean } {
    if (!dateStr) return { label: "No due date", urgent: false };
    const d = new Date(dateStr);
    if (isPast(d)) return { label: "Overdue", urgent: true };
    if (isToday(d)) return { label: "Due today", urgent: true };
    if (isTomorrow(d)) return { label: "Due tomorrow", urgent: true };
    return { label: `Due ${format(d, "MMM d")}`, urgent: false };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
    title,
    icon: Icon,
    value,
    sub,
    isLoading,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: React.ReactNode;
    sub: string;
    isLoading?: boolean;
}) {
    return (
        <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {title}
                </p>
                <div className="font-heading text-2xl font-black tracking-tight">
                    {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                        value
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const firstName = user?.full_name?.split(" ")[0] || user?.email || "there";

    const [enrollments, setEnrollments] = React.useState<StudentCourseEnrollment[]>([]);
    const [upcomingAssignments, setUpcomingAssignments] = React.useState<
        Array<AssignmentResponse & { course_code: string; course_title: string }>
    >([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        async function fetchDashboard() {
            try {
                setIsLoading(true);
                const courses = await studentCoursesApi.listMyEnrollments();
                if (!mounted) return;
                setEnrollments(courses);

                // Fetch assignments for each active/enrolled course in parallel
                const activeEnrollments = courses.filter(
                    (e) => e.status === "Enrolled",
                );
                const assignmentResults = await Promise.allSettled(
                    activeEnrollments.map(async (e) => {
                        const assignments = await studentAssessmentsApi.listAssignmentsForCourse(
                            e.course_instance_id,
                        );
                        return assignments.map((a) => ({
                            ...a,
                            course_code: e.course_code,
                            course_title: e.course_title,
                        }));
                    }),
                );

                const allAssignments = assignmentResults
                    .filter((r) => r.status === "fulfilled")
                    .flatMap((r) => (r as PromiseFulfilledResult<typeof upcomingAssignments>).value);

                // Sort by due date ascending, only future + today
                const upcoming = allAssignments
                    .filter((a) => a.due_at && !isPast(new Date(a.due_at)))
                    .sort(
                        (a, b) =>
                            new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime(),
                    )
                    .slice(0, 5);

                if (mounted) setUpcomingAssignments(upcoming);
            } catch (err) {
                if (mounted) setError(handleApiError(err));
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        fetchDashboard();
        return () => {
            mounted = false;
        };
    }, []);

    const activeEnrollments = enrollments.filter((e) => e.status === "Enrolled");

    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
                <h1 className="text-3xl font-black tracking-tight lg:text-4xl">
                    Welcome back, {firstName}
                </h1>
                <p className="text-muted-foreground text-sm">
                    Here&apos;s an overview of your courses and upcoming work.
                </p>
            </div>

            {error && (
                <div className="p-4 rounded-xl border border-error-border bg-error-muted text-error-muted-foreground text-sm">
                    {error}
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                    title="Enrolled Courses"
                    icon={BookOpen}
                    value={activeEnrollments.length.toString()}
                    sub={
                        activeEnrollments.length > 0
                            ? `${enrollments.length} total across all terms`
                            : "No active enrollments"
                    }
                    isLoading={isLoading}
                />
                <StatCard
                    title="Upcoming Deadlines"
                    icon={Clock}
                    value={upcomingAssignments.length.toString()}
                    sub={
                        upcomingAssignments.length > 0
                            ? `Next: ${upcomingAssignments[0]?.title ?? "—"}`
                            : "Nothing due soon"
                    }
                    isLoading={isLoading}
                />
                <StatCard
                    title="Courses This Semester"
                    icon={CheckCircle2}
                    value={activeEnrollments.length.toString()}
                    sub="Active this term"
                    isLoading={isLoading}
                />
            </div>

            {/* Main content grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Upcoming Deadlines */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-bold">Upcoming Deadlines</CardTitle>
                            <Button variant="ghost" size="sm" asChild className="text-xs text-primary">
                                <Link href="/student/submissions">View all</Link>
                            </Button>
                        </div>
                        <CardDescription>Assignments coming up across your courses</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : upcomingAssignments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                                <Calendar className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {upcomingAssignments.map((assignment) => {
                                    const { label, urgent } = dueDateLabel(assignment.due_at);
                                    return (
                                        <Link
                                            key={assignment.id}
                                            href={`/student/courses/${assignment.course_instance_id}/assignments/${assignment.id}`}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-accent/30 transition-all group"
                                        >
                                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                    {assignment.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {assignment.course_code} • {assignment.course_title}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={urgent ? "destructive" : "secondary"}
                                                className="shrink-0 text-[10px]"
                                            >
                                                {label}
                                            </Badge>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* My Courses */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-bold">My Courses</CardTitle>
                            <Button variant="ghost" size="sm" asChild className="text-xs text-primary">
                                <Link href="/student/courses">View all</Link>
                            </Button>
                        </div>
                        <CardDescription>Your active course enrollments</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                ))}
                            </div>
                        ) : activeEnrollments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                                <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">No active enrollments</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeEnrollments.slice(0, 5).map((e) => (
                                    <Link
                                        key={e.course_instance_id}
                                        href={`/student/courses/${e.course_instance_id}`}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-accent/30 transition-all group"
                                    >
                                        <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                            <span className="text-xs font-black text-secondary-foreground">
                                                {e.course_code.slice(0, 2)}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                {e.course_title}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {e.course_code} • {e.semester_name}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

