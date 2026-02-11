'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
				secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
				outline: 'text-foreground',
				success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
				warning: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
				error: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
				info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
				ai: 'border-transparent bg-ai-muted text-ai-foreground ring-1 ring-inset ring-ai/20 hover:bg-ai-muted/80',
				'ai-glow': 'border-transparent bg-ai-muted text-ai-foreground ring-1 ring-inset ring-ai/20 shadow-ai-glow animate-ai-glow',
				grade: {
					a: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
					b: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
					c: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
					d: 'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
					f: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
				}
			},
			size: {
				default: 'px-2.5 py-0.5',
				sm: 'px-2 py-0.25 text-xs',
				lg: 'px-3 py-1 text-sm'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
	return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

// Specialized badge components for common use cases

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
	status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
	({ status, className, ...props }, ref) => {
		const statusVariants = {
			pending: 'warning',
			'in-progress': 'info',
			completed: 'success',
			failed: 'error',
			cancelled: 'secondary'
		} as const;

		return (
			<Badge
				ref={ref}
				variant={statusVariants[status]}
				className={cn(className)}
				{...props}
			>
				{status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
			</Badge>
		);
	}
);
StatusBadge.displayName = 'StatusBadge';

interface GradeBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
	grade: number;
	maxGrade?: number;
	letterGrade?: boolean;
}

const GradeBadge = React.forwardRef<HTMLDivElement, GradeBadgeProps>(
	({ grade, maxGrade = 100, letterGrade = false, className, ...props }, ref) => {
		const percentage = (grade / maxGrade) * 100;

		let variant: keyof typeof badgeVariants.variants.variant;
		let letter = '';

		if (percentage >= 90) {
			variant = 'success';
			letter = 'A';
		} else if (percentage >= 80) {
			variant = 'info';
			letter = 'B';
		} else if (percentage >= 70) {
			variant = 'warning';
			letter = 'C';
		} else if (percentage >= 60) {
			variant = 'secondary';
			letter = 'D';
		} else {
			variant = 'error';
			letter = 'F';
		}

		return (
			<Badge
				ref={ref}
				variant={variant}
				className={cn('font-bold', className)}
				{...props}
			>
				{letterGrade ? letter : `${Math.round(percentage)}%`}
			</Badge>
		);
	}
);
GradeBadge.displayName = 'GradeBadge';

interface LanguageBadgeProps extends Omit<BadgeProps, 'variant'> {
	language: string;
}

const LanguageBadge = React.forwardRef<HTMLDivElement, LanguageBadgeProps>(
	({ language, className, ...props }, ref) => {
		// Language-specific color mapping
		const languageColors: Record<string, string> = {
			javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
			typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			python: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			java: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			cpp: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
			'c++': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
			c: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
			go: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
			rust: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
			php: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
			ruby: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
			swift: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			kotlin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
			scala: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
			html: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
			css: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			sql: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
		};

		const normalizedLang = language.toLowerCase();
		const colorClass = languageColors[normalizedLang] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';

		return (
			<div
				ref={ref}
				className={cn(
					'inline-flex items-center rounded-full border-transparent px-2.5 py-0.5 text-xs font-semibold font-mono',
					colorClass,
					className
				)}
				{...props}
			>
				{language.toUpperCase()}
			</div>
		);
	}
);
LanguageBadge.displayName = 'LanguageBadge';

interface AIBadgeProps extends Omit<BadgeProps, 'variant'> {
	type?: 'analysis' | 'feedback' | 'suggestion' | 'score' | 'processing';
	glowing?: boolean;
}

const AIBadge = React.forwardRef<HTMLDivElement, AIBadgeProps>(
	({ type = 'analysis', glowing = false, className, children, ...props }, ref) => {
		const typeIcons = {
			analysis: '🔍',
			feedback: '💬',
			suggestion: '💡',
			score: '📊',
			processing: '⚡'
		};

		return (
			<Badge
				ref={ref}
				variant={glowing ? 'ai-glow' : 'ai'}
				className={cn('gap-1.5', className)}
				{...props}
			>
				<span className="text-xs">{typeIcons[type]}</span>
				{children || `AI ${type.charAt(0).toUpperCase() + type.slice(1)}`}
			</Badge>
		);
	}
);
AIBadge.displayName = 'AIBadge';

interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
	priority: 'low' | 'medium' | 'high' | 'critical';
}

const PriorityBadge = React.forwardRef<HTMLDivElement, PriorityBadgeProps>(
	({ priority, className, ...props }, ref) => {
		const priorityVariants = {
			low: 'success',
			medium: 'warning',
			high: 'error',
			critical: 'destructive'
		} as const;

		const priorityIcons = {
			low: '🟢',
			medium: '🟡',
			high: '🟠',
			critical: '🔴'
		};

		return (
			<Badge
				ref={ref}
				variant={priorityVariants[priority]}
				className={cn('gap-1.5', className)}
				{...props}
			>
				<span className="text-xs">{priorityIcons[priority]}</span>
				{priority.charAt(0).toUpperCase() + priority.slice(1)}
			</Badge>
		);
	}
);
PriorityBadge.displayName = 'PriorityBadge';

interface DifficultyBadgeProps extends Omit<BadgeProps, 'variant'> {
	difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

const DifficultyBadge = React.forwardRef<HTMLDivElement, DifficultyBadgeProps>(
	({ difficulty, className, ...props }, ref) => {
		const difficultyVariants = {
			beginner: 'success',
			intermediate: 'warning',
			advanced: 'error',
			expert: 'destructive'
		} as const;

		const difficultyDots = {
			beginner: '●○○○',
			intermediate: '●●○○',
			advanced: '●●●○',
			expert: '●●●●'
		};

		return (
			<Badge
				ref={ref}
				variant={difficultyVariants[difficulty]}
				className={cn('gap-1.5 font-mono', className)}
				{...props}
			>
				<span className="text-xs leading-none">{difficultyDots[difficulty]}</span>
				{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
			</Badge>
		);
	}
);
DifficultyBadge.displayName = 'DifficultyBadge';

// Export everything
export {
	Badge,
	StatusBadge,
	GradeBadge,
	LanguageBadge,
	AIBadge,
	PriorityBadge,
	DifficultyBadge,
	badgeVariants
};
