import * as React from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SideSheetFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function SideSheetForm({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
}: SideSheetFormProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={cn(
                    // Wide enough for code + grade panel, full viewport height
                    "w-full sm:max-w-2xl flex flex-col overflow-hidden p-0",
                    className
                )}
            >
                {/* ── Fixed header ─────────────────────────────────────── */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
                    <SheetTitle>{title}</SheetTitle>
                    {description && (
                        <SheetDescription>{description}</SheetDescription>
                    )}
                </SheetHeader>

                {/* ── Scrollable body + sticky footer (passed as children) */}
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-6 pb-6">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
