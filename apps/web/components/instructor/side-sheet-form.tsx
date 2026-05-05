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
                    // Centered review modal, wide enough for code + grade panels.
                    "left-1/2 right-auto top-1/2 bottom-auto h-[min(92vh,900px)] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl border p-0 sm:max-w-3xl flex flex-col overflow-hidden",
                    "data-[state=closed]:slide-out-to-bottom-0 data-[state=open]:slide-in-from-bottom-0",
                    className
                )}
            >
                {/* ── Fixed header ─────────────────────────────────────── */}
                <SheetHeader className="px-6 pt-6 pb-4 pr-12 border-b border-border/40 shrink-0 text-left">
                    <SheetTitle className="leading-tight">{title}</SheetTitle>
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
