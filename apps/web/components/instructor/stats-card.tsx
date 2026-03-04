import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: React.ReactNode;
    subtitle?: string;
    isLoading?: boolean;
    badge?: string;
    badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export function StatsCard({
    title,
    icon: Icon,
    value,
    subtitle,
    isLoading,
    badge,
    badgeVariant = "outline",
    className,
    ...props
}: StatsCardProps) {
    return (
        <Card className={cn("border-border/60 shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/20", className)} {...props}>
            <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    {badge && (
                        <Badge variant={badgeVariant} className="text-[10px] font-semibold">
                            {badge}
                        </Badge>
                    )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {title}
                </p>
                <div className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex-1">
                    {isLoading ? (
                        <Loader2 className="h-6 w-6 lg:h-8 lg:w-8 animate-spin text-muted-foreground/50 mt-1" />
                    ) : (
                        value
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1" title={subtitle}>
                        {subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
