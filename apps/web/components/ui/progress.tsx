"use client";

import React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "error" | "ai";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  striped?: boolean;
}

const progressVariants = {
  default: {
    track: "bg-neutral-200 dark:bg-neutral-700",
    fill: "bg-action-primary",
    text: "text-text-primary",
  },
  success: {
    track: "bg-neutral-200 dark:bg-neutral-700",
    fill: "bg-success",
    text: "text-success",
  },
  warning: {
    track: "bg-neutral-200 dark:bg-neutral-700",
    fill: "bg-warning",
    text: "text-warning",
  },
  error: {
    track: "bg-neutral-200 dark:bg-neutral-700",
    fill: "bg-error",
    text: "text-error",
  },
  ai: {
    track: "bg-neutral-200 dark:bg-neutral-700",
    fill: "bg-gradient-to-r from-ai-base to-accent",
    text: "text-text-ai",
  },
};

const progressSizes = {
  sm: {
    height: "h-1",
    text: "text-xs",
    gap: "gap-1",
  },
  md: {
    height: "h-2",
    text: "text-sm",
    gap: "gap-2",
  },
  lg: {
    height: "h-3",
    text: "text-base",
    gap: "gap-3",
  },
};

export function Progress({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showLabel = false,
  label,
  showPercentage = false,
  animated = false,
  striped = false,
  className = "",
  ...props
}: ProgressProps) {
  // Ensure value is within bounds
  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = (clampedValue / max) * 100;

  const variantClasses = progressVariants[variant];
  const sizeClasses = progressSizes[size];

  return (
    <div
      className={`w-full ${className}`}
      {...props}
    >
      {(showLabel || showPercentage) && (
        <div className={`flex items-center justify-between mb-2 ${sizeClasses.gap}`}>
          {showLabel && (
            <span className={`font-medium ${sizeClasses.text} ${variantClasses.text}`}>
              {label || "Progress"}
            </span>
          )}
          {showPercentage && (
            <span className={`${sizeClasses.text} ${variantClasses.text} font-mono`}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`
          w-full rounded-full overflow-hidden
          ${sizeClasses.height}
          ${variantClasses.track}
        `.trim()}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress"}
      >
        <div
          className={`
            ${sizeClasses.height}
            rounded-full transition-all duration-300 ease-in-out
            ${variantClasses.fill}
            ${animated ? "animate-pulse" : ""}
            ${striped ? "bg-stripes" : ""}
            ${variant === "ai" ? "relative overflow-hidden" : ""}
          `.trim()}
          style={{ width: `${percentage}%` }}
        >
          {variant === "ai" && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
          )}
        </div>
      </div>
    </div>
  );
}

// Circular Progress Component
export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "error" | "ai";
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  children?: React.ReactNode;
}

export function CircularProgress({
  value,
  max = 100,
  variant = "default",
  size = 120,
  strokeWidth = 8,
  showLabel = false,
  showPercentage = true,
  children,
  className = "",
  ...props
}: CircularProgressProps) {
  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = (clampedValue / max) * 100;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const variantClasses = progressVariants[variant];

  const getStrokeColor = () => {
    switch (variant) {
      case "success": return "#10B981";
      case "warning": return "#F59E0B";
      case "error": return "#EF4444";
      case "ai": return "#8B5CF6";
      default: return "#4F46E5";
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-neutral-200 dark:text-neutral-700"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-in-out"
          style={{
            filter: variant === "ai" ? "drop-shadow(0 0 8px rgba(139, 92, 246, 0.3))" : "none",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (
          <div className="text-center">
            {showPercentage && (
              <div className={`font-bold text-lg ${variantClasses.text}`}>
                {Math.round(percentage)}%
              </div>
            )}
            {showLabel && (
              <div className={`text-xs ${variantClasses.text} opacity-75`}>
                Progress
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// AI-specific progress components
export function AIProgress(props: Omit<ProgressProps, "variant">) {
  return <Progress variant="ai" animated {...props} />;
}

export function AICircularProgress(props: Omit<CircularProgressProps, "variant">) {
  return <CircularProgress variant="ai" {...props} />;
}

// Skeleton loader progress for AI operations
export function AISkeletonProgress({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-2 bg-bg-ai rounded-full animate-pulse"
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${index * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export default Progress;
