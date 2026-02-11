"use client";

import React from "react";
import { useTheme } from "../providers/theme-provider";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
}

const sizeClasses = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
};

const variantClasses = {
  default: "bg-bg-surface border-border-default hover:bg-bg-elevated",
  outline: "border-2 border-border-default bg-transparent hover:bg-bg-surface",
  ghost: "bg-transparent hover:bg-bg-surface",
};

const SunIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx={12} cy={12} r={5} />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

const SystemIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x={2} y={3} width={20} height={14} rx={2} ry={2} />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export function ThemeToggle({
  className = "",
  size = "md",
  variant = "default",
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleClick = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

    if (theme === "system") {
      return <SystemIcon className={iconSize} />;
    } else if (resolvedTheme === "dark") {
      return <MoonIcon className={iconSize} />;
    } else {
      return <SunIcon className={iconSize} />;
    }
  };

  const getTooltipText = () => {
    if (theme === "light") return "Switch to dark theme";
    if (theme === "dark") return "Switch to system theme";
    return "Switch to light theme";
  };

  return (
    <button
      onClick={handleClick}
      title={getTooltipText()}
      aria-label={getTooltipText()}
      className={`
        relative inline-flex items-center justify-center
        rounded-lg border transition-all duration-200 ease-in-out
        focus:outline-none focus-ring
        text-text-secondary hover:text-text-primary
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `.trim()}
    >
      {getIcon()}

      {/* Theme indicator dot */}
      {theme === "system" && (
        <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-accent rounded-full border border-bg-surface" />
      )}
    </button>
  );
}

export default ThemeToggle;
