"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, CheckSquare, Settings } from "lucide-react";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AssignmentLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ instanceId: string; assignmentId: string }>;
}) {
    const { instanceId, assignmentId } = React.use(params);
    const pathname = usePathname();
    const [assignmentTitle, setAssignmentTitle] = React.useState("Loading...");

    React.useEffect(() => {
        let mounted = true;
        async function fetchAssignmentData() {
            try {
                const assignments = await instructorAssessmentsApi.listMyAssignments();
                const found = assignments.find((a) => a.id === assignmentId);
                if (mounted) {
                    if (found) {
                        setAssignmentTitle(found.title);
                    } else {
                        setAssignmentTitle("Assignment Details");
                    }
                }
            } catch (err) {
                if (mounted) setAssignmentTitle("Assignment");
            }
        }
        fetchAssignmentData();
        return () => { mounted = false; };
    }, [assignmentId]);

    const coursePath = `/instructor/courses/${instanceId}/assignments`;
    const basePath = `${coursePath}/${assignmentId}`;

    const tabs = [
        { name: "Overview", href: basePath, icon: LayoutDashboard },
        { name: "Submissions", href: `${basePath}/submissions`, icon: CheckSquare },
        { name: "Settings", href: `${basePath}/settings`, icon: Settings },
    ];

    return (
        <div className="flex-1 flex flex-col overflow-hidden w-full animate-in fade-in duration-300">
            {/* Horizontal Header / Tabs */}
            <div className="border-b border-border/40 bg-background/95 backdrop-blur z-10 sticky top-0 px-4 md:px-8 pt-6 shrink-0">
                <div className="max-w-6xl mx-auto w-full">
                    <Button variant="ghost" size="sm" asChild className="mb-4 h-8 px-2 text-muted-foreground hover:text-foreground -ml-2">
                        <Link href={coursePath}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Assignments
                        </Link>
                    </Button>
                    <div className="mb-6">
                        <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">Assessment</div>
                        <h2 className="text-3xl font-bold font-heading text-foreground tracking-tight" title={assignmentTitle}>
                            {assignmentTitle}
                        </h2>
                    </div>

                    <div className="flex items-center gap-6 overflow-x-auto">
                        {tabs.map((tab) => {
                            const isActive = tab.href === basePath
                                ? pathname === basePath
                                : pathname.startsWith(tab.href);
                            const Icon = tab.icon;

                            return (
                                <Link
                                    key={tab.name}
                                    href={tab.href}
                                    className={cn(
                                        "flex items-center gap-2 pb-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap",
                                        isActive
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.name}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full bg-muted/5">
                <div className="p-4 md:p-8 pt-6 max-w-6xl mx-auto w-full">
                    {children}
                </div>
            </div>
        </div>
    );
}
