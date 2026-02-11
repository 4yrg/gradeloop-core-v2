"use client";

import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "ai";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const buttonVariants = {
  primary: `
    bg-action-primary text-neutral-0 border-transparent
    hover:bg-action-primary-hover
    active:bg-action-primary-active
    disabled:bg-neutral-200 disabled:text-neutral-400
    dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600
  `,
  secondary: `
    bg-neutral-100 text-text-primary border-neutral-300
    hover:bg-neutral-200
    active:bg-neutral-300
    disabled:bg-neutral-200 disabled:text-neutral-400
    dark:bg-neutral-800 dark:text-text-primary dark:border-neutral-700
    dark:hover:bg-neutral-700
    dark:active:bg-neutral-600
    dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600
  `,
  ghost: `
    bg-transparent text-action-primary border-transparent
    hover:bg-action-primary hover:bg-opacity-5
    active:bg-action-primary active:bg-opacity-10
    disabled:text-neutral-400
    dark:disabled:text-neutral-600
  `,
  destructive: `
    bg-error text-neutral-0 border-transparent
    hover:opacity-90
    active:opacity-80
    disabled:bg-neutral-200 disabled:text-neutral-400
    dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600
  `,
  ai: `
    bg-bg-ai text-text-ai border-border-ai
    hover:bg-opacity-80
    active:bg-opacity-70
    disabled:bg-neutral-200 disabled:text-neutral-400
    dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600
    relative overflow-hidden
    before:absolute before:inset-0 before:bg-gradient-to-r
    before:from-transparent before:via-white before:to-transparent
    before:opacity-0 hover:before:opacity-10 before:transition-opacity
  `,
};

const buttonSizes = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-base gap-2",
  lg: "h-12 px-6 text-lg gap-2.5",
};

const LoadingSpinner = ({ size }: { size: "sm" | "md" | "lg" }) => {
  const spinnerSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <svg
      className={`animate-spin ${spinnerSize[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-lg border font-medium
        transition-all duration-200 ease-in-out
        focus:outline-none focus-ring
        disabled:cursor-not-allowed
        ${buttonVariants[variant]}
        ${buttonSizes[size]}
        ${className}
      `.trim()}
      disabled={isDisabled}
      {...props}
    >
      {loading && <LoadingSpinner size={size} />}
      {children}
    </button>
  );
}

export default Button;
