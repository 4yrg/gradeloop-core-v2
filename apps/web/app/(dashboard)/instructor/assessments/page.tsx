"use client";

import { FileText, Info, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function InstructorAssessmentsPage() {
    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Assessments</h1>
                        <p className="text-sm text-muted-foreground">
                            View assignments and student submissions for your courses.
                        </p>
                    </div>
                </div>
            </div>

            {/* Info banner */}
            <div className="flex gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-4">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Assignments are created by administrators
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                        Once an administrator creates an assignment for a course instance you are assigned to,
                        it will appear here along with all student submissions for review.
                    </p>
                </div>
            </div>

            {/* Empty state */}
            <Card className="border-dashed border-border/60 bg-background">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">No assessments yet</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Assignments for your course instances will appear here once they have been
                            created by an administrator.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* What will appear */}
            <Card className="border-border/40 bg-muted/30">
                <CardContent className="p-6">
                    <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold">What will appear here once configured</p>
                            <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 list-disc ml-4">
                                <li>Assignment title, code, and deadline</li>
                                <li>Submission count and grading progress</li>
                                <li>Per-submission code viewer with language detection</li>
                                <li>Student submission status (queued, pending, accepted, rejected)</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
