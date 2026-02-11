'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	AICard,
	AICardHeader,
	StatusCard,
	GradeCard,
	CodeSubmissionCard
} from '@/components/ui/card';
import {
	Badge,
	StatusBadge,
	GradeBadge,
	LanguageBadge,
	AIBadge,
	PriorityBadge,
	DifficultyBadge
} from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ThemeDemo() {
	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="header p-6">
				<div className="max-w-7xl mx-auto">
					<h1 className="text-4xl font-bold text-foreground mb-2">
						GradeLoop V2 Theme System
					</h1>
					<p className="text-muted-foreground">
						AI-Integrated Learning Management System - ShadCN Theme Showcase
					</p>
				</div>
			</header>

			<main className="main-content p-6">
				<div className="max-w-7xl mx-auto space-y-12">
					{/* Color Palette Section */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Color System</h2>
						<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
							{/* Primary Colors */}
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">Primary</h3>
								<div className="bg-primary rounded-lg h-20 flex items-end p-3">
									<span className="text-primary-foreground text-sm font-medium">Primary</span>
								</div>
							</div>
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">Secondary</h3>
								<div className="bg-secondary rounded-lg h-20 flex items-end p-3">
									<span className="text-secondary-foreground text-sm font-medium">Secondary</span>
								</div>
							</div>
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">Accent</h3>
								<div className="bg-accent rounded-lg h-20 flex items-end p-3">
									<span className="text-accent-foreground text-sm font-medium">Accent</span>
								</div>
							</div>
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">AI Theme</h3>
								<div className="bg-ai rounded-lg h-20 flex items-end p-3">
									<span className="text-ai-foreground text-sm font-medium">AI</span>
								</div>
							</div>
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">Destructive</h3>
								<div className="bg-destructive rounded-lg h-20 flex items-end p-3">
									<span className="text-destructive-foreground text-sm font-medium">Destructive</span>
								</div>
							</div>
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-muted-foreground">Muted</h3>
								<div className="bg-muted rounded-lg h-20 flex items-end p-3">
									<span className="text-muted-foreground text-sm font-medium">Muted</span>
								</div>
							</div>
						</div>
					</section>

					{/* Typography Section */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Typography</h2>
						<Card>
							<CardContent className="space-y-4">
								<h1>Heading 1 - Main Page Title</h1>
								<h2>Heading 2 - Section Title</h2>
								<h3>Heading 3 - Subsection Title</h3>
								<h4>Heading 4 - Component Title</h4>
								<h5>Heading 5 - Small Component Title</h5>
								<h6>Heading 6 - Caption Title</h6>
								<p className="text-base">
									Body text - This is the main content text used throughout the application. It's optimized for readability during long coding sessions.
								</p>
								<p className="text-sm text-muted-foreground">
									Small text - Used for captions, metadata, and secondary information.
								</p>
								<code>inline code snippet</code>
								<pre className="code-editor p-4">
									<code>{`function gradeAssignment(submission) {
  // AI-powered grading logic
  return aiGrader.evaluate(submission);
}`}</code>
								</pre>
							</CardContent>
						</Card>
					</section>

					{/* Button Variants */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Button Components</h2>
						<div className="space-y-6">
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Standard Variants</h3>
								<div className="flex flex-wrap gap-3">
									<Button variant="default">Default</Button>
									<Button variant="secondary">Secondary</Button>
									<Button variant="destructive">Destructive</Button>
									<Button variant="outline">Outline</Button>
									<Button variant="ghost">Ghost</Button>
									<Button variant="link">Link</Button>
									<Button variant="ai">AI Feature</Button>
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Sizes</h3>
								<div className="flex items-center gap-3">
									<Button size="sm">Small</Button>
									<Button size="default">Default</Button>
									<Button size="lg">Large</Button>
									<Button size="icon">🔍</Button>
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">States</h3>
								<div className="flex gap-3">
									<Button loading>Loading</Button>
									<Button disabled>Disabled</Button>
									<Button variant="ai" loading>AI Processing</Button>
								</div>
							</div>
						</div>
					</section>

					{/* Badge Components */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Badge System</h2>
						<div className="space-y-6">
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Status Badges</h3>
								<div className="flex flex-wrap gap-2">
									<StatusBadge status="pending" />
									<StatusBadge status="in-progress" />
									<StatusBadge status="completed" />
									<StatusBadge status="failed" />
									<StatusBadge status="cancelled" />
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Grade Badges</h3>
								<div className="flex flex-wrap gap-2">
									<GradeBadge grade={95} />
									<GradeBadge grade={85} />
									<GradeBadge grade={75} />
									<GradeBadge grade={65} />
									<GradeBadge grade={45} />
									<GradeBadge grade={95} letterGrade />
									<GradeBadge grade={75} letterGrade />
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Language Badges</h3>
								<div className="flex flex-wrap gap-2">
									<LanguageBadge language="Python" />
									<LanguageBadge language="JavaScript" />
									<LanguageBadge language="Java" />
									<LanguageBadge language="C++" />
									<LanguageBadge language="Go" />
									<LanguageBadge language="Rust" />
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">AI Badges</h3>
								<div className="flex flex-wrap gap-2">
									<AIBadge type="analysis" />
									<AIBadge type="feedback" />
									<AIBadge type="suggestion" />
									<AIBadge type="score" glowing />
									<AIBadge type="processing">Analyzing Code</AIBadge>
								</div>
							</div>
							<div className="space-y-3">
								<h3 className="text-lg font-medium">Priority & Difficulty</h3>
								<div className="flex flex-wrap gap-2">
									<PriorityBadge priority="low" />
									<PriorityBadge priority="medium" />
									<PriorityBadge priority="high" />
									<PriorityBadge priority="critical" />
									<DifficultyBadge difficulty="beginner" />
									<DifficultyBadge difficulty="intermediate" />
									<DifficultyBadge difficulty="advanced" />
									<DifficultyBadge difficulty="expert" />
								</div>
							</div>
						</div>
					</section>

					{/* Card Components */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Card System</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{/* Standard Card */}
							<Card variant="default">
								<CardHeader>
									<CardTitle>Assignment Overview</CardTitle>
									<CardDescription>Track your coding assignments and progress</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span>Completed</span>
											<span className="font-medium">8/12</span>
										</div>
										<div className="flex justify-between">
											<span>Average Grade</span>
											<span className="font-medium">87%</span>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* AI Card */}
							<AICard>
								<AICardHeader>
									<CardTitle>AI Code Analysis</CardTitle>
									<CardDescription>Intelligent feedback on your submission</CardDescription>
								</AICardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="ai-panel p-3 rounded-lg">
											<p className="text-sm">
												Your code structure is well-organized. Consider optimizing the loop in line 24 for better performance.
											</p>
										</div>
										<div className="flex gap-2">
											<AIBadge type="suggestion" />
											<Badge variant="success">High Quality</Badge>
										</div>
									</div>
								</CardContent>
							</AICard>

							{/* Grade Card */}
							<GradeCard grade={92} maxGrade={100}>
								<CardHeader>
									<CardTitle>Data Structures Assignment</CardTitle>
									<CardDescription>Binary Search Tree Implementation</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Correctness</span>
											<span>95%</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Code Quality</span>
											<span>90%</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Performance</span>
											<span>91%</span>
										</div>
									</div>
								</CardContent>
							</GradeCard>

							{/* Status Cards */}
							<StatusCard status="success" icon="✅">
								<CardHeader>
									<CardTitle>All Tests Passed</CardTitle>
									<CardDescription>Your solution is correct and efficient</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="text-sm text-muted-foreground">
											Runtime: 0.05s | Memory: 2.1MB
										</div>
									</div>
								</CardContent>
							</StatusCard>

							<StatusCard status="warning" icon="⚠️">
								<CardHeader>
									<CardTitle>Potential Issues</CardTitle>
									<CardDescription>Some optimizations recommended</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										<div className="text-sm text-muted-foreground">
											3 warnings detected in your code
										</div>
									</div>
								</CardContent>
							</StatusCard>

							{/* Code Submission Card */}
							<CodeSubmissionCard
								language="Python"
								submissionTime="2 hours ago"
								status="completed"
							>
								<CardHeader>
									<CardTitle>Sorting Algorithm</CardTitle>
									<CardDescription>QuickSort implementation with analysis</CardDescription>
								</CardHeader>
								<CardContent>
									<pre className="text-sm bg-code-background text-code-foreground p-3 rounded">
										<code>{`def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    # ... implementation`}</code>
									</pre>
								</CardContent>
							</CodeSubmissionCard>
						</div>
					</section>

					{/* Interactive Elements */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Interactive Elements</h2>
						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Focus & Hover States</CardTitle>
									<CardDescription>All interactive elements support focus-visible and hover states</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<Button className="w-full">Hover me</Button>
										<input
											type="text"
											placeholder="Focus me with Tab"
											className="w-full"
										/>
									</div>
									<Card variant="interactive" className="p-4 cursor-pointer">
										<p className="text-sm">This card is interactive - hover and click me!</p>
									</Card>
								</CardContent>
							</Card>
						</div>
					</section>

					{/* Accessibility Features */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Accessibility Features</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>WCAG AA Compliance</CardTitle>
									<CardDescription>All colors meet WCAG AA contrast requirements</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span>Primary/Background</span>
											<Badge variant="success">4.7:1</Badge>
										</div>
										<div className="flex justify-between">
											<span>Muted Text</span>
											<Badge variant="success">4.5:1</Badge>
										</div>
										<div className="flex justify-between">
											<span>AI Theme</span>
											<Badge variant="success">5.2:1</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Reduced Motion Support</CardTitle>
									<CardDescription>Respects user's motion preferences</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-sm">
										<p>Animations are automatically reduced when user has `prefers-reduced-motion` enabled.</p>
										<Button variant="ai" className="animate-pulse">
											Animation Example
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>
					</section>

					{/* Layout Examples */}
					<section>
						<h2 className="text-2xl font-semibold mb-6">Layout Examples</h2>
						<div className="space-y-6">
							{/* Dashboard Grid */}
							<Card>
								<CardHeader>
									<CardTitle>Dashboard Grid</CardTitle>
									<CardDescription>Responsive grid system for dashboard components</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="dashboard-grid">
										{Array.from({ length: 8 }, (_, i) => (
											<div key={i} className="dashboard-card">
												<h4 className="font-medium mb-2">Metric {i + 1}</h4>
												<p className="text-2xl font-bold">
													{Math.floor(Math.random() * 1000)}
												</p>
											</div>
										))}
									</div>
								</CardContent>
							</Card>

							{/* Sidebar Layout */}
							<Card>
								<CardHeader>
									<CardTitle>Application Layout</CardTitle>
									<CardDescription>Standard sidebar + main content layout</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex h-48 rounded-lg overflow-hidden border">
										<div className="sidebar w-64 p-4">
											<h5 className="font-medium mb-3">Navigation</h5>
											<div className="space-y-2">
												<div className="p-2 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
													Dashboard
												</div>
												<div className="p-2 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
													Assignments
												</div>
												<div className="p-2 rounded bg-accent text-accent-foreground text-sm">
													AI Analysis
												</div>
											</div>
										</div>
										<div className="flex-1 p-4">
											<h5 className="font-medium mb-3">Main Content Area</h5>
											<p className="text-sm text-muted-foreground">
												This is where the primary application content would be displayed.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</section>
				</div>
			</main>

			{/* Footer */}
			<footer className="footer p-6 mt-12">
				<div className="max-w-7xl mx-auto text-center">
					<p className="text-sm text-muted-foreground">
						GradeLoop V2 - AI-Integrated Learning Management System
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Built with ShadCN/UI + Tailwind CSS
					</p>
				</div>
			</footer>
		</div>
	);
}
