"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic2, BookOpen, BarChart3, Fingerprint } from "lucide-react";
import { instructorAssessmentsApi } from "@/lib/api/assessments";
import { useUIStore } from "@/lib/stores/uiStore";
import { cn } from "@/lib/utils";

export default function VivaLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ instanceId: string; assignmentId: string }>;
}) {
    const { instanceId, assignmentId } = React.use(params);
    const pathname = usePathname();

    const pushSecondarySidebar = useUIStore((s) => s.pushSecondarySidebar);
    const popSecondarySidebar = useUIStore((s) => s.popSecondarySidebar);
    const updateSidebarByBasePath = useUIStore((s) => s.updateSidebarByBasePath);

    const assignmentPath = `/instructor/courses/${instanceId}/assignments/${assignmentId}`;
    const vivaBasePath = `${assignmentPath}/viva`;

    const [assignmentTitle, setAssignmentTitle] = React.useState("Assignment");

    React.useEffect(() => {
        let mounted = true;
        async function fetchData() {
            try {
                const assignments = await instructorAssessmentsApi.listMyAssignments();
                const found = assignments.find((a) => a.id === assignmentId);
                if (mounted && found) setAssignmentTitle(found.title);
            } catch {
                // keep default
            }
        }
        fetchData();
        return () => {
            mounted = false;
        };
    }, [assignmentId]);

    // Push viva-only sidebar on mount, pop on unmount
    React.useEffect(() => {
        pushSecondarySidebar({
            title: "Viva",
            subtitle: "Assessment",
            backHref: assignmentPath,
            backLabel: "Back to Assignment",
            basePath: vivaBasePath,
            items: [
                { name: "Viva Sessions", href: vivaBasePath },
                { name: "Competencies", href: `${vivaBasePath}/competencies` },
                { name: "Analytics", href: `${vivaBasePath}/analytics` },
                { name: "Voice Profiles", href: `${vivaBasePath}/voice-profiles` },
            ],
        });
        return () => {
            popSecondarySidebar();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignmentId, instanceId]);

    // Update subtitle with assignment title once loaded
    React.useEffect(() => {
        updateSidebarByBasePath(vivaBasePath, {
            title: "Viva",
            subtitle: assignmentTitle,
            backHref: assignmentPath,
            backLabel: "Back to Assignment",
            basePath: vivaBasePath,
            items: [
                { name: "Viva Sessions", href: vivaBasePath },
                { name: "Competencies", href: `${vivaBasePath}/competencies` },
                { name: "Analytics", href: `${vivaBasePath}/analytics` },
                { name: "Voice Profiles", href: `${vivaBasePath}/voice-profiles` },
            ],
        });
    }, [assignmentTitle, assignmentPath, vivaBasePath, updateSidebarByBasePath]);

    // Mobile-only tab strip
    const mobileTabs = [
        { name: "Sessions", href: vivaBasePath, icon: Mic2 },
        { name: "Competencies", href: `${vivaBasePath}/competencies`, icon: BookOpen },
        { name: "Analytics", href: `${vivaBasePath}/analytics`, icon: BarChart3 },
        { name: "Voices", href: `${vivaBasePath}/voice-profiles`, icon: Fingerprint },
    ];

    return (
        <div className="animate-in fade-in duration-300 flex flex-col min-h-0">
            {/* Mobile-only compact tab bar — hidden ≥ lg */}
            <nav className="lg:hidden flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-background/95 backdrop-blur px-4 py-2 shrink-0 sticky top-0 z-10">
                {mobileTabs.map((tab) => {
                    const isActive = tab.href === vivaBasePath
                        ? pathname === vivaBasePath
                        : pathname.startsWith(tab.href);
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Content */}
            <div className="flex-1 w-full">
                {children}
            </div>
        </div>
    );
}
