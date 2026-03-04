"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import type { SubmissionResponse } from "@/types/assessments.types";
import { handleApiError } from "@/lib/api/axios";
import { Users, FileDown, SearchX, Filter } from "lucide-react";
import { SectionHeader } from "@/components/instructor/section-header";
import { DataTable, type ColumnDef } from "@/components/instructor/data-table";
import { StatusBadge } from "@/components/instructor/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/instructor/empty-state";
import { SideSheetForm } from "@/components/instructor/side-sheet-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SubmissionWithMeta extends SubmissionResponse {
    studentName?: string;
    studentId?: string;
}

// Mock data until real submissions endpoint returns enriched data
const mockSubmissions: SubmissionWithMeta[] = [
    { id: "sub-1", assignment_id: "a1", user_id: "u1", storage_path: "/", language: "Python", status: "Pending", version: 1, is_latest: true, submitted_at: "2023-10-24T10:30:00Z", studentName: "Alice Smith", studentId: "CS-2023-001" },
    { id: "sub-2", assignment_id: "a1", user_id: "u2", storage_path: "/", language: "Java", status: "Graded", version: 1, is_latest: true, submitted_at: "2023-10-23T15:45:00Z", studentName: "Bob Johnson", studentId: "CS-2023-002" },
    { id: "sub-3", assignment_id: "a1", user_id: "u3", storage_path: "/", language: "C++", status: "Late", version: 1, is_latest: true, submitted_at: "2023-10-25T08:15:00Z", studentName: "Charlie Brown", studentId: "CS-2023-003" },
    { id: "sub-4", assignment_id: "a1", user_id: "u4", storage_path: "/", language: "Python", status: "Missing", version: 0, is_latest: false, submitted_at: "", studentName: "Diana Prince", studentId: "CS-2023-004" },
];

export default function AssignmentSubmissionsPage({
    params,
}: {
    params: Promise<{ assignmentId: string }>;
}) {
    const { assignmentId } = React.use(params);

    const [submissions, setSubmissions] = React.useState<SubmissionWithMeta[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [selectedSubmission, setSelectedSubmission] = React.useState<SubmissionWithMeta | null>(null);
    const [filter, setFilter] = React.useState<"all" | "pending" | "graded" | "late" | "missing">("all");

    React.useEffect(() => {
        let mounted = true;

        async function fetchSubmissions() {
            try {
                setIsLoading(true);
                const subs = await instructorAssessmentsApi.listSubmissions(assignmentId);
                // Enrich with mock student metadata
                const enriched = subs.map((s, i) => ({
                    ...s,
                    studentName: mockSubmissions[i]?.studentName ?? `Student ${i + 1}`,
                    studentId: mockSubmissions[i]?.studentId ?? `STU-${String(i + 1).padStart(3, "0")}`,
                }));
                if (mounted) setSubmissions(enriched.length > 0 ? enriched : mockSubmissions);
            } catch (err) {
                console.error(err);
                if (mounted) setSubmissions(mockSubmissions);
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        fetchSubmissions();
        return () => {
            mounted = false;
        };
    }, [assignmentId]);

    const filtered = React.useMemo(() => {
        if (filter === "all") return submissions;
        return submissions.filter((s) => s.status.toLowerCase() === filter);
    }, [submissions, filter]);

    const columns: ColumnDef<SubmissionWithMeta, any>[] = [
        {
            accessorKey: "studentName",
            header: "Student",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{row.getValue("studentName")}</span>
                    <span className="text-xs text-muted-foreground font-mono">{row.original.studentId}</span>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            accessorKey: "submittedAt",
            header: "Submitted",
            cell: ({ row }) => {
                const date = row.getValue("submittedAt") as string;
                if (!date) return <span className="text-muted-foreground">—</span>;
                return <span className="text-sm whitespace-nowrap">{format(new Date(date), "MMM d, yyyy • h:mm a")}</span>;
            },
        },
        {
            accessorKey: "language",
            header: "Language",
            cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("language") || "—"}</span>,
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubmission(row.original);
                    }}
                >
                    {row.original.status === "Missing" ? "View Profile" : "Grade"}
                </Button>
            )
        }
    ];

    const exportToCsv = () => {
        const headers = ["Student ID", "Name", "Status", "Submitted At", "Language"];
        const rows = filtered.map((s) => [
            s.studentId ?? "",
            s.studentName ?? "",
            s.status ?? "",
            s.submitted_at ? format(new Date(s.submitted_at), "yyyy-MM-dd HH:mm:ss") : "",
            s.language ?? "",
        ]);
        const csv = [headers, ...rows]
            .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `submissions-${assignmentId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8 pb-8 h-full">
            <SectionHeader
                title="Submissions"
                description="Review student work, run plagiarism checks, and grade assignments."
                icon={Users}
                action={
                    <div className="flex items-center gap-2">
                        {!isLoading && filtered.length > 0 && (
                            <Badge variant="outline" className="font-semibold text-sm px-3 py-1">
                                {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={exportToCsv} disabled={isLoading || filtered.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" /> Export CSV
                        </Button>
                    </div>
                }
            />

            {/* Filter Tabs */}
            {!isLoading && submissions.length > 0 && (
                <div className="flex items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full max-w-md">
                        <TabsList className="grid grid-cols-5 gap-1">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="graded">Graded</TabsTrigger>
                            <TabsTrigger value="late">Late</TabsTrigger>
                            <TabsTrigger value="missing">Missing</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {submissions.length === 0 && !isLoading ? (
                <EmptyStateCard
                    icon={SearchX}
                    title="No submissions found"
                    description="It looks like there are no students or no submissions available for this assignment yet."
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={filtered}
                    isLoading={isLoading}
                    searchKey="studentName"
                    searchPlaceholder="Search by student name..."
                    onRowClick={(row) => setSelectedSubmission(row)}
                />
            )}

            {/* Grading Review Sheet */}
            <SideSheetForm
                open={selectedSubmission !== null}
                onOpenChange={(open) => !open && setSelectedSubmission(null)}
                title={selectedSubmission ? `Grade: ${selectedSubmission.studentName}` : "Grade Submission"}
                description="Review the submission content, evaluate against the rubric, and assign a final score."
            >
                <div className="flex-1 overflow-y-auto space-y-6">
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/40 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={selectedSubmission?.status || "Pending"} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Submitted</span>
                            <span className="font-medium text-foreground">
                                {selectedSubmission?.submitted_at
                                    ? format(new Date(selectedSubmission.submitted_at), "MMM d, yyyy • h:mm a")
                                    : "Not submitted"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Language</span>
                            <span className="font-mono text-xs">{selectedSubmission?.language || "—"}</span>
                        </div>
                    </div>

                    {selectedSubmission?.status !== "Missing" && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold font-heading mb-2">Submission Content</h4>
                                <div className="p-4 border border-border/60 rounded-xl bg-card text-sm font-mono h-[300px] overflow-y-auto text-muted-foreground">
                                    // Simulated submission text or code goes here
                                    <br /><br />
                                    function calculateScore() {'{'} <br />
                                    &nbsp;&nbsp;return 100; <br />
                                    {'}'}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold font-heading mb-2">Feedback</h4>
                                <Textarea
                                    placeholder="Write constructive feedback for the student here..."
                                    className="resize-none h-32"
                                />
                            </div>

                            <div>
                                <h4 className="font-bold font-heading mb-2 text-primary">Final Score</h4>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        defaultValue=""
                                        placeholder="0"
                                        max={100}
                                        min={0}
                                        className="w-24"
                                    />
                                    <span className="text-muted-foreground font-medium">/ 100</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between sticky bottom-0 bg-background/95 backdrop-blur py-4 z-10">
                    <Button variant="ghost" onClick={() => setSelectedSubmission(null)}>
                        Cancel
                    </Button>
                    <Button onClick={() => setSelectedSubmission(null)} disabled={selectedSubmission?.status === "Missing"}>
                        Save Grade
                    </Button>
                </div>
            </SideSheetForm>
        </div>
    );
}
