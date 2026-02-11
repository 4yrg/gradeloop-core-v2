"use client";

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "ai";
  padding?: "sm" | "md" | "lg" | "none";
  children: React.ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const cardVariants = {
  default: `
    bg-bg-surface border-border-default
    shadow-sm
  `,
  elevated: `
    bg-bg-elevated border-border-default
    shadow-md hover:shadow-lg
    transition-shadow duration-200 ease-in-out
  `,
  ai: `
    bg-bg-ai border-l-4 border-border-ai
    shadow-sm
    relative
    before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-br
    before:from-ai-base before:from-0% before:to-transparent before:to-100%
    before:opacity-5 before:pointer-events-none
  `,
};

const cardPadding = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-lg border
        ${cardVariants[variant]}
        ${cardPadding[padding]}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={`
        flex flex-col space-y-1.5
        pb-4 border-b border-border-default
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`
        font-semibold text-lg leading-none tracking-tight
        text-text-primary
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`
        text-sm text-text-muted
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: CardContentProps) {
  return (
    <div
      className={`
        pt-4
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: CardFooterProps) {
  return (
    <div
      className={`
        flex items-center pt-4
        border-t border-border-default
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

// AI-specific card components
export function AICard({ className = "", children, ...props }: Omit<CardProps, 'variant'>) {
  return (
    <Card
      variant="ai"
      className={`ai-panel ${className}`}
      {...props}
    >
      {children}
    </Card>
  );
}

export function AICardHeader({ className = "", children, ...props }: CardHeaderProps) {
  return (
    <CardHeader
      className={`
        border-border-ai
        ${className}
      `.trim()}
      {...props}
    >
      <div className="flex items-center gap-2">
        <AIIcon className="w-4 h-4 text-text-ai" />
        {children}
      </div>
    </CardHeader>
  );
}

// AI Icon component
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

export default Card;
