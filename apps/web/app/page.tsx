import React from 'react';
import { Button } from '../components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	AICard
} from '../components/ui/card';
import { Input, TextArea } from '../components/ui/input';
import { Alert, SuccessAlert, WarningAlert, ErrorAlert, AIAlert } from '../components/ui/alert';
import {
	Progress,
	CircularProgress,
	AIProgress,
	AISkeletonProgress
} from '../components/ui/progress';
import { ThemeToggle } from '../components/ui/theme-toggle';

export default function HomePage() {
	return (
		<div className="min-h-screen bg-bg-default">
			{/* Header */}
			<header className="bg-bg-surface border-b border-border-default sticky top-0 z-40">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 bg-action-primary rounded-lg flex items-center justify-center">
								<span className="text-neutral-0 font-bold text-sm">GL</span>
							</div>
							<h1 className="text-xl font-semibold text-text-primary">GradeLoop V2</h1>
						</div>
						<div className="flex items-center gap-3">
							<span className="text-sm text-text-muted">AI-Integrated LMS</span>
							<ThemeToggle />
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				{/* Hero Section */}
				<section className="text-center mb-12">
					<h2 className="text-4xl font-bold text-text-primary mb-4">
						AI-Integrated Learning Management System
					</h2>
					<p className="text-lg text-text-secondary mb-8 max-w-3xl mx-auto">
						Experience our production-ready design system optimized for long coding sessions,
						accessibility, and AI contextual emphasis. Built with semantic clarity and low visual
						fatigue.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-4">
						<Button variant="primary" size="lg">
							Get Started
						</Button>
						<Button variant="secondary" size="lg">
							View Documentation
						</Button>
						<Button variant="ai" size="lg">
							Try AI Features
						</Button>
					</div>
				</section>

				{/* Design System Showcase */}
				<section className="grid gap-8">
					{/* Color Palette Demo */}
					<Card variant="elevated">
						<CardHeader>
							<CardTitle>Color System</CardTitle>
							<CardDescription>
								12-step neutral scale with semantic colors optimized for developer environments
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								{/* Brand Colors */}
								<div>
									<h4 className="font-semibold text-text-primary mb-3">Brand Colors</h4>
									<div className="flex gap-4 flex-wrap">
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-action-primary rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Primary</span>
										</div>
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-secondary rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Secondary</span>
										</div>
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-accent rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Accent</span>
										</div>
									</div>
								</div>

								{/* Semantic Colors */}
								<div>
									<h4 className="font-semibold text-text-primary mb-3">Semantic Colors</h4>
									<div className="flex gap-4 flex-wrap">
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-success rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Success</span>
										</div>
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-warning rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Warning</span>
										</div>
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-error rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Error</span>
										</div>
										<div className="flex flex-col items-center gap-2">
											<div className="w-16 h-16 bg-info rounded-lg border border-border-default"></div>
											<span className="text-xs text-text-muted">Info</span>
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Components Grid */}
					<div className="grid md:grid-cols-2 gap-8">
						{/* Buttons */}
						<Card>
							<CardHeader>
								<CardTitle>Buttons</CardTitle>
								<CardDescription>
									Interactive button variants with proper focus states
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex flex-wrap gap-3">
										<Button variant="primary" size="sm">
											Primary
										</Button>
										<Button variant="secondary" size="sm">
											Secondary
										</Button>
										<Button variant="ghost" size="sm">
											Ghost
										</Button>
										<Button variant="destructive" size="sm">
											Destructive
										</Button>
									</div>
									<div className="flex flex-wrap gap-3">
										<Button variant="primary" loading>
											Loading
										</Button>
										<Button variant="primary" disabled>
											Disabled
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Inputs */}
						<Card>
							<CardHeader>
								<CardTitle>Form Inputs</CardTitle>
								<CardDescription>Accessible inputs with validation states</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<Input
										placeholder="Enter your email"
										label="Email"
										helperText="We'll never share your email"
									/>
									<Input
										placeholder="Password"
										type="password"
										label="Password"
										error="Password must be at least 8 characters"
									/>
									<TextArea placeholder="Enter your message" label="Message" rows={3} />
								</div>
							</CardContent>
						</Card>
					</div>

					{/* AI Components */}
					<div className="grid md:grid-cols-2 gap-8">
						<AICard>
							<CardHeader>
								<CardTitle className="text-text-ai">AI-Powered Features</CardTitle>
								<CardDescription>
									Components specifically designed for AI interactions
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<AIAlert
										title="AI Suggestion"
										description="Based on your submission, consider reviewing the algorithm complexity section."
										dismissible
									/>
									<AIProgress value={75} label="AI Analysis" showPercentage />
									<AISkeletonProgress lines={3} />
								</div>
							</CardContent>
						</AICard>

						<Card>
							<CardHeader>
								<CardTitle>Progress Indicators</CardTitle>
								<CardDescription>Linear and circular progress with variants</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-6">
									<div className="space-y-3">
										<Progress value={25} variant="default" showPercentage />
										<Progress value={50} variant="success" showPercentage />
										<Progress value={75} variant="warning" showPercentage />
										<Progress value={90} variant="error" showPercentage />
									</div>

									<div className="flex justify-center gap-6">
										<CircularProgress value={60} size={80} />
										<CircularProgress value={85} variant="success" size={80} />
										<CircularProgress value={45} variant="ai" size={80} />
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Alerts */}
					<Card>
						<CardHeader>
							<CardTitle>Alert System</CardTitle>
							<CardDescription>Contextual feedback with semantic meaning</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<SuccessAlert
									title="Assignment Submitted"
									description="Your assignment has been successfully submitted and is being processed."
									dismissible
								/>
								<WarningAlert
									title="Incomplete Submission"
									description="Some required fields are missing. Please review before submitting."
									dismissible
								/>
								<ErrorAlert
									title="Submission Failed"
									description="There was an error submitting your assignment. Please try again."
									dismissible
								/>
								<AIAlert
									title="AI Analysis Complete"
									description="Your code has been analyzed. Check the feedback panel for suggestions."
									dismissible
								/>
							</div>
						</CardContent>
					</Card>

					{/* Code Editor Preview */}
					<Card>
						<CardHeader>
							<CardTitle>Code Editor Environment</CardTitle>
							<CardDescription>Always-dark code surfaces optimized for readability</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="code-editor rounded-lg p-4 font-mono text-sm">
								<div className="text-code-text">
									<div className="text-success">// AI-integrated grading system</div>
									<div className="text-info">function</div>{' '}
									<div className="text-warning">calculateGrade</div>(
									<div className="text-info">submission</div>) {'{'}
									<div className="ml-4">
										<div className="text-info">const</div> analysis ={' '}
										<div className="text-success">await</div>{' '}
										<div className="text-warning">aiAnalyzer.analyze</div>(submission);
									</div>
									<div className="ml-4">
										<div className="text-info">return</div> {'{'}
									</div>
									<div className="ml-8">score: analysis.score,</div>
									<div className="ml-8">feedback: analysis.suggestions,</div>
									<div className="ml-8">aiInsights: analysis.insights</div>
									<div className="ml-4">{'};'}</div>
									<div>{'}'}</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</section>

				{/* Footer */}
				<footer className="mt-16 pt-8 border-t border-border-default text-center">
					<p className="text-text-muted">
						GradeLoop V2 Design System - Built for AI-integrated learning experiences
					</p>
					<div className="mt-4 flex items-center justify-center gap-6">
						<span className="text-sm text-text-muted">Theme:</span>
						<ThemeToggle size="sm" variant="outline" />
					</div>
				</footer>
			</main>
		</div>
	);
}
