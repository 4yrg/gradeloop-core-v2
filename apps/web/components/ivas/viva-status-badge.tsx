"use client";

import { CheckCircle2, XCircle, Clock, Loader2, Pause, AlertCircle, Play, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    completed: {
        label: "Completed",
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    in_progress: {
        label: "In Progress",
        icon: <Play className="h-3 w-3" />,
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    initializing: {
        label: "Initializing",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    },
    grading: {
        label: "Grading",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    },
    grading_failed: {
        label: "Grading Failed",
        icon: <AlertCircle className="h-3 w-3" />,
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    paused: {
        label: "Paused",
        icon: <Pause className="h-3 w-3" />,
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    abandoned: {
        label: "Abandoned",
        icon: <XCircle className="h-3 w-3" />,
        className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
    },
    voice_verification_failed: {
        label: "Verification Failed",
        icon: <ShieldAlert className="h-3 w-3" />,
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
};

export function VivaStatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status];
    if (config) {
        return (
            <Badge variant="outline" className={`border-0 text-xs ${config.className}`}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="border-0 text-xs bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <Clock className="h-3 w-3 mr-1" />
            {status}
        </Badge>
    );
}