"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { instructorCoursesApi } from "@/lib/api/academics";
import type { Enrollment } from "@/types/academics.types";
import { handleApiError } from "@/lib/api/axios";
import { AlertCircle, FileDown } from "lucide-react";
import { SectionHeader } from "@/components/instructor/section-header";
import { DataTable, type ColumnDef } from "@/components/instructor/data-table";
import { StatusBadge } from "@/components/instructor/status-badge";
import { EmptyStateCard } from "@/components/instructor/empty-state";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function exportToCsv(students: Enrollment[], filename = "students.csv") {
    const headers = ["Student ID", "Name", "Email", "Status", "Enrolled Date"];
    const rows = students.map((s) => [
        s.student_id ?? "",
        s.full_name ?? "",
        s.email ?? "",
        s.status ?? "",
        s.enrolled_at ? format(new Date(s.enrolled_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function InstructorStudentsPage() {
    const params = useParams();
    const instanceId = params.instanceId as string;

    const [students, setStudents] = React.useState<Enrollment[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        async function fetchData() {
            try {
                setIsLoading(true);
                const studs = await instructorCoursesApi.listMyStudents(instanceId);
                if (mounted) setStudents(studs);
            } catch (err) {
                if (mounted) setError(handleApiError(err));
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        if (instanceId) fetchData();
        return () => {
            mounted = false;
        };
    }, [instanceId]);

    const columns: ColumnDef<Enrollment, any>[] = [
        {
            accessorKey: "student_id",
            header: "Student ID",
            cell: ({ row }) => (
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {row.getValue("student_id") || "—"}
                </span>
            ),
        },
        {
            accessorKey: "full_name",
            header: "Name",
            cell: ({ row }) => (
                <span className="font-semibold text-foreground">
                    {row.getValue("full_name") || "—"}
                </span>
            ),
        },
        {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {row.getValue("email") || "—"}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        },
        {
            accessorKey: "enrolled_at",
            header: "Enrolled Date",
            cell: ({ row }) => {
                const val = row.getValue("enrolled_at") as string;
                if (!val) return <span className="text-muted-foreground">—</span>;
                try {
                    return (
                        <span className="text-muted-foreground text-sm">
                            {format(new Date(val), "MMM d, yyyy")}
                        </span>
                    );
                } catch {
                    return <span className="text-muted-foreground">—</span>;
                }
            },
        },
    ];

    if (error) {
        return (
            <div className="flex gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-8 h-full">
            <SectionHeader
                title="Student Management"
                description="View enrolled students for this course instance."
                action={
                    <div className="flex items-center gap-2">
                        {!isLoading && students.length > 0 && (
                            <Badge variant="outline" className="font-semibold text-sm px-3 py-1">
                                {students.length} student{students.length !== 1 ? "s" : ""}
                            </Badge>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportToCsv(students)}
                            disabled={isLoading || students.length === 0}
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                }
            />

            {/* Admin-managed notice */}
            <div className="flex gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Enrollment is administrator-managed
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        You cannot manually add or remove students from this instance. If a student is
                        missing, please contact the administration office.
                    </p>
                </div>
            </div>

            {!isLoading && students.length === 0 ? (
                <EmptyStateCard
                    icon={Users}
                    title="No students enrolled"
                    description="There are currently no students enrolled in this course instance. Enrollment is managed by administrators."
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={students}
                    isLoading={isLoading}
                    searchKey="full_name"
                    searchPlaceholder="Search students by name..."
                />
            )}
        </div>
    );
}
