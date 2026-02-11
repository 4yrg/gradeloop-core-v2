<script lang="ts">
	import {
		Button,
		Input,
		Textarea,
		Checkbox,
		AppShell,
		Sidebar,
		TopBar,
		ThemeToggle,
		AISuggestionPanel,
		AIInlineHint,
		AIStreamingText
	} from '$lib/components';
	import { Sparkles, Search, Plus, Settings, User, Book, GraduationCap, BarChart3, Bell, Menu } from 'lucide-svelte';

	// Demo state
	let searchValue = '';
	let textareaValue = '';
	let checkboxValue = false;
	let sidebarCollapsed = false;
	let mobileSidebarOpen = false;
	let aiPanelOpen = true;
	let streamingText = "Welcome to GradeLoop's AI-powered component library! This demonstration showcases our comprehensive suite of UI components designed specifically for educational technology. Our components feature accessibility-first design, AI-enhanced interactions, and seamless light/dark mode support.";
	let isStreaming = true;

	// Sample data
	const navItems = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			icon: BarChart3,
			active: true,
			roles: ['student', 'instructor', 'admin']
		},
		{
			id: 'assignments',
			label: 'Assignments',
			icon: Book,
			badge: '3',
			roles: ['student', 'instructor']
		},
		{
			id: 'students',
			label: 'Students',
			icon: GraduationCap,
			roles: ['instructor', 'admin']
		},
		{
			id: 'settings',
			label: 'Settings',
			icon: Settings,
			roles: ['student', 'instructor', 'admin']
		}
	];

	const notifications = [
		{
			id: '1',
			title: 'Assignment Graded',
			message: 'Your JavaScript fundamentals assignment has been graded by AI',
			type: 'ai' as const,
			timestamp: new Date(Date.now() - 1000 * 60 * 5),
			read: false
		},
		{
			id: '2',
			title: 'New Submission',
			message: 'Sarah Chen submitted her React project',
			type: 'info' as const,
			timestamp: new Date(Date.now() - 1000 * 60 * 15),
			read: false
		}
	];

	const userMenuItems = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'settings', label: 'Settings', icon: Settings },
		{ id: 'divider', divider: true },
		{ id: 'logout', label: 'Sign Out' }
	];

	const user = {
		name: 'Dr. Jane Smith',
		email: 'jane.smith@university.edu',
		role: 'instructor'
	};

	const aiSuggestions = [
		{
			id: '1',
			type: 'code' as const,
			title: 'Performance Optimization',
			content: `// Optimized function with memoization
const fibonacci = (function() {
  const cache = {};
  return function fib(n) {
    if (n in cache) return cache[n];
    if (n <= 1) return n;
    cache[n] = fib(n-1) + fib(n-2);
    return cache[n];
  };
})();`,
			confidence: 0.92,
			reasoning: 'This memoized version reduces time complexity from O(2^n) to O(n) by caching previously calculated values.'
		},
		{
			id: '2',
			type: 'improvement' as const,
			title: 'Code Structure',
			content: 'Consider extracting the validation logic into a separate utility function for better reusability.',
			confidence: 0.85,
			reasoning: 'Following DRY principles improves maintainability and reduces potential bugs.'
		}
	];

	function handleSearch(query: string) {
		console.log('Search:', query);
	}

	function handleNotificationClick(notification: any) {
		console.log('Notification clicked:', notification);
	}

	function handleUserMenuClick(item: any) {
		console.log('User menu clicked:', item);
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleMobileSidebar() {
		mobileSidebarOpen = !mobileSidebarOpen;
	}

	function handleNavigation(item: any) {
		console.log('Navigate to:', item.detail.label);
	}
</script>

<svelte:head>
	<title>Component Demo - GradeLoop</title>
	<meta name="description" content="Interactive demo of GradeLoop's AI-focused component library" />
</svelte:head>

<AppShell
	bind:mobileSidebarOpen
	sidebarCollapsed={sidebarCollapsed}
	class="min-h-screen"
>
	{#snippet sidebar()}
		<Sidebar
			items={navItems}
			collapsed={sidebarCollapsed}
			userRole="instructor"
			currentPath="/demo"
			onNavigate={handleNavigation}
			onToggleCollapse={toggleSidebar}
		>
			{#snippet logo()}
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
						<Sparkles size={20} class="text-primary-foreground" />
					</div>
					{#if !sidebarCollapsed}
						<span class="font-bold text-lg">GradeLoop</span>
					{/if}
				</div>
			{/snippet}

			{#snippet footer()}
				<div class="flex items-center gap-3 p-3 bg-sidebar-accent/20 rounded-lg">
					<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
						<User size={16} class="text-primary-foreground" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="font-medium text-sm truncate">Dr. Jane Smith</div>
						<div class="text-xs text-sidebar-foreground/70">Instructor</div>
					</div>
				</div>
			{/snippet}
		</Sidebar>
	{/snippet}

	{#snippet header()}
		<TopBar
			{user}
			{notifications}
			{userMenuItems}
			bind:searchValue
			bind:mobileSidebarOpen
			searchPlaceholder="Search assignments, students..."
			onSearch={handleSearch}
			onNotificationClick={handleNotificationClick}
			onUserMenuClick={handleUserMenuClick}
			onMobileMenuToggle={toggleMobileSidebar}
		>
			{#snippet leftContent()}
				{#if !mobileSidebarOpen}
					<h1 class="text-xl font-semibold">Component Library Demo</h1>
				{/if}
			{/snippet}

			{#snippet rightContent()}
				<ThemeToggle size="md" variant="dropdown" />
			{/snippet}
		</TopBar>
	{/snippet}

	<!-- Main Content -->
	<div class="space-y-8">
		<!-- Hero Section -->
		<div class="bg-gradient-to-r from-primary/10 via-ai-highlight/10 to-accent/10 rounded-xl p-8">
			<div class="text-center max-w-3xl mx-auto">
				<h2 class="text-3xl font-bold mb-4">AI-Powered Component Library</h2>
				<p class="text-lg text-muted-foreground mb-6">
					Explore our comprehensive suite of components designed for modern educational technology
				</p>
				<div class="flex justify-center gap-4">
					<Button variant="primary" size="lg">
						{#snippet children()}
							<Plus size={20} />
							Get Started
						{/snippet}
					</Button>
					<Button variant="ai-action" size="lg">
						{#snippet children()}
							<Sparkles size={20} />
							Try AI Features
						{/snippet}
					</Button>
				</div>
			</div>
		</div>

		<!-- AI Streaming Text Demo -->
		<section>
			<h3 class="text-2xl font-semibold mb-6">AI Streaming Text</h3>
			<div class="max-w-4xl">
				<AIStreamingText
					text={streamingText}
					streaming={isStreaming}
					title="Welcome Message"
					variant="explanation"
					showActions={true}
					copyable={true}
					on:complete={() => console.log('Streaming complete')}
				/>
			</div>
		</section>

		<!-- Button Showcase -->
		<section>
			<h3 class="text-2xl font-semibold mb-6">Button Components</h3>
			<div class="space-y-4">
				<div>
					<h4 class="text-lg font-medium mb-3">Variants</h4>
					<div class="flex flex-wrap gap-3">
						<Button variant="primary">
							{#snippet children()}Primary{/snippet}
						</Button>
						<Button variant="secondary">
							{#snippet children()}Secondary{/snippet}
						</Button>
						<Button variant="ghost">
							{#snippet children()}Ghost{/snippet}
						</Button>
						<Button variant="outline">
							{#snippet children()}Outline{/snippet}
						</Button>
						<Button variant="destructive">
							{#snippet children()}Destructive{/snippet}
						</Button>
						<Button variant="ai-action">
							{#snippet children()}
								<Sparkles size={16} />
								AI Action
							{/snippet}
						</Button>
					</div>
				</div>

				<div>
					<h4 class="text-lg font-medium mb-3">Sizes</h4>
					<div class="flex flex-wrap items-center gap-3">
						<Button size="sm">
							{#snippet children()}Small{/snippet}
						</Button>
						<Button size="md">
							{#snippet children()}Medium{/snippet}
						</Button>
						<Button size="lg">
							{#snippet children()}Large{/snippet}
						</Button>
						<Button size="xl">
							{#snippet children()}Extra Large{/snippet}
						</Button>
						<Button size="icon">
							{#snippet children()}
								<Search size={16} />
							{/snippet}
						</Button>
					</div>
				</div>

				<div>
					<h4 class="text-lg font-medium mb-3">States</h4>
					<div class="flex flex-wrap gap-3">
						<Button variant="primary">
							{#snippet children()}Normal{/snippet}
						</Button>
						<Button variant="primary" loading>
							{#snippet children()}Loading{/snippet}
						</Button>
						<Button variant="primary" disabled>
							{#snippet children()}Disabled{/snippet}
						</Button>
					</div>
				</div>
			</div>
		</section>

		<!-- Form Components -->
		<section>
			<h3 class="text-2xl font-semibold mb-6">Form Components</h3>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<div class="space-y-6">
					<Input
						bind:value={searchValue}
						label="Search Query"
						placeholder="Enter search terms..."
						description="Search through assignments and student work"
					>
						{#snippet leftIcon()}
							<Search size={16} />
						{/snippet}
					</Input>

					<Textarea
						bind:value={textareaValue}
						label="Assignment Description"
						placeholder="Describe the assignment requirements..."
						rows={4}
						aiWritingMode={true}
						description="Use AI assistance to improve your description"
					/>

					<Checkbox
						bind:checked={checkboxValue}
						label="Enable AI Grading"
						description="Allow AI to automatically grade submissions"
						variant="ai-enhanced"
					/>
				</div>

				<div class="space-y-4">
					<h4 class="text-lg font-medium">AI-Enhanced Input</h4>
					<Input
						variant="ai-enhanced"
						label="Smart Code Analysis"
						placeholder="Paste your code here..."
						aiSuggestion="Consider using more descriptive variable names for better code readability"
					/>

					<div class="relative">
						<AIInlineHint
							content="This assignment would benefit from more specific requirements and clearer grading criteria."
							hint="AI suggestion available"
							type="improvement"
							confidence={0.87}
							copyable={true}
							expanded={false}
						/>
					</div>
				</div>
			</div>
		</section>

		<!-- AI Suggestion Panel -->
		<section>
			<h3 class="text-2xl font-semibold mb-6">AI Suggestion Panel</h3>
			<div class="max-w-4xl">
				<AISuggestionPanel
					suggestions={aiSuggestions}
					bind:open={aiPanelOpen}
					title="Code Review Results"
					subtitle="AI analysis of student submission"
					showConfidence={true}
					showReasoning={true}
					allowRegenerate={true}
					on:applySuggestion={(e) => console.log('Apply:', e.detail)}
					on:copySuggestion={(e) => console.log('Copy:', e.detail)}
					on:regenerate={() => console.log('Regenerate suggestions')}
				/>
			</div>
		</section>

		<!-- Component Features -->
		<section>
			<h3 class="text-2xl font-semibold mb-6">Key Features</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div class="bg-card border border-border rounded-lg p-6">
					<div class="w-12 h-12 bg-ai-highlight/10 rounded-lg flex items-center justify-center mb-4">
						<Sparkles size={24} class="text-ai-highlight" />
					</div>
					<h4 class="font-semibold mb-2">AI Integration</h4>
					<p class="text-sm text-muted-foreground">
						Built-in AI components with confidence scoring, reasoning, and interactive suggestions.
					</p>
				</div>

				<div class="bg-card border border-border rounded-lg p-6">
					<div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
						<Settings size={24} class="text-primary" />
					</div>
					<h4 class="font-semibold mb-2">Accessibility First</h4>
					<p class="text-sm text-muted-foreground">
						Full keyboard navigation, screen reader support, and high contrast mode compatibility.
					</p>
				</div>

				<div class="bg-card border border-border rounded-lg p-6">
					<div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
						<Menu size={24} class="text-accent" />
					</div>
					<h4 class="font-semibold mb-2">Theme System</h4>
					<p class="text-sm text-muted-foreground">
						Comprehensive light/dark mode with semantic design tokens and smooth transitions.
					</p>
				</div>
			</div>
		</section>

		<!-- Footer -->
		<footer class="border-t border-border pt-8">
			<div class="text-center text-muted-foreground">
				<p>Built with SvelteKit, TailwindCSS, and Storybook</p>
				<p class="mt-2">Designed for modern educational technology</p>
			</div>
		</footer>
	</div>
</AppShell>
