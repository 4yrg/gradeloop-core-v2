"use client";

import { Badge } from "@/components/ui/badge";

const DIFFICULTY_CONFIG: Record<number, { label: string; className: string }> = {
    1: { label: "Beginner", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    2: { label: "Intermediate", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    3: { label: "Advanced", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    4: { label: "Expert", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    5: { label: "Master", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

export function DifficultyBadge({ difficulty }: { difficulty: number }) {
    const level = Math.max(1, Math.min(5, difficulty));
    const config = DIFFICULTY_CONFIG[level] || DIFFICULTY_CONFIG[3];
    return (
        <Badge variant="outline" className={`border-0 text-xs ${config.className}`}>
            {config.label}
        </Badge>
    );
}