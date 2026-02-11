'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-lg border bg-card text-card-foreground shadow-sm', {
	variants: {
		variant: {
			default: 'border-border',
			elevated: 'shadow-elevation-2 hover:shadow-elevation-3 transition-shadow duration-200',
			interactive:
				'cursor-pointer hover:shadow-elevation-2 hover:border-border/60 transition-all duration-200',
			ai: 'bg-ai-muted border-ai-border shadow-ai-glow/20',
			success: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20',
			warning: 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20',
			error: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20',
			info: 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
		},
		size: {
			default: 'p-6',
			sm: 'p-4',
			lg: 'p-8',
			xl: 'p-12'
		}
	},
	defaultVariants: {
		variant: 'default',
		size: 'default'
	}
});

export interface CardProps
	extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ className, variant, size, ...props }, ref) => (
		<div ref={ref} className={cn(cardVariants({ variant, size, className }))} {...props} />
	)
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div ref={ref} className={cn('flex flex-col space-y-1.5 pb-6', className)} {...props} />
	)
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<h3
			ref={ref}
			className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
			{...props}
		/>
	)
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => <div ref={ref} className={cn('pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div ref={ref} className={cn('flex items-center pt-6', className)} {...props} />
	)
);
CardFooter.displayName = 'CardFooter';

// AI-specific card components
const AICard = React.forwardRef<
	HTMLDivElement,
	CardProps & {
		glowing?: boolean;
		pulsing?: boolean;
	}
>(({ className, glowing = false, pulsing = false, ...props }, ref) => (
	<Card
		ref={ref}
		variant="ai"
		className={cn(
			'relative',
			{
				'ai-glow': glowing,
				'ai-pulse': pulsing
			},
			className
		)}
		{...props}
	/>
));
AICard.displayName = 'AICard';

const AICardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & {
		showBadge?: boolean;
		badgeText?: string;
	}
>(({ className, showBadge = true, badgeText = 'AI', children, ...props }, ref) => (
	<CardHeader ref={ref} className={cn('relative', className)} {...props}>
		{showBadge && <div className="absolute top-0 right-0 ai-badge">{badgeText}</div>}
		{children}
	</CardHeader>
));
AICardHeader.displayName = 'AICardHeader';

// Status card variants
const StatusCard = React.forwardRef<
	HTMLDivElement,
	CardProps & {
		status: 'success' | 'warning' | 'error' | 'info';
		icon?: React.ReactNode;
	}
>(({ className, status, icon, children, ...props }, ref) => (
	<Card ref={ref} variant={status} className={cn('relative', className)} {...props}>
		{icon && <div className="absolute top-4 right-4 opacity-60">{icon}</div>}
		{children}
	</Card>
));
StatusCard.displayName = 'StatusCard';

// Grade card for assignment results
const GradeCard = React.forwardRef<
	HTMLDivElement,
	CardProps & {
		grade: number;
		maxGrade?: number;
		showPercentage?: boolean;
	}
>(({ className, grade, maxGrade = 100, showPercentage = true, children, ...props }, ref) => {
	const percentage = (grade / maxGrade) * 100;
	let variant: 'success' | 'info' | 'warning' | 'error' = 'info';

	if (percentage >= 90) variant = 'success';
	else if (percentage >= 80) variant = 'info';
	else if (percentage >= 70) variant = 'warning';
	else variant = 'error';

	return (
		<Card
			ref={ref}
			variant={variant}
			className={cn('relative overflow-hidden', className)}
			{...props}
		>
			<div className="absolute top-0 right-0 p-4">
				<div
					className={cn('text-2xl font-bold', {
						'text-green-600 dark:text-green-400': variant === 'success',
						'text-blue-600 dark:text-blue-400': variant === 'info',
						'text-yellow-600 dark:text-yellow-400': variant === 'warning',
						'text-red-600 dark:text-red-400': variant === 'error'
					})}
				>
					{showPercentage ? `${Math.round(percentage)}%` : `${grade}/${maxGrade}`}
				</div>
			</div>
			<div className="pr-20">{children}</div>
		</Card>
	);
});
GradeCard.displayName = 'GradeCard';

// Code submission card
const CodeSubmissionCard = React.forwardRef<
	HTMLDivElement,
	CardProps & {
		language?: string;
		submissionTime?: string;
		status?: 'pending' | 'grading' | 'completed' | 'failed';
	}
>(({ className, language, submissionTime, status = 'pending', children, ...props }, ref) => {
	const statusColors = {
		pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
		grading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
		completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
		failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
	};

	return (
		<Card ref={ref} variant="elevated" className={cn('code-submission', className)} {...props}>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					{language && (
						<span className="text-xs font-mono bg-muted px-2 py-1 rounded">{language}</span>
					)}
					<span className={cn('text-xs px-2 py-1 rounded-full font-medium', statusColors[status])}>
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</span>
				</div>
				{submissionTime && <span className="text-xs text-muted-foreground">{submissionTime}</span>}
			</div>
			{children}
		</Card>
	);
});
CodeSubmissionCard.displayName = 'CodeSubmissionCard';

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
	AICard,
	AICardHeader,
	StatusCard,
	GradeCard,
	CodeSubmissionCard,
	cardVariants
};
