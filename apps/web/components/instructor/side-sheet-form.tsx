import * as React from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
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
                className={cn(
                    "w-full sm:max-w-2xl flex flex-col p-6 h-full gap-5 border-l-border/40 right-0",
                    className
                )}
            >
                <SheetHeader className="pb-4 border-b border-border/40 shrink-0">
                    <SheetTitle className="text-2xl font-bold font-heading">{title}</SheetTitle>
                    {description && (
                        <SheetDescription className="text-sm mt-1">{description}</SheetDescription>
                    )}
                </SheetHeader>
                <div className="flex-1 flex flex-col overflow-y-auto w-full px-1">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
