'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const SideDialog = DialogPrimitive.Root;
const SideDialogTrigger = DialogPrimitive.Trigger;
const SideDialogPortal = DialogPrimitive.Portal;
const SideDialogClose = DialogPrimitive.Close;

const SideDialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className,
        )}
        {...props}
    />
));
SideDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SideDialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <SideDialogPortal>
        <SideDialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed right-4 top-4 bottom-4 z-50 flex w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-border/50 bg-background p-6 shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full sm:max-w-lg',
                className,
            )}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </SideDialogPortal>
));
SideDialogContent.displayName = DialogPrimitive.Content.displayName;

const SideDialogHeader = ({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex items-center justify-between pb-4 border-b border-border/50 mb-6',
            className,
        )}
        {...props}
    >
        <div className="flex flex-col space-y-1.5 text-left">
            {children}
        </div>
        <div className="flex items-center gap-2">
            <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none transition-colors">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </div>
    </div>
);
SideDialogHeader.displayName = 'SideDialogHeader';

const SideDialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-auto pt-6 border-t border-border/50',
            className,
        )}
        {...props}
    />
);
SideDialogFooter.displayName = 'SideDialogFooter';

const SideDialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            'text-lg font-semibold leading-none tracking-tight text-foreground/90',
            className,
        )}
        {...props}
    />
));
SideDialogTitle.displayName = DialogPrimitive.Title.displayName;

const SideDialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
SideDialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    SideDialog,
    SideDialogPortal,
    SideDialogOverlay,
    SideDialogClose,
    SideDialogTrigger,
    SideDialogContent,
    SideDialogHeader,
    SideDialogFooter,
    SideDialogTitle,
    SideDialogDescription,
};
