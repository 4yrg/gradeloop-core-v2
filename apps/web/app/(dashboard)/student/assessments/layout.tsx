"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic2, BarChart, ShieldCheck } from "lucide-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { cn } from "@/lib/utils";

export default function AssessmentsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const pushSecondarySidebar = useUIStore((s) => s.pushSecondarySidebar);
    const popSecondarySidebar = useUIStore((s) => s.popSecondarySidebar);
    const setPageTitle = useUIStore((s) => s.setPageTitle);

    const basePath = "/student/assessments";

    React.useEffect(() => {
        pushSecondarySidebar({
            title: "Viva",
            subtitle: undefined,
            backHref: "/student",
            backLabel: "Dashboard",
            basePath,
            items: [
                { name: "My Sessions", href: `${basePath}/my-sessions` },
                { name: "Results", href: `${basePath}/results` },
                { name: "Voice Enrollment", href: `${basePath}/voice-enrollment` },
            ],
        });
        return () => {
            popSecondarySidebar();
            setPageTitle(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mobile-only tab strip
    const mobileTabs = [
        { name: "My Sessions", href: `${basePath}/my-sessions`, icon: Mic2 },
        { name: "Results", href: `${basePath}/results`, icon: BarChart },
        { name: "Voice Enroll", href: `${basePath}/voice-enrollment`, icon: ShieldCheck },
    ];

    return (
        <div className="animate-in fade-in duration-300 flex flex-col min-h-0">
            {/* Mobile-only compact tab bar — hidden ≥ lg */}
            <nav className="lg:hidden flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-background/95 backdrop-blur px-4 py-2 shrink-0 sticky top-0 z-10">
                {mobileTabs.map((tab) => {
                    const isActive = tab.href === basePath
                        ? pathname === basePath
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
