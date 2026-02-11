"use client";

import React from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "warning" | "error" | "info" | "ai";
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const alertVariants = {
  success: `
    bg-success bg-opacity-10 border-l-4 border-success
    text-success
  `,
  warning: `
    bg-warning bg-opacity-10 border-l-4 border-warning
    text-warning
  `,
  error: `
    bg-error bg-opacity-10 border-l-4 border-error
    text-error
  `,
  info: `
    bg-info bg-opacity-10 border-l-4 border-info
    text-info
  `,
  ai: `
    bg-bg-ai border-l-4 border-border-ai
    text-text-ai
    relative overflow-hidden
    before:absolute before:inset-0 before:bg-gradient-to-r
    before:from-ai-base before:from-0% before:to-transparent before:to-100%
    before:opacity-5 before:pointer-events-none
  `,
};

const alertSizes = {
  sm: "p-3 text-sm",
  md: "p-4 text-base",
  lg: "p-6 text-lg",
};

// Icons for different alert types
const SuccessIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ErrorIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AIIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const getDefaultIcon = (variant: AlertProps["variant"]) => {
  const iconSize = "w-5 h-5";

  switch (variant) {
    case "success":
      return <SuccessIcon className={iconSize} />;
    case "warning":
      return <WarningIcon className={iconSize} />;
    case "error":
      return <ErrorIcon className={iconSize} />;
    case "info":
      return <InfoIcon className={iconSize} />;
    case "ai":
      return <AIIcon className={iconSize} />;
    default:
      return <InfoIcon className={iconSize} />;
  }
};

export function Alert({
  variant = "info",
  size = "md",
  title,
  description,
  dismissible = false,
  onDismiss,
  icon,
  children,
  className = "",
  ...props
}: AlertProps) {
  const displayIcon = icon || getDefaultIcon(variant);

  return (
    <div
      className={`
        rounded-lg border-0 relative
        ${alertVariants[variant]}
        ${alertSizes[size]}
        ${className}
      `.trim()}
      role="alert"
      {...props}
    >
      <div className="flex items-start gap-3">
        {displayIcon && (
          <div className="flex-shrink-0 mt-0.5">
            {displayIcon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-semibold mb-1">
              {title}
            </h4>
          )}

          {description && (
            <p className="text-sm opacity-90">
              {description}
            </p>
          )}

          {children && (
            <div className="mt-2">
              {children}
            </div>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="
              flex-shrink-0 p-1 rounded-md
              hover:bg-black hover:bg-opacity-10
              dark:hover:bg-white dark:hover:bg-opacity-10
              transition-colors duration-200
              focus:outline-none focus-ring
            "
            aria-label="Dismiss alert"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Specialized alert components
export function SuccessAlert(props: Omit<AlertProps, "variant">) {
  return <Alert variant="success" {...props} />;
}

export function WarningAlert(props: Omit<AlertProps, "variant">) {
  return <Alert variant="warning" {...props} />;
}

export function ErrorAlert(props: Omit<AlertProps, "variant">) {
  return <Alert variant="error" {...props} />;
}

export function InfoAlert(props: Omit<AlertProps, "variant">) {
  return <Alert variant="info" {...props} />;
}

export function AIAlert(props: Omit<AlertProps, "variant">) {
  return <Alert variant="ai" {...props} />;
}

// Toast-style notification component
export interface ToastProps extends AlertProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  duration?: number;
  onAutoClose?: () => void;
}

const toastPositions = {
  "top-right": "fixed top-4 right-4 z-50",
  "top-left": "fixed top-4 left-4 z-50",
  "bottom-right": "fixed bottom-4 right-4 z-50",
  "bottom-left": "fixed bottom-4 left-4 z-50",
  "top-center": "fixed top-4 left-1/2 -translate-x-1/2 z-50",
  "bottom-center": "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
};

export function Toast({
  position = "top-right",
  duration = 5000,
  onAutoClose,
  dismissible = true,
  className = "",
  ...props
}: ToastProps) {
  React.useEffect(() => {
    if (duration > 0 && onAutoClose) {
      const timer = setTimeout(onAutoClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onAutoClose]);

  return (
    <Alert
      dismissible={dismissible}
      className={`
        ${toastPositions[position]}
        min-w-80 max-w-96
        shadow-lg
        animate-in slide-in-from-right-2 fade-in-0
        ${className}
      `.trim()}
      {...props}
    />
  );
}

export default Alert;
