"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const FullScreenDialog = DialogPrimitive.Root;
const FullScreenDialogTrigger = DialogPrimitive.Trigger;
const FullScreenDialogPortal = DialogPrimitive.Portal;
const FullScreenDialogClose = DialogPrimitive.Close;

const FullScreenDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
FullScreenDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const FullScreenDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showMaximize?: boolean;
    onMaximize?: () => void;
    isMaximized?: boolean;
  }
>(
  (
    { className, children, isMaximized, ...props },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
        {...props}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-4 z-50 flex flex-col overflow-hidden rounded-xl bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:inset-8 lg:inset-12",
          isMaximized && "inset-0 rounded-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
FullScreenDialogContent.displayName = DialogPrimitive.Content.displayName;

const FullScreenDialogHeader = ({
  className,
  children,
  onMaximize,
  isMaximized,
  showMaximize,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  onMaximize?: () => void;
  isMaximized?: boolean;
  showMaximize?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center justify-between border-b px-6 py-4",
      className,
    )}
    {...props}
  >
    <div className="flex flex-col space-y-1">{children}</div>
    <div className="flex items-center gap-2">
      {showMaximize && (
        <button
          onClick={onMaximize}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
        >
          {isMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      )}
      <DialogPrimitive.Close asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </DialogPrimitive.Close>
    </div>
  </div>
);
FullScreenDialogHeader.displayName = "FullScreenDialogHeader";

const FullScreenDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
FullScreenDialogTitle.displayName = DialogPrimitive.Title.displayName;

const FullScreenDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
FullScreenDialogDescription.displayName =
  DialogPrimitive.Description.displayName;

export {
  FullScreenDialog,
  FullScreenDialogPortal,
  FullScreenDialogOverlay,
  FullScreenDialogClose,
  FullScreenDialogTrigger,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogTitle,
  FullScreenDialogDescription,
};
