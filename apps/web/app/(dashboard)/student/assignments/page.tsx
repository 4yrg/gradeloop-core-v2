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
import type { Assignment } from "@/types/assessment.types";

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // TODO: In production, get the actual course instance IDs from the student's enrollments
  // For now, we'll use a demo approach
  const courseInstanceId = "demo-course-instance-id"; // Replace with actual logic

  React.useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        // TODO: Fetch all enrolled courses and their assignments
        // For now, using a single course instance as demo
        // const response = await assessmentApi.getAssignmentsByCourseInstance(courseInstanceId);
        // setAssignments(response.assignments);

        // Mock data for now - remove this when API is connected
        setAssignments([]);
      } catch (err) {
        console.error("Failed to fetch assignments:", err);
        setError("Failed to load assignments. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [courseInstanceId]);

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
