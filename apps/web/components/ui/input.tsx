"use client";

import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "error" | "success";
  inputSize?: "sm" | "md" | "lg";
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const inputVariants = {
  default: `
    border-border-default bg-bg-surface text-text-primary
    placeholder:text-text-muted
    hover:border-neutral-400
    focus:border-action-primary focus:ring-2 focus:ring-action-primary focus:ring-opacity-20
    disabled:bg-neutral-100 disabled:border-neutral-200 disabled:text-text-disabled
    dark:disabled:bg-neutral-800 dark:disabled:border-neutral-700
  `,
  error: `
    border-error bg-bg-surface text-text-primary
    placeholder:text-text-muted
    hover:border-error
    focus:border-error focus:ring-2 focus:ring-error focus:ring-opacity-20
    disabled:bg-neutral-100 disabled:border-neutral-200 disabled:text-text-disabled
    dark:disabled:bg-neutral-800 dark:disabled:border-neutral-700
  `,
  success: `
    border-success bg-bg-surface text-text-primary
    placeholder:text-text-muted
    hover:border-success
    focus:border-success focus:ring-2 focus:ring-success focus:ring-opacity-20
    disabled:bg-neutral-100 disabled:border-neutral-200 disabled:text-text-disabled
    dark:disabled:bg-neutral-800 dark:disabled:border-neutral-700
  `,
};

const inputSizes = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-10 px-3 text-base",
  lg: "h-12 px-4 text-lg",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function Input({
  variant = "default",
  inputSize = "md",
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = "",
  id,
  disabled,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const finalVariant = error ? "error" : variant;
  const displayText = error || helperText;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            <span className={iconSizes[inputSize]}>{leftIcon}</span>
          </div>
        )}

        <input
          id={inputId}
          className={`
            w-full rounded-lg border transition-all duration-200 ease-in-out
            focus:outline-none
            disabled:cursor-not-allowed
            ${inputVariants[finalVariant]}
            ${inputSizes[inputSize]}
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon ? "pr-10" : ""}
            ${className}
          `.trim()}
          disabled={disabled}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <span className={iconSizes[inputSize]}>{rightIcon}</span>
          </div>
        )}
      </div>

      {displayText && (
        <p
          className={`text-sm ${
            error ? "text-error" : "text-text-muted"
          }`}
        >
          {displayText}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  variant = "default",
  label,
  helperText,
  error,
  className = "",
  id,
  disabled,
  rows = 3,
  ...props
}: Omit<InputProps, "leftIcon" | "rightIcon" | "inputSize"> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const finalVariant = error ? "error" : variant;
  const displayText = error || helperText;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}

      <textarea
        id={textareaId}
        rows={rows}
        className={`
          w-full rounded-lg border px-3 py-2 text-base
          transition-all duration-200 ease-in-out
          focus:outline-none resize-vertical
          disabled:cursor-not-allowed
          ${inputVariants[finalVariant]}
          ${className}
        `.trim()}
        disabled={disabled}
        {...props}
      />

      {displayText && (
        <p
          className={`text-sm ${
            error ? "text-error" : "text-text-muted"
          }`}
        >
          {displayText}
        </p>
      )}
    </div>
  );
}

export default Input;
