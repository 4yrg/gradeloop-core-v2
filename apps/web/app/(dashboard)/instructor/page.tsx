"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import {
    BookOpen,
    FileText,
    GraduationCap,
    Users,
    AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
    title,
    icon: Icon,
    value,
    sub,
    locked,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    sub: string;
    locked?: boolean;
}) {
    return (
        <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {locked && (
                        <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
                            Admin only
                        </Badge>
                    )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {title}
                </p>
                <p className="text-2xl font-black tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InstructorDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const displayName = user?.full_name || user?.username || "Instructor";

    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
                <h1 className="text-3xl font-black font-serif tracking-tight lg:text-4xl">
                    Welcome, {displayName.split(" ")[0]}
                </h1>
                <p className="text-muted-foreground text-sm">
                    This is your instructor workspace. Course and enrollment data is managed by administrators.
                </p>
            </div>

            {/* Backend access notice */}
            <div className="flex gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Academic data is administrator-managed
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        Courses, enrollments, and assignment definitions are configured by admins. Once assigned to a course, you will be able to view student submissions here.
                    </p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Assigned Courses"
                    icon={BookOpen}
                    value="—"
                    sub="Awaiting admin assignment"
                    locked
                />
                <StatCard
                    title="Active Students"
                    icon={GraduationCap}
                    value="—"
                    sub="Requires course assignment"
                    locked
                />
                <StatCard
                    title="Assignments"
                    icon={FileText}
                    value="—"
                    sub="Created by administrators"
                    locked
                />
                <StatCard
                    title="Peer Groups"
                    icon={Users}
                    value="—"
                    sub="Populated after assignment"
                    locked
                />
            </div>

            {/* Quick navigation */}
            <div>
                <h2 className="text-lg font-bold mb-4">Quick Access</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                        {
                            href: "/instructor/courses",
                            icon: BookOpen,
                            title: "My Courses",
                            desc: "View courses you have been assigned to instruct.",
                        },
                        {
                            href: "/instructor/assessments",
                            icon: FileText,
                            title: "Assessments",
                            desc: "Browse assignments and review student submissions.",
                        },
                        {
                            href: "/instructor/students",
                            icon: GraduationCap,
                            title: "Students",
                            desc: "See enrolled students across your courses.",
                        },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <Card
                                key={item.href}
                                className="group border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 bg-background"
                            >
                                <CardContent className="p-6 flex flex-col gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-fit" asChild>
                                        <Link href={item.href}>Open</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
