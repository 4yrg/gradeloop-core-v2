"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void | Promise<void>;
    isLoading?: boolean;
    className?: string;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    onConfirm,
    isLoading = false,
    className,
}: ConfirmDialogProps) {
    const [isConfirming, setIsConfirming] = React.useState(false);

    const handleConfirm = async () => {
        try {
            setIsConfirming(true);
            await onConfirm();
            onOpenChange(false);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("sm:max-w-md", className)}>
                <DialogHeader>
                    <div className="flex items-start gap-4 p-1">
                        {variant === "destructive" && (
                            <div className="h-10 w-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-error" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-serif">{title}</DialogTitle>
                            {typeof description === "string" ? (
                                <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
                            ) : (
                                description
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2 mt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading || isConfirming}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        variant={variant === "destructive" ? "destructive" : "default"}
                        className="rounded-full px-6"
                        onClick={handleConfirm}
                        disabled={isLoading || isConfirming}
                    >
                        {isConfirming || isLoading ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Processing...
                            </>
                        ) : (
                            confirmText
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
