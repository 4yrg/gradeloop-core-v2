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
	import {
		Sparkles,
		Search,
		Plus,
		Settings,
		User,
		Book,
		GraduationCap,
		BarChart3,
		Bell,
		Menu,
		Code,
		FileText,
		CheckCircle,
		AlertCircle,
		XCircle,
		Info,
		Download,
		Upload,
		Edit,
		Trash2,
		Copy,
		Eye,
		EyeOff,
		RefreshCw,
		Play,
		Pause,
		Square,
		Heart,
		Star,
		MessageSquare,
		Send
	} from 'lucide-svelte';

	// Test state variables
	let inputValue = 'Test input value';
	let textareaValue = 'This is a sample textarea with AI writing assistance enabled. Try pressing Ctrl+I for AI suggestions or Ctrl+Enter to continue writing with AI help.';
	let passwordValue = '';
	let emailValue = 'test@gradeloop.com';
	let searchValue = '';
	let checkboxValue = false;
	let checkboxAI = true;
	let checkboxError = false;
	let radioValue = 'option1';

	// AI components state
	let aiPanelOpen = true;
	let aiHintExpanded = false;
	let streamingText = "Welcome to the comprehensive GradeLoop component test suite! This page demonstrates every component in our AI-focused LMS library. You'll see buttons, forms, layouts, AI suggestions, streaming text, and much more. Each component is built with accessibility, performance, and user experience in mind. The design system uses semantic tokens that work beautifully in both light and dark modes, optimized for long coding sessions and educational workflows.";
	let isStreaming = false;
	let streamingComplete = false;

	// Layout state
	let sidebarCollapsed = false;
	let mobileSidebarOpen = false;

	// Sample data for components
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
			badge: '5',
			roles: ['student', 'instructor'],
			children: [
				{ id: 'active', label: 'Active Assignments', roles: ['student', 'instructor'] },
				{ id: 'completed', label: 'Completed', roles: ['student', 'instructor'] },
				{ id: 'grading', label: 'Needs Grading', badge: '3', roles: ['instructor'] }
			]
		},
		{
			id: 'students',
			label: 'Students',
			icon: GraduationCap,
			roles: ['instructor', 'admin']
		},
		{
			id: 'analytics',
			label: 'Analytics',
			icon: BarChart3,
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
			title: 'AI Grading Complete',
			message: 'JavaScript fundamentals assignment has been graded',
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
		},
		{
			id: '3',
			title: 'Grade Updated',
			message: 'Your CSS assignment grade has been updated to A-',
			type: 'success' as const,
			timestamp: new Date(Date.now() - 1000 * 60 * 30),
			read: true
		},
		{
			id: '4',
			title: 'Assignment Due Soon',
			message: 'Python algorithms assignment due in 2 hours',
			type: 'warning' as const,
			timestamp: new Date(Date.now() - 1000 * 60 * 60),
			read: false
		}
	];

	const userMenuItems = [
		{ id: 'profile', label: 'My Profile', icon: User },
		{ id: 'preferences', label: 'Preferences', icon: Settings },
		{ id: 'help', label: 'Help & Support', icon: MessageSquare },
		{ id: 'divider', divider: true },
		{ id: 'logout', label: 'Sign Out', onclick: () => console.log('Logout clicked') }
	];

	const user = {
		name: 'Dr. Jane Smith',
		email: 'jane.smith@university.edu',
		role: 'instructor',
		avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b547?w=100&h=100&fit=crop&crop=face'
	};

	const aiSuggestions = [
		{
			id: '1',
			type: 'code' as const,
			title: 'Algorithm Optimization',
			content: `// Optimized bubble sort with early termination
function bubbleSort(arr) {
    let n = arr.length;
    let swapped;

    for (let i = 0; i < n - 1; i++) {
        swapped = false;
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swapped = true;
            }
        }
        if (!swapped) break; // Early termination
    }
    return arr;
}`,
			confidence: 0.94,
			reasoning: 'This optimized version includes early termination when no swaps occur, reducing average-case time complexity. The algorithm maintains O(n²) worst-case but performs better on partially sorted data.'
		},
		{
			id: '2',
			type: 'improvement' as const,
			title: 'Code Structure Enhancement',
			content: 'Consider extracting the validation logic into a separate utility function to improve code reusability and follow the Single Responsibility Principle.',
			confidence: 0.87,
			reasoning: 'The current validation code appears in multiple locations. Creating a dedicated validation utility would reduce code duplication and make testing easier.'
		},
		{
			id: '3',
			type: 'explanation' as const,
			title: 'Design Pattern Explanation',
			content: 'The Observer pattern allows objects to notify multiple subscribers about state changes without creating tight coupling between components.',
			confidence: 0.91,
			reasoning: 'This explanation covers the core concept and benefits of the Observer pattern, which is relevant to the event-driven architecture in your code.'
		},
		{
			id: '4',
			type: 'hint' as const,
			title: 'Performance Tip',
			content: 'Use memoization to cache expensive function calls and avoid recalculating the same results multiple times.',
			confidence: 0.82,
			reasoning: 'Your recursive functions could benefit from memoization, especially the fibonacci and factorial implementations shown in the code.'
		}
	];

	// Event handlers
	function handleButtonClick(label: string) {
		console.log(`${label} button clicked`);
		// You could add toast notifications here
	}

	function handleFormSubmit(event: Event) {
		event.preventDefault();
		console.log('Form submitted with values:', {
			inputValue,
			textareaValue,
			checkboxValue,
			radioValue
		});
	}

	function handleSearch(query: string) {
		console.log('Search query:', query);
	}

	function handleNotificationClick(notification: any) {
		console.log('Notification clicked:', notification);
	}

	function handleUserMenuClick(item: any) {
		console.log('User menu item clicked:', item);
	}

	function handleNavigation(event: any) {
		console.log('Navigate to:', event.detail);
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleMobileSidebar() {
		mobileSidebarOpen = !mobileSidebarOpen;
	}

	function startStreaming() {
		isStreaming = true;
		streamingComplete = false;
	}

	function handleStreamingComplete() {
		isStreaming = false;
		streamingComplete = true;
		console.log('Streaming completed');
	}

	function resetStreaming() {
		streamingComplete = false;
		isStreaming = false;
	}

	// Test data for different states
	let loadingStates = {
		button1: false,
		button2: false,
		button3: false
	};

	function toggleLoading(button: keyof typeof loadingStates) {
		loadingStates[button] = true;
		setTimeout(() => {
			loadingStates[button] = false;
		}, 2000);
	}

	// Form validation example
	let formErrors = {
		email: '',
		password: '',
		textarea: ''
	};

	function validateEmail() {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailValue) {
			formErrors.email = 'Email is required';
		} else if (!emailRegex.test(emailValue)) {
			formErrors.email = 'Please enter a valid email address';
		} else {
			formErrors.email = '';
		}
	}

	function validatePassword() {
		if (!passwordValue) {
			formErrors.password = 'Password is required';
		} else if (passwordValue.length < 8) {
			formErrors.password = 'Password must be at least 8 characters';
		} else {
			formErrors.password = '';
		}
	}

	$: if (emailValue) validateEmail();
	$: if (passwordValue) validatePassword();
</script>

<svelte:head>
	<title>Component Test Suite - GradeLoop</title>
	<meta name="description" content="Comprehensive test page for GradeLoop's AI-focused component library" />
</svelte:head>

<AppShell
	bind:mobileSidebarOpen
	{sidebarCollapsed}
	class="min-h-screen bg-background"
>
	{#snippet sidebar()}
		<Sidebar
			items={navItems}
			collapsed={sidebarCollapsed}
			userRole="instructor"
			currentPath="/test"
			on:navigate={handleNavigation}
			on:toggleCollapse={toggleSidebar}
		>
			{#snippet logo()}
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 bg-gradient-to-br from-primary to-ai-highlight rounded-lg flex items-center justify-center">
						<Sparkles size={18} class="text-white" />
					</div>
					{#if !sidebarCollapsed}
						<div>
							<div class="font-bold text-sm">GradeLoop</div>
							<div class="text-xs text-sidebar-foreground/70">Test Suite</div>
						</div>
					{/if}
				</div>
			{/snippet}

			{#snippet footer()}
				<div class="space-y-3">
					<div class="flex items-center gap-3 p-3 bg-sidebar-accent/10 rounded-lg">
						{#if user.avatar}
							<img src={user.avatar} alt={user.name} class="w-8 h-8 rounded-full object-cover" />
						{:else}
							<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
								<User size={16} class="text-primary-foreground" />
							</div>
						{/if}
						{#if !sidebarCollapsed}
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm truncate">{user.name}</div>
								<div class="text-xs text-sidebar-foreground/70 capitalize">{user.role}</div>
							</div>
						{/if}
					</div>
					{#if !sidebarCollapsed}
						<div class="px-2">
							<ThemeToggle size="sm" variant="dropdown" showLabel={true} />
						</div>
					{/if}
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
			searchPlaceholder="Search components, examples..."
			onSearch={handleSearch}
			onNotificationClick={handleNotificationClick}
			onUserMenuClick={handleUserMenuClick}
			onMobileMenuToggle={toggleMobileSidebar}
		>
			{#snippet leftContent()}
				{#if !mobileSidebarOpen}
					<div class="flex items-center gap-3">
						<h1 class="text-xl font-bold bg-gradient-to-r from-primary to-ai-highlight bg-clip-text text-transparent">
							Component Test Suite
						</h1>
						<span class="px-2 py-1 bg-ai-bg text-ai-text text-xs rounded-full border border-ai-border">
							Interactive Demo
						</span>
					</div>
				{/if}
			{/snippet}

			{#snippet rightContent()}
				<div class="flex items-center gap-2">
					<Button size="sm" variant="ghost" onclick={() => window.open('/demo', '_blank')}>
						{#snippet children()}
							<Eye size={16} />
							Demo
						{/snippet}
					</Button>
					<ThemeToggle size="md" variant="dropdown" />
				</div>
			{/snippet}
		</TopBar>
	{/snippet}

	<!-- Main Content -->
	<div class="space-y-12 pb-12">
		<!-- Welcome Section -->
		<section class="bg-gradient-to-br from-primary/5 via-ai-highlight/5 to-accent/5 rounded-2xl p-8 border border-border/50">
			<div class="text-center max-w-4xl mx-auto">
				<div class="inline-flex items-center gap-2 px-4 py-2 bg-ai-bg rounded-full border border-ai-border mb-6">
					<Sparkles size={16} class="text-ai-highlight" />
					<span class="text-sm font-medium text-ai-text">AI-Powered Component Library</span>
				</div>
				<h2 class="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-ai-highlight to-accent bg-clip-text text-transparent">
					Interactive Test Suite
				</h2>
				<p class="text-xl text-muted-foreground mb-8 leading-relaxed">
					Comprehensive testing environment for all GradeLoop components. Interact with buttons, forms, AI suggestions,
					and layout elements to see our design system in action.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<Button variant="primary" size="lg" onclick={() => document.getElementById('buttons')?.scrollIntoView({ behavior: 'smooth' })}>
						{#snippet children()}
							<Play size={20} />
							Start Testing
						{/snippet}
					</Button>
					<Button variant="ai-action" size="lg" onclick={() => document.getElementById('ai-components')?.scrollIntoView({ behavior: 'smooth' })}>
						{#snippet children()}
							<Sparkles size={20} />
							Try AI Features
						{/snippet}
					</Button>
					<Button variant="outline" size="lg" onclick={() => window.open('/__storybook__', '_blank')}>
						{#snippet children()}
							<Book size={20} />
							View Storybook
						{/snippet}
					</Button>
				</div>
			</div>
		</section>

		<!-- AI Streaming Text Demo -->
		<section id="ai-streaming" class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-2xl font-bold mb-2">AI Streaming Text</h3>
					<p class="text-muted-foreground">Real-time typewriter effect with AI-powered content delivery</p>
				</div>
				<div class="flex gap-2">
					<Button size="sm" variant="ai-action" onclick={startStreaming} disabled={isStreaming}>
						{#snippet children()}
							<Play size={16} />
							Start Stream
						{/snippet}
					</Button>
					<Button size="sm" variant="outline" onclick={resetStreaming}>
						{#snippet children()}
							<RefreshCw size={16} />
							Reset
						{/snippet}
					</Button>
				</div>
			</div>
			<AIStreamingText
				text={streamingText}
				streaming={isStreaming}
				title="Component Library Overview"
				variant="explanation"
				showActions={true}
				copyable={true}
				retryable={true}
				on:complete={handleStreamingComplete}
				on:copy={(e) => console.log('Copied:', e.detail)}
				on:retry={() => console.log('Retry requested')}
			/>
			{#if streamingComplete}
				<div class="flex items-center gap-2 text-success text-sm">
					<CheckCircle size={16} />
					<span>Streaming completed successfully!</span>
				</div>
			{/if}
		</section>

		<!-- Button Components -->
		<section id="buttons" class="space-y-8">
			<div>
				<h3 class="text-2xl font-bold mb-2">Button Components</h3>
				<p class="text-muted-foreground">Interactive buttons with various styles, sizes, and states</p>
			</div>

			<!-- Button Variants -->
			<div class="space-y-4">
				<h4 class="text-xl font-semibold">Variants</h4>
				<div class="flex flex-wrap gap-4">
					<Button variant="primary" onclick={() => handleButtonClick('Primary')}>
						{#snippet children()}Primary Button{/snippet}
					</Button>
					<Button variant="secondary" onclick={() => handleButtonClick('Secondary')}>
						{#snippet children()}Secondary Button{/snippet}
					</Button>
					<Button variant="ghost" onclick={() => handleButtonClick('Ghost')}>
						{#snippet children()}Ghost Button{/snippet}
					</Button>
					<Button variant="outline" onclick={() => handleButtonClick('Outline')}>
						{#snippet children()}Outline Button{/snippet}
					</Button>
					<Button variant="destructive" onclick={() => handleButtonClick('Destructive')}>
						{#snippet children()}
							<Trash2 size={16} />
							Destructive
						{/snippet}
					</Button>
					<Button variant="ai-action" onclick={() => handleButtonClick('AI Action')}>
						{#snippet children()}
							<Sparkles size={16} />
							AI Action
						{/snippet}
					</Button>
				</div>
			</div>

			<!-- Button Sizes -->
			<div class="space-y-4">
				<h4 class="text-xl font-semibold">Sizes</h4>
				<div class="flex flex-wrap items-center gap-4">
					<Button size="sm" onclick={() => handleButtonClick('Small')}>
						{#snippet children()}Small{/snippet}
					</Button>
					<Button size="md" onclick={() => handleButtonClick('Medium')}>
						{#snippet children()}Medium{/snippet}
					</Button>
					<Button size="lg" onclick={() => handleButtonClick('Large')}>
						{#snippet children()}Large{/snippet}
					</Button>
					<Button size="xl" onclick={() => handleButtonClick('Extra Large')}>
						{#snippet children()}Extra Large{/snippet}
					</Button>
					<Button size="icon" onclick={() => handleButtonClick('Icon')}>
						{#snippet children()}
							<Heart size={16} />
						{/snippet}
					</Button>
				</div>
			</div>

			<!-- Button States -->
			<div class="space-y-4">
				<h4 class="text-xl font-semibold">Interactive States</h4>
				<div class="flex flex-wrap gap-4">
					<Button variant="primary" onclick={() => handleButtonClick('Normal')}>
						{#snippet children()}Normal State{/snippet}
					</Button>
					<Button variant="primary" loading={loadingStates.button1} onclick={() => toggleLoading('button1')}>
						{#snippet children()}Toggle Loading{/snippet}
					</Button>
					<Button variant="primary" disabled>
						{#snippet children()}Disabled State{/snippet}
					</Button>
					<Button variant="ai-action" loading={loadingStates.button2} onclick={() => toggleLoading('button2')}>
						{#snippet children()}
							<Sparkles size={16} />
							AI Loading
						{/snippet}
					</Button>
				</div>
			</div>

			<!-- Icon Buttons -->
			<div class="space-y-4">
				<h4 class="text-xl font-semibold">Icon Combinations</h4>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Button variant="primary" onclick={() => handleButtonClick('Download')}>
						{#snippet children()}
							<Download size={16} />
							Download
						{/snippet}
					</Button>
					<Button variant="secondary" onclick={() => handleButtonClick('Upload')}>
						{#snippet children()}
							<Upload size={16} />
							Upload
						{/snippet}
					</Button>
					<Button variant="ghost" onclick={() => handleButtonClick('Edit')}>
						{#snippet children()}
							<Edit size={16} />
							Edit
						{/snippet}
					</Button>
					<Button variant="outline" onclick={() => handleButtonClick('Copy')}>
						{#snippet children()}
							<Copy size={16} />
							Copy
						{/snippet}
					</Button>
				</div>
			</div>
		</section>

		<!-- Form Components -->
		<section id="forms" class="space-y-8">
			<div>
				<h3 class="text-2xl font-bold mb-2">Form Components</h3>
				<p class="text-muted-foreground">Input fields, textareas, and form controls with AI enhancements</p>
			</div>

			<form on:submit={handleFormSubmit} class="space-y-8">
				<!-- Basic Inputs -->
				<div class="space-y-6">
					<h4 class="text-xl font-semibold">Input Fields</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Input
							bind:value={inputValue}
							label="Basic Input"
							placeholder="Enter some text..."
							description="This is a basic input field with validation"
						/>

						<Input
							bind:value={emailValue}
							type="email"
							label="Email Address"
							placeholder="your@email.com"
							variant={formErrors.email ? 'error' : 'default'}
							error={formErrors.email}
							success={!formErrors.email && emailValue ? 'Valid email address' : ''}
							required
						>
							{#snippet leftIcon()}
								<User size={16} />
							{/snippet}
						</Input>

						<Input
							bind:value={passwordValue}
							type="password"
							label="Password"
							placeholder="Enter your password"
							variant={formErrors.password ? 'error' : 'default'}
							error={formErrors.password}
							success={!formErrors.password && passwordValue.length >= 8 ? 'Strong password' : ''}
							required
						/>

						<Input
							bind:value={searchValue}
							type="search"
							label="Search Field"
							placeholder="Search anything..."
							variant="ai-enhanced"
							aiSuggestion="Try searching for 'JavaScript' or 'React components'"
						>
							{#snippet leftIcon()}
								<Search size={16} />
							{/snippet}
						</Input>
					</div>
				</div>

				<!-- Textarea -->
				<div class="space-y-6">
					<h4 class="text-xl font-semibold">Textarea</h4>
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Textarea
							bind:value={textareaValue}
							label="Assignment Description"
							placeholder="Describe your assignment..."
							rows={6}
							maxlength={500}
							autoResize={false}
							aiWritingMode={true}
							description="Use Ctrl+I for AI assistance or Ctrl+Enter to continue writing"
							on:aiAssist={(e) => console.log('AI Assist requested:', e.detail)}
						/>

						<div class="space-y-4">
							<Textarea
								label="Code Snippet"
								placeholder="Paste your code here..."
								rows={4}
								variant="ai-enhanced"
								aiSuggestion="This looks like JavaScript code. Consider adding type annotations for better maintainability."
							/>
							<Textarea
								label="Error Example"
								placeholder="This field has an error..."
								rows={3}
								variant="error"
								error="Please provide a valid code snippet with proper syntax"
							/>
						</div>
					</div>
				</div>

				<!-- Checkboxes and Radio -->
				<div class="space-y-6">
					<h4 class="text-xl font-semibold">Selection Controls</h4>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div class="space-y-4">
							<h5 class="font-medium">Checkboxes</h5>
							<Checkbox
								bind:checked={checkboxValue}
								label="Enable notifications"
								description="Receive email notifications about assignment updates"
							/>
							<Checkbox
								bind:checked={checkboxAI}
								label="AI-Enhanced Grading"
								description="Use artificial intelligence to assist with grading"
								variant="ai-enhanced"
								aiValidation="AI grading can improve consistency and provide detailed feedback"
							/>
							<Checkbox
								bind:checked={checkboxError}
								label="Error State Example"
								description="This checkbox demonstrates error validation"
								error="This field is required for the assignment to be processed"
								required
							/>
							<Checkbox
								checked={true}
								disabled
								label="Disabled Checkbox"
								description="This checkbox cannot be changed"
							/>
						</div>

						<div class="space-y-4">
							<h5 class="font-medium">Radio Buttons</h5>
							<div class="space-y-3">
								<label class="flex items-center gap-3 cursor-pointer">
									<input
										type="radio"
										bind:group={radioValue}
										value="option1"
										class="w-4 h-4 text-primary focus:ring-primary focus:ring-2"
									/>
									<div>
										<div class="font-medium text-sm">Automatic Grading</div>
										<div class="text-xs text-muted-foreground">Let AI handle all grading automatically</div>
									</div>
								</label>
								<label class="flex items-center gap-3 cursor-pointer">
									<input
										type="radio"
										bind:group={radioValue}
										value="option2"
										class="w-4 h-4 text-primary focus:ring-primary focus:ring-2"
									/>
									<div>
										<div class="font-medium text-sm">Assisted Grading</div>
										<div class="text-xs text-muted-foreground">AI suggests grades for manual review</div>
									</div>
								</label>
								<label class="flex items-center gap-3 cursor-pointer">
									<input
										type="radio"
										bind:group={radioValue}
										value="option3"
										class="w-4 h-4 text-primary focus:ring-primary focus:ring-2"
									/>
									<div>
										<div class="font-medium text-sm">Manual Grading</div>
										<div class="text-xs text-muted-foreground">Grade everything manually without AI</div>
									</div>
								</label>
							</div>
						</div>
					</div>
				</div>

				<!-- Form Actions -->
				<div class="flex flex-wrap gap-4 pt-6 border-t border-border">
					<Button type="submit" variant="primary" size="lg">
						{#snippet children()}
							<Send size={16} />
							Submit Form
						{/snippet}
					</Button>
					<Button type="reset" variant="secondary">
						{#snippet children()}
							<RefreshCw size={16} />
							Reset
						{/snippet}
					</Button>
					<Button type="button" variant="ghost">
						{#snippet children()}Cancel{/snippet}
					</Button>
				</div>
			</form>
		</section>

		<!-- AI Components -->
		<section id="ai-components" class="space-y-8">
			<div>
				<h3 class="text-2xl font-bold mb-2">AI-Enhanced Components</h3>
				<p class="text-muted-foreground">Intelligent components with AI suggestions, confidence scoring, and reasoning</p>
			</div>

			<!-- AI Suggestion Panel -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<h4 class="text-xl font-semibold">AI Suggestion Panel</h4>
					<div class="flex gap-2">
						<Button size="sm" variant="ai-action" onclick={() => aiPanelOpen = !aiPanelOpen}>
							{#snippet children()}
								{aiPanelOpen ? 'Hide' : 'Show'} Panel
							{/snippet}
						</Button>
					</div>
				</div>

				<AISuggestionPanel
					suggestions={aiSuggestions}
					bind:open={aiPanelOpen}
					title="Code Review Results"
					subtitle="AI analysis of student JavaScript submission"
					showConfidence={true}
					showReasoning={true}
					allowRegenerate={true}
					maxHeight="600px"
					on:applySuggestion={(e) => console.log('Apply suggestion:', e.detail)}
					on:copySuggestion={(e) => console.log('Copy suggestion:', e.detail)}
					on:regenerate={() => {
						console.log('Regenerating suggestions...');
						// Simulate regeneration
						setTimeout(() => {
							console.log('New suggestions generated');
						}, 2000);
					}}
					on:expandReasoning={(e) => console.log('Expand reasoning:', e.detail)}
				>
					{#snippet headerActions()}
						<div class="flex items-center gap-2">
							<span class="px-2 py-1 bg-success/10 text-success rounded text-xs font-medium">
								Score: 87/100
							</span>
							<span class="text-muted-foreground text-xs">•</span>
							<span class="text-xs text-muted-foreground">4 suggestions</span>
						</div>
					{/snippet}
				</AISuggestionPanel>
			</div>

			<!-- AI Inline Hints -->
			<div class="space-y-6">
				<h4 class="text-xl font-semibold">AI Inline Hints</h4>
				<div class="space-y-4">
					<div class="p-4 bg-card border border-border rounded-lg">
						<h5 class="font-medium mb-2">Assignment Creation Form</h5>
						<div class="space-y-3">
							<input
								type="text"
								placeholder="Assignment title..."
								class="w-full px-3 py-2 border border-input rounded-md"
							/>
							<AIInlineHint
								content="Consider adding specific learning objectives and clear grading criteria to improve student understanding and assessment consistency."
								hint="AI suggestion available for this assignment"
								type="improvement"
								confidence={0.89}
								bind:expanded={aiHintExpanded}
								copyable={true}
								dismissible={true}
								on:copy={(e) => console.log('Copied hint:', e.detail)}
								on:dismiss={() => console.log('Hint dismissed')}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="p-4 bg-card border border-border rounded-lg">
							<h6 class="font-medium mb-2">Code Editor</h6>
							<div class="bg-code-bg text-code-text p-3 rounded font-mono text-sm mb-2">
								<div>function calculateGrade(score) {</div>
								<div className="pl-4">return score * 0.8;</div>
								<div>}</div>
							</div>
							<AIInlineHint
								content="This function doesn't handle edge cases like negative scores or scores above 100. Consider adding input validation."
								type="warning"
								confidence={0.76}
								size="sm"
								position="top"
							/>
						</div>

						<div class="p-4 bg-card border border-border rounded-lg">
							<h6 class="font-medium mb-2">Essay Feedback</h6>
							<textarea
								class="w-full px-3 py-2 border border-input rounded-md resize-none"
								rows="3"
								placeholder="Student essay content..."
							></textarea>
							<AIInlineHint
								content="The essay demonstrates good understanding of the topic but could benefit from more specific examples and stronger transitions between paragraphs."
								type="suggestion"
								confidence={0.92}
								size="sm"
								expanded={true}
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- AI Confidence Examples -->
			<div class="space-y-6">
				<h4 class="text-xl font-semibold">Confidence Levels</h4>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<AIInlineHint
						content="High confidence suggestion based on established best practices."
						hint="High confidence (95%)"
						type="improvement"
						confidence={0.95}
						size="sm"
					/>
					<AIInlineHint
						content="Medium confidence suggestion that may need context-specific review."
						hint="Medium confidence (68%)"
						type="suggestion"
						confidence={0.68}
						size="sm"
					/>
					<AIInlineHint
						content="Low confidence suggestion that requires manual verification."
						hint="Low confidence (42%)"
						type="info"
						confidence={0.42}
						size="sm"
					/>
				</div>
			</div>
		</section>

		<!-- Status and Feedback Components -->
		<section id="status" class="space-y-8">
			<div>
				<h3 class="text-2xl font-bold mb-2">Status & Feedback</h3>
				<p class="text-muted-foreground">Alert messages, status indicators, and feedback components</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<!-- Alert Examples -->
				<div class="space-y-4">
					<h4 class="text-lg font-semibold">Alert Messages</h4>
					<div class="space-y-3">
						<div class="semantic-success border-l-4 p-4 rounded-md">
							<div class="flex items-center gap-2">
								<CheckCircle size={16} />
								<span class="font-medium">Success</span>
							</div>
							<p class="text-sm mt-1">Assignment submitted successfully and sent for AI grading.</p>
						</div>

						<div class="semantic-warning border-l-4 p-4 rounded-md">
							<div class="flex items-center gap-2">
								<AlertCircle size={16} />
								<span class="font-medium">Warning</span>
							</div>
							<p class="text-sm mt-1">Assignment is due in 30 minutes. Please submit soon to avoid late penalties.</p>
						</div>

						<div class="semantic-error border-l-4 p-4 rounded-md">
							<div class="flex items-center gap-2">
								<XCircle size={16} />
								<span class="font-medium">Error</span>
							</div>
							<p class="text-sm mt-1">Failed to submit assignment. Please check your internet connection and try again.</p>
						</div>

						<div class="semantic-info border-l-4 p-4 rounded-md">
							<div class="flex items-center gap-2">
								<Info size={16} />
								<span class="font-medium">Information</span>
							</div>
							<p class="text-sm mt-1">New course materials are available in the resources section.</p>
						</div>

						<div class="ai-panel border-l-4 p-4 rounded-md">
							<div class="flex items-center gap-2">
								<Sparkles size={16} class="text-ai-highlight" />
								<span class="font-medium text-ai-text">AI Insight</span>
							</div>
							<p class="text-sm mt-1 text-ai-text/80">AI has detected potential improvements in your code structure and performance.</p>
						</div>
					</div>
				</div>

				<!-- Status Cards -->
				<div class="space-y-4">
					<h4 class="text-lg font-semibold">Status Cards</h4>
					<div class="space-y-4">
						<div class="bg-card border border-border rounded-lg p-4">
							<div class="flex items-center justify-between mb-3">
								<h5 class="font-medium">Assignment Progress</h5>
								<span class="text-sm text-muted-foreground">75%</span>
							</div>
							<div class="w-full bg-muted rounded-full h-2">
								<div class="bg-primary h-2 rounded-full transition-all duration-300" style="width: 75%"></div>
							</div>
							<div class="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
								<Clock size={12} />
								<span>3 of 4 sections completed</span>
							</div>
						</div>

						<div class="bg-card border border-border rounded-lg p-4">
							<div class="flex items-center justify-between mb-3">
								<h5 class="font-medium">AI Grading Status</h5>
								<div class="flex items-center gap-1 text-ai-highlight">
									<Sparkles size={14} />
									<span class="text-sm">Processing</span>
								</div>
							</div>
							<div class="w-full bg-muted rounded-full h-2">
								<div class="bg-ai-highlight h-2 rounded-full transition-all duration-300 animate-pulse" style="width: 60%"></div>
							</div>
							<p class="text-xs text-muted-foreground mt-2">AI is analyzing your submission...</p>
						</div>

						<div class="bg-card border border-success-border rounded-lg p-4">
							<div class="flex items-center justify-between mb-2">
								<h5 class="font-medium text-success">Grade: A-</h5>
								<CheckCircle size={16} class="text-success" />
							</div>
							<div class="flex items-center gap-4 text-sm">
								<div class="text-muted-foreground">Score: 87/100</div>
								<div class="text-muted-foreground">•</div>
								<div class="text-success">Above Average</div>
							</div>
							<p class="text-xs text-muted-foreground mt-2">Graded by AI with instructor review</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Component Performance & Accessibility -->
		<section id="accessibility" class="space-y-8">
			<div>
				<h3 class="text-2xl font-bold mb-2">Accessibility & Performance</h3>
				<p class="text-muted-foreground">Testing accessibility features, keyboard navigation, and performance</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<div class="space-y-6">
					<div class="bg-card border border-border rounded-lg p-6">
						<h4 class="font-semibold mb-4">Keyboard Navigation Test</h4>
						<p class="text-sm text-muted-foreground mb-4">Use Tab to navigate, Enter/Space to activate, Escape to close dropdowns.</p>
						<div class="space-y-3">
							<Button variant="primary" onclick={() => console.log('Keyboard accessible button 1')}>
								{#snippet children()}First Button{/snippet}
							</Button>
							<Input label="Keyboard Input" placeholder="Tab to focus this input..." />
							<Checkbox label="Keyboard accessible checkbox" />
							<Button variant="ai-action" onclick={() => console.log('AI button activated')}>
								{#snippet children()}
									<Sparkles size={16} />
									AI Button
								{/snippet}
							</Button>
						</div>
					</div>

					<div class="bg-card border border-border rounded-lg p-6">
						<h4 class="font-semibold mb-4">Focus Management</h4>
						<p class="text-sm text-muted-foreground mb-4">All interactive elements have visible focus indicators.</p>
						<div class="grid grid-cols-2 gap-3">
							<Button size="sm" variant="outline">
								{#snippet children()}Focus Test 1{/snippet}
							</Button>
							<Button size="sm" variant="ghost">
								{#snippet children()}Focus Test 2{/snippet}
							</Button>
							<Button size="sm" variant="secondary">
								{#snippet children()}Focus Test 3{/snippet}
							</Button>
							<Button size="sm" variant="ai-action">
								{#snippet children()}AI Focus{/snippet}
							</Button>
						</div>
					</div>
				</div>

				<div class="space-y-6">
					<div class="bg-card border border-border rounded-lg p-6">
						<h4 class="font-semibold mb-4">Screen Reader Support</h4>
						<div class="space-y-4 text-sm">
							<div class="flex items-center gap-2">
								<CheckCircle size={16} class="text-success" />
								<span>Semantic HTML structure</span>
							</div>
							<div class="flex items-center gap-2">
								<CheckCircle size={16} class="text-success" />
								<span>ARIA labels and descriptions</span>
							</div>
							<div class="flex items-center gap-2">
								<CheckCircle size={16} class="text-success" />
								<span>Live regions for dynamic content</span>
							</div>
							<div class="flex items-center gap-2">
								<CheckCircle size={16} class="text-success" />
								<span>Proper heading hierarchy</span>
							</div>
							<div class="flex items-center gap-2">
								<CheckCircle size={16} class="text-success" />
								<span>Form labels and validation</span>
							</div>
						</div>
					</div>

					<div class="bg-card border border-border rounded-lg p-6">
						<h4 class="font-semibold mb-4">Performance Features</h4>
						<div class="space-y-4 text-sm">
							<div class="flex items-center gap-2">
								<Star size={16} class="text-primary" />
								<span>Tree-shakeable imports</span>
							</div>
							<div class="flex items-center gap-2">
								<Star size={16} class="text-primary" />
								<span>Svelte compile-time optimizations</span>
							</div>
							<div class="flex items-center gap-2">
								<Star size={16} class="text-primary" />
								<span>Minimal JavaScript overhead</span>
							</div>
							<div class="flex items-center gap-2">
								<Star size={16} class="text-primary" />
								<span>Efficient reactivity system</span>
							</div>
							<div class="flex items-center gap-2">
								<Star size={16} class="text-primary" />
								<span>Reduced motion support</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Test Summary -->
		<section class="bg-gradient-to-r from-primary/5 to-ai-highlight/5 rounded-xl p-8 border border-border/50">
			<div class="text-center">
				<h3 class="text-2xl font-bold mb-4">Test Complete! 🎉</h3>
				<p class="text-lg text-muted-foreground mb-6">
					You've explored all the components in our AI-focused LMS library.
					Check the browser console to see interaction logs.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<Button variant="primary" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
						{#snippet children()}
							<RefreshCw size={16} />
							Start Over
						{/snippet}
					</Button>
					<Button variant="ai-action" onclick={() => window.open('/__storybook__', '_blank')}>
						{#snippet children()}
							<Book size={16} />
							Explore Storybook
						{/snippet}
					</Button>
					<Button variant="outline" onclick={() => window.open('/demo', '_blank')}>
						{#snippet children()}
							<Eye size={16} />
							View Demo Page
						{/snippet}
					</Button>
				</div>
			</div>
		</section>
	</div>
</AppShell>

<style>
	/* Custom animations for demo */
	@keyframes gradient-shift {
		0%, 100% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
	}

	.bg-gradient-to-r {
		background-size: 200% 200%;
		animation: gradient-shift 8s ease infinite;
	}

	/* Smooth scrolling for anchor links */
	html {
		scroll-behavior: smooth;
	}

	/* Enhanced focus states for demo */
	button:focus-visible,
	input:focus-visible,
	textarea:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.35);
	}

	/* Demo-specific styling */
	.demo-section {
		scroll-margin-top: 100px;
	}
</style>
