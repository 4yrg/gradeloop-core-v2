"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  Shield,
  Loader2,
  RotateCcw,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { ivasApi } from "@/lib/ivas-api";
import { instructorCoursesApi } from "@/lib/api/academics";
import type { VoiceProfileStatus } from "@/types/ivas";
import type { Enrollment } from "@/types/academics.types";

interface StudentVoiceStatus {
  enrollment: Enrollment;
  profile: VoiceProfileStatus | null;
}

export default function VoiceProfilesPage() {
  const params = useParams<{
    instanceId: string;
    assignmentId: string;
  }>();
  const { instanceId } = params;
  const { addToast } = useToast();

  const [students, setStudents] = React.useState<StudentVoiceStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingStudentId, setDeletingStudentId] = React.useState<string | null>(
    null,
  );
  const [confirmStudent, setConfirmStudent] =
    React.useState<StudentVoiceStatus | null>(null);

  // Load students + voice profiles
  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const enrollments = await instructorCoursesApi.listMyStudents(
          instanceId,
        );
        const statuses: StudentVoiceStatus[] = [];

        for (const enrollment of enrollments) {
          try {
            const profile = await ivasApi.getVoiceProfile(enrollment.user_id);
            statuses.push({ enrollment, profile });
          } catch {
            statuses.push({
              enrollment,
              profile: {
                student_id: enrollment.user_id,
                enrolled: false,
                samples_count: 0,
                required_samples: 3,
                is_complete: false,
              },
            });
          }
        }

        // Sort by enrolled first, then by name
        statuses.sort((a, b) => {
          const aEnrolled = a.profile?.is_complete ? 1 : 0;
          const bEnrolled = b.profile?.is_complete ? 1 : 0;
          if (aEnrolled !== bEnrolled) return bEnrolled - aEnrolled;
          return a.enrollment.full_name.localeCompare(b.enrollment.full_name);
        });

        if (mounted) setStudents(statuses);
      } catch {
        addToast({
          title: "Failed to load students",
          variant: "error",
          description: "Could not fetch the student list for this course.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [instanceId, addToast]);

  const handleDelete = async (userId: string) => {
    setDeletingStudentId(userId);
    setConfirmStudent(null);
    try {
      await ivasApi.deleteVoiceProfile(userId);
      addToast({
        title: "Voice profile deleted",
        variant: "success",
        description: "The student's voice profile has been cleared.",
      });
      setStudents((prev) =>
        prev.map((s) =>
          s.enrollment.user_id === userId
            ? {
                ...s,
                profile: {
                  student_id: userId,
                  enrolled: false,
                  samples_count: 0,
                  required_samples: 3,
                  is_complete: false,
                },
              }
            : s,
        ),
      );
    } catch {
      addToast({
        title: "Delete failed",
        variant: "error",
        description: "Could not delete the voice profile. Please try again.",
      });
    } finally {
      setDeletingStudentId(null);
    }
  };

  const enrolledCount = students.filter(
    (s) => s.profile?.is_complete,
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
        <Users className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">No students enrolled</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This course has no enrolled students yet. Students must be enrolled
          before they can set up voice profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-2xl font-black tracking-tight font-heading">
          Voice Profiles
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage student voice enrollments. Delete a profile only
          when the student needs to re-enroll under your supervision.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Enrolled</p>
            <p className="text-3xl font-extrabold text-emerald-600">{enrolledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Not enrolled</p>
            <p className="text-3xl font-extrabold text-muted-foreground">
              {students.length - enrolledCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
          <CardDescription>
            {students.length} student{students.length !== 1 ? "s" : ""} in this
            course
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {students.map((student) => {
            const isEnrolled = student.profile?.is_complete ?? false;
            const samples = student.profile?.samples_count ?? 0;
            const required = student.profile?.required_samples ?? 3;
            const isDeleting = deletingStudentId === student.enrollment.user_id;

            return (
              <div
                key={student.enrollment.student_id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isEnrolled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isEnrolled ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {student.enrollment.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.enrollment.student_id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isEnrolled ? (
                    <>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                        {samples}/{required} samples
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => setConfirmStudent(student)}
                        className="gap-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Not enrolled
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Only delete a voice profile when the student is physically present (e.g.,
          in a lab session). After deleting, the student must re-enroll through
          their Voice Enrollment page before taking a viva.
        </p>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmStudent} onOpenChange={(v) => !v && setConfirmStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Voice Profile?</DialogTitle>
            <DialogDescription>
              This will permanently delete the voice profile for{" "}
              <strong>{confirmStudent?.enrollment.full_name}</strong>. The student
              will need to re-enroll their voice samples before taking any viva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmStudent(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmStudent &&
                handleDelete(confirmStudent.enrollment.user_id)
              }
              disabled={!confirmStudent}
            >
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
