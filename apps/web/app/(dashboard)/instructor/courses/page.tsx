"use client";

import { BookOpen, AlertCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function InstructorCoursesPage() {
    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">My Courses</h1>
                        <p className="text-sm text-muted-foreground">
                            Courses you are assigned to instruct this semester.
                        </p>
                    </div>
                </div>
            </div>

            {/* Informational state */}
            <div className="flex gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-4">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Courses are assigned by administrators
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                        An administrator must first create a course instance and assign you as the instructor via the
                        Academics → Enrollment → Instructors panel. Once assigned, your courses will appear here.
                    </p>
                </div>
            </div>

            {/* Empty state */}
            <Card className="border-dashed border-border/60 bg-background">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">No courses assigned yet</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Contact your administrator to be assigned to a course instance.
                            Assigned courses and their enrolled students will appear here.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Info on what will appear */}
            <Card className="border-border/40 bg-muted/30">
                <CardContent className="p-6">
                    <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold">What will appear here once assigned</p>
                            <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 list-disc ml-4">
                                <li>Course name, code, and semester information</li>
                                <li>Enrolled student count per course instance</li>
                                <li>Associated assignments and their submission counts</li>
                                <li>Links to per-course student and submission views</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
