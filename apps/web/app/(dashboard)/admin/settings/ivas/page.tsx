"use client";

import * as React from "react";
import { Mic2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ivasApi } from "@/lib/ivas-api";
import type { HealthResponse, ReadyResponse } from "@/types/ivas";

export default function IvasSettingsPage() {
    const [health, setHealth] = React.useState<HealthResponse | null>(null);
    const [ready, setReady] = React.useState<ReadyResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [checking, setChecking] = React.useState(false);

    const checkStatus = React.useCallback(async () => {
        setChecking(true);
        try {
            const [h, r] = await Promise.allSettled([
                ivasApi.checkHealth(),
                ivasApi.checkReady(),
            ]);
            if (h.status === "fulfilled") setHealth(h.value);
            else setHealth(null);
            if (r.status === "fulfilled") setReady(r.value);
            else setReady(null);
        } catch {
            setHealth(null);
            setReady(null);
        } finally {
            setChecking(false);
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const isHealthy = health?.status === "healthy";
    const isReady = ready?.status === "ready";

    return (
        <div className="flex flex-col gap-8 pb-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Mic2 className="h-6 w-6" />
                        IVAS Service Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Monitor and manage the Intelligent Viva Assessment System.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={checkStatus}
                    disabled={checking}
                    className="gap-1"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {/* Health Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                {isHealthy ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                                Service Health
                            </CardTitle>
                            <CardDescription>
                                {isHealthy ? "IVAS service is running and healthy." : "IVAS service is unreachable or unhealthy."}
                            </CardDescription>
                        </CardHeader>
                        {health && (
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Status</p>
                                        <p className="font-medium capitalize">{health.status}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Service</p>
                                        <p className="font-medium">{health.service}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Version</p>
                                        <p className="font-medium">{health.version}</p>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Readiness */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                {isReady ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                                Readiness Checks
                            </CardTitle>
                            <CardDescription>
                                {isReady ? "All dependencies are connected." : "Some dependencies are not ready."}
                            </CardDescription>
                        </CardHeader>
                        {ready?.checks && (
                            <CardContent>
                                <div className="space-y-2">
                                    {Object.entries(ready.checks).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between text-sm">
                                            <span className="font-medium capitalize">{key}</span>
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full",
                                                value === "ok"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            )}>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Config Info */}
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">
                                The IVAS service runs on port 8088 with a dedicated PostgreSQL instance.
                                It uses Gemini Live API (free tier) for real-time voice viva examinations
                                and Resemblyzer for speaker verification.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
