"use client";

import { cn } from "@/lib/utils";

interface SemanticSimilarityBadgeProps {
  /**
   * The semantic similarity score (0-100)
   */
  score: number;
  /**
   * Show label text (e.g., "Very Low Similarity")
   */
  showLabel?: boolean;
  /**
   * Size variant
   */
  size?: "sm" | "md";
  /**
   * Custom className for the container
   */
  className?: string;
}

/**
 * Determines the color scheme based on score value
 */
function getColorScheme(score: number) {
  if (score >= 90) {
    return {
      bg: "bg-emerald-100 dark:bg-emerald-950/50",
      text: "text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-500",
    };
  }
  if (score >= 75) {
    return {
      bg: "bg-amber-100 dark:bg-amber-950/50",
      text: "text-amber-700 dark:text-amber-300",
      bar: "bg-amber-500",
    };
  }
  if (score >= 50) {
    return {
      bg: "bg-blue-100 dark:bg-blue-950/50",
      text: "text-blue-700 dark:text-blue-300",
      bar: "bg-blue-500",
    };
  }
  return {
    bg: "bg-slate-100 dark:bg-slate-950/50",
    text: "text-slate-700 dark:text-slate-300",
    bar: "bg-slate-500",
  };
}

/**
 * Determines the semantic label based on score
 */
function getSemanticLabel(score: number): string {
  if (score >= 90) return "Very High Similarity";
  if (score >= 75) return "High Similarity";
  if (score >= 50) return "Moderate Similarity";
  if (score >= 25) return "Low Similarity";
  return "Very Low Similarity";
}

/**
 * Displays semantic similarity as a colored badge with progress bar.
 * Matches the style of AILikelihoodBadge component.
 */
export function SemanticSimilarityBadge({
  score,
  showLabel = true,
  size = "md",
  className,
}: SemanticSimilarityBadgeProps) {
  const colors = getColorScheme(score);
  const semanticLabel = getSemanticLabel(score);
  const percentage = Math.round(score);

  if (size === "sm") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
          colors.bg,
          colors.text,
          className
        )}
      >
        <div className="w-12 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] font-medium">{percentage}%</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5",
        colors.bg,
        colors.text,
        className
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-[80px]">
        <div className="flex items-center justify-between gap-2">
          {showLabel && (
            <span className="text-xs font-semibold uppercase tracking-wide">
              {semanticLabel}
            </span>
          )}
          <span className="text-xs font-bold tabular-nums">{percentage}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for table cells
 */
export function SemanticSimilarityCompact({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const colors = getColorScheme(score);
  const percentage = Math.round(score);

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        colors.text,
        className
      )}
    >
      <div className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", colors.bar)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums">{percentage}%</span>
    </div>
  );
}
