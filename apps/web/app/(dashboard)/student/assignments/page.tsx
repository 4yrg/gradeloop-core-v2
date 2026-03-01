"use client";

import * as React from "react";
import { BookOpen, FileText, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AssignmentCard } from "@/components/dashboard/assignment-card";
import { assessmentApi } from "@/lib/api/assessments";
import { studentCoursesApi } from "@/lib/api/academics";
import type { Assignment } from "@/types/assessment.types";

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);

        // 1. Get all course instances this student is enrolled in.
        const enrolledCourses = await studentCoursesApi.listMyCourses();

        if (enrolledCourses.length === 0) {
          setAssignments([]);
          return;
        }

        // 2. For each course instance, fetch its assignments in parallel.
        const results = await Promise.allSettled(
          enrolledCourses.map((c) =>
            assessmentApi.getAssignmentsByCourseInstance(c.course_instance_id),
          ),
        );

        // 3. Flatten all assignment arrays into one list.
        const all: Assignment[] = [];
        for (const result of results) {
          if (result.status === "fulfilled") {
            const data = result.value;
            if (Array.isArray(data)) {
              all.push(...data);
            } else if (Array.isArray(data?.assignments)) {
              all.push(...data.assignments);
            }
          }
        }

        // Deduplicate by id (in case the same assignment appears in multiple results).
        const seen = new Set<string>();
        const unique = all.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        setAssignments(unique);
      } catch (err) {
        console.error("Failed to fetch assignments:", err);
        setError("Failed to load assignments. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Assignments</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            View and complete your coding assignments
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => {
    const now = new Date();
    const dueDate = a.due_at ? new Date(a.due_at) : null;
    const lateDueDate = a.late_due_at ? new Date(a.late_due_at) : null;
    
    if (!dueDate) return true;
    if (lateDueDate && now <= lateDueDate) return true;
    if (now <= dueDate) return true;
    
    return false;
  });

  const completedAssignments = assignments.filter((a) => !activeAssignments.includes(a));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Assignments</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          View and complete your coding assignments
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAssignments.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileText className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAssignments.length}</div>
          </CardContent>
        </Card>
      </div>

      {activeAssignments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Active Assignments</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      )}

      {completedAssignments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Completed Assignments</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completedAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Assignments</CardTitle>
            <CardDescription>
              You don&apos;t have any assignments yet. Check back later!
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
