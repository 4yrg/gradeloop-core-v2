<script lang="ts" context="module">
	import type { Meta, StoryObj } from '@storybook/svelte';
	import AISuggestionPanel from '$lib/components/ai/AISuggestionPanel.svelte';
	import { Sparkles, RefreshCw, Settings } from 'lucide-svelte';

	const meta: Meta<AISuggestionPanel> = {
		title: 'Components/AI/AISuggestionPanel',
		component: AISuggestionPanel,
		parameters: {
			layout: 'padded',
			docs: {
				description: {
					component: 'An AI-powered suggestion panel component that displays intelligent recommendations with confidence levels, reasoning, and interactive features.'
				}
			}
		},
		argTypes: {
			mode: {
				control: 'select',
				options: ['inline', 'drawer', 'panel'],
				description: 'Display mode of the suggestion panel'
			},
			position: {
				control: 'select',
				options: ['top', 'bottom', 'left', 'right'],
				description: 'Position of the panel (relevant for drawer and panel modes)'
			},
			open: {
				control: 'boolean',
				description: 'Whether the panel is open/visible'
			},
			loading: {
				control: 'boolean',
				description: 'Whether the panel is in loading state'
			},
			collapsible: {
				control: 'boolean',
				description: 'Whether the panel can be collapsed'
			},
			showConfidence: {
				control: 'boolean',
				description: 'Whether to show confidence indicators'
			},
			showReasoning: {
				control: 'boolean',
				description: 'Whether to show reasoning sections'
			},
			allowRegenerate: {
				control: 'boolean',
				description: 'Whether to show regenerate button'
			}
		},
		tags: ['autodocs']
	};

	export default meta;
	type Story = StoryObj<typeof meta>;

	// Sample suggestions data
	const sampleSuggestions = [
		{
			id: '1',
			type: 'code' as const,
			title: 'Optimize Database Query',
			content: `SELECT u.name, COUNT(a.id) as assignment_count
FROM users u
LEFT JOIN assignments a ON u.id = a.user_id
WHERE u.role = 'student'
GROUP BY u.id
ORDER BY assignment_count DESC;`,
			confidence: 0.92,
			reasoning: 'This optimized query uses LEFT JOIN instead of subqueries, which should improve performance by reducing the number of database operations. The query also includes proper indexing hints.'
		},
		{
			id: '2',
			type: 'explanation' as const,
			title: 'Algorithm Complexity Analysis',
			content: 'The current sorting algorithm has O(n²) time complexity. Consider using merge sort or quicksort for better performance with larger datasets.',
			confidence: 0.88,
			reasoning: 'Based on the nested loop structure in your code, the time complexity analysis indicates potential performance issues with large inputs. Modern sorting algorithms would provide O(n log n) performance.'
		},
		{
			id: '3',
			type: 'improvement' as const,
			title: 'Code Structure Enhancement',
			content: 'Extract the validation logic into a separate utility function to improve code reusability and maintainability.',
			confidence: 0.76,
			reasoning: 'The validation code appears in multiple places throughout the codebase. Following DRY principles would reduce maintenance overhead and potential bugs.'
		},
		{
			id: '4',
			type: 'hint' as const,
			title: 'Security Best Practice',
			content: 'Always validate and sanitize user input before processing to prevent SQL injection and XSS attacks.',
			confidence: 0.95,
			reasoning: 'Security analysis detected potential vulnerabilities where user input is used without proper sanitization. This is a critical security concern that should be addressed immediately.'
		}
	];

	const emptySuggestions = [];
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';

	let panelOpen = true;
	let isLoading = false;
	let suggestions = sampleSuggestions;

	function handleApplySuggestion(event) {
		console.log('Applied suggestion:', event.detail);
	}

	function handleCopySuggestion(event) {
		console.log('Copied suggestion:', event.detail);
	}

	function handleRegenerate() {
		console.log('Regenerating suggestions...');
		isLoading = true;
		setTimeout(() => {
			isLoading = false;
		}, 2000);
	}

	function handleToggle(event) {
		panelOpen = event.detail;
		console.log('Panel toggled:', panelOpen);
	}
</script>

<!-- Default Panel -->
<Story name="Default" args={{
	suggestions: sampleSuggestions,
	open: true,
	mode: 'inline',
	showConfidence: true,
	showReasoning: true
}}>
</Story>

<!-- All Modes -->
<Story name="Display Modes" parameters={{ layout: 'fullscreen' }}>
	<div class="space-y-8 p-6">
		<div>
			<h3 class="text-lg font-semibold mb-4">Inline Mode</h3>
			<div class="max-w-2xl">
				<AISuggestionPanel
					{suggestions}
					mode="inline"
					title="Code Suggestions"
					subtitle="AI-powered recommendations for your code"
					showConfidence={true}
					showReasoning={true}
					on:applySuggestion={handleApplySuggestion}
					on:copySuggestion={handleCopySuggestion}
					on:regenerate={handleRegenerate}
				/>
			</div>
		</div>

		<div>
			<h3 class="text-lg font-semibold mb-4">Panel Mode</h3>
			<div class="h-96 border border-border rounded-lg">
				<AISuggestionPanel
					{suggestions}
					mode="panel"
					title="Assignment Analysis"
					subtitle="Detailed feedback and suggestions"
					showConfidence={true}
					showReasoning={false}
					on:applySuggestion={handleApplySuggestion}
					on:copySuggestion={handleCopySuggestion}
					on:regenerate={handleRegenerate}
				/>
			</div>
		</div>
	</div>
</Story>

<!-- Loading States -->
<Story name="Loading States" parameters={{ layout: 'padded' }}>
	<div class="space-y-6 max-w-2xl">
		<div>
			<h3 class="text-lg font-semibold mb-4">Loading State</h3>
			<AISuggestionPanel
				suggestions={[]}
				loading={true}
				title="Analyzing Code..."
				subtitle="AI is processing your submission"
				showConfidence={true}
			/>
		</div>

		<div>
			<h3 class="text-lg font-semibold mb-4">Empty State</h3>
			<AISuggestionPanel
				suggestions={[]}
				loading={false}
				title="No Suggestions Available"
				subtitle="Submit your code to get AI feedback"
				showConfidence={true}
			/>
		</div>

		<div>
			<h3 class="text-lg font-semibold mb-4">Error State</h3>
			<AISuggestionPanel
				suggestions={[]}
				loading={false}
				error="Failed to generate suggestions. Please try again."
				title="AI Analysis Failed"
				subtitle="There was an error processing your request"
				showConfidence={true}
			/>
		</div>
	</div>
</Story>

<!-- Interactive Features -->
<Story name="Interactive Features" parameters={{ layout: 'padded' }}>
	<div class="space-y-6 max-w-2xl">
		<div>
			<h3 class="text-lg font-semibold mb-4">With All Features Enabled</h3>
			<AISuggestionPanel
				{suggestions}
				title="Smart Code Review"
				subtitle="AI-powered analysis with confidence scoring"
				showConfidence={true}
				showReasoning={true}
				allowRegenerate={true}
				collapsible={true}
				on:applySuggestion={handleApplySuggestion}
				on:copySuggestion={handleCopySuggestion}
				on:regenerate={handleRegenerate}
				on:toggle={handleToggle}
			>
				{#snippet headerActions()}
					<button
						type="button"
						class="p-1.5 rounded-md hover:bg-ai-bg/50 text-ai-text hover:text-ai-highlight transition-colors"
						title="Settings"
					>
						<Settings size={16} />
					</button>
				{/snippet}
			</AISuggestionPanel>
		</div>

		<div>
			<h3 class="text-lg font-semibold mb-4">Minimal Configuration</h3>
			<AISuggestionPanel
				{suggestions}
				title="Quick Suggestions"
				showConfidence={false}
				showReasoning={false}
				allowRegenerate={false}
				collapsible={false}
				on:applySuggestion={handleApplySuggestion}
			/>
		</div>
	</div>
</Story>

<!-- Confidence Levels -->
<Story name="Confidence Levels" parameters={{ layout: 'padded' }}>
	<div class="space-y-4 max-w-2xl">
		<h3 class="text-lg font-semibold mb-4">Different Confidence Levels</h3>
		<AISuggestionPanel
			suggestions={[
				{
					id: 'high-confidence',
					type: 'improvement',
					title: 'High Confidence Suggestion (95%)',
					content: 'This suggestion has very high confidence based on established best practices and code analysis.',
					confidence: 0.95,
					reasoning: 'Based on static code analysis and comparison with industry standards.'
				},
				{
					id: 'medium-confidence',
					type: 'code',
					title: 'Medium Confidence Suggestion (68%)',
					content: 'function optimizeQuery() {\n  // This optimization might improve performance\n  return query.cache().limit(100);\n}',
					confidence: 0.68,
					reasoning: 'This suggestion is based on general optimization patterns but may need context-specific adjustments.'
				},
				{
					id: 'low-confidence',
					type: 'hint',
					title: 'Low Confidence Suggestion (42%)',
					content: 'Consider reviewing the error handling in this section, though the current implementation may be sufficient.',
					confidence: 0.42,
					reasoning: 'Limited context available for this analysis. Manual review recommended.'
				}
			]}
			title="Confidence Scoring Demo"
			subtitle="See how different confidence levels are displayed"
			showConfidence={true}
			showReasoning={true}
			on:applySuggestion={handleApplySuggestion}
		/>
	</div>
</Story>

<!-- Suggestion Types -->
<Story name="Suggestion Types" parameters={{ layout: 'padded' }}>
	<div class="space-y-4 max-w-2xl">
		<h3 class="text-lg font-semibold mb-4">Different Suggestion Types</h3>
		<AISuggestionPanel
			suggestions={[
				{
					id: 'code-type',
					type: 'code',
					title: 'Code Suggestion',
					content: `// Improved error handling
try {
  const result = await processData(input);
  return result;
} catch (error) {
  logger.error('Processing failed:', error);
  throw new ProcessingError(error.message);
}`,
					confidence: 0.89
				},
				{
					id: 'explanation-type',
					type: 'explanation',
					title: 'Concept Explanation',
					content: 'The Observer pattern allows objects to notify other objects about changes in their state without coupling them tightly together.',
					confidence: 0.94
				},
				{
					id: 'improvement-type',
					type: 'improvement',
					title: 'Performance Improvement',
					content: 'Use memoization to cache expensive function calls and improve performance for repeated operations.',
					confidence: 0.81
				},
				{
					id: 'hint-type',
					type: 'hint',
					title: 'Learning Hint',
					content: 'Remember to handle edge cases like empty arrays, null values, and boundary conditions in your algorithms.',
					confidence: 0.77
				}
			]}
			title="Suggestion Types Showcase"
			subtitle="Different types of AI-generated suggestions"
			showConfidence={true}
			on:applySuggestion={handleApplySuggestion}
		/>
	</div>
</Story>

<!-- Custom Empty State -->
<Story name="Custom Empty State" parameters={{ layout: 'padded' }}>
	<div class="max-w-2xl">
		<h3 class="text-lg font-semibold mb-4">Custom Empty State</h3>
		<AISuggestionPanel
			suggestions={[]}
			title="Assignment Feedback"
			subtitle="AI analysis will appear here"
			showConfidence={true}
		>
			{#snippet emptyState()}
				<div class="p-8 text-center">
					<div class="w-16 h-16 mx-auto mb-4 bg-ai-bg/30 rounded-full flex items-center justify-center">
						<Sparkles size={32} class="text-ai-highlight" />
					</div>
					<h4 class="text-lg font-semibold mb-2">Ready for AI Analysis</h4>
					<p class="text-muted-foreground mb-4">
						Upload your assignment or paste your code to get intelligent feedback and suggestions.
					</p>
					<div class="flex gap-2 justify-center">
						<button class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors">
							Upload File
						</button>
						<button class="px-4 py-2 bg-ai-highlight text-white rounded-md hover:bg-ai-hover transition-colors">
							<Sparkles size={16} class="inline mr-1" />
							Analyze Code
						</button>
					</div>
				</div>
			{/snippet}
		</AISuggestionPanel>
	</div>
</Story>

<!-- Real-world Example -->
<Story name="Assignment Grading" parameters={{ layout: 'padded' }}>
	<div class="max-w-4xl">
		<h3 class="text-lg font-semibold mb-4">Assignment Grading Example</h3>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Student Code -->
			<div>
				<h4 class="font-medium mb-3">Student Submission</h4>
				<div class="bg-code-bg text-code-text p-4 rounded-lg font-mono text-sm">
					<pre>{`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2);
}

// Test cases
console.log(fibonacci(10));
console.log(fibonacci(20));`}</pre>
				</div>
			</div>

			<!-- AI Feedback -->
			<div>
				<h4 class="font-medium mb-3">AI Feedback</h4>
				<AISuggestionPanel
					suggestions={[
						{
							id: 'fib-performance',
							type: 'improvement',
							title: 'Performance Optimization',
							content: 'The recursive fibonacci implementation has exponential time complexity O(2^n). Consider using dynamic programming or memoization for better performance.',
							confidence: 0.95,
							reasoning: 'Recursive fibonacci without memoization recalculates the same values multiple times, leading to exponential time complexity.'
						},
						{
							id: 'fib-memoization',
							type: 'code',
							title: 'Memoized Solution',
							content: `const fibonacci = (function() {
  const cache = {};
  return function fib(n) {
    if (n in cache) return cache[n];
    if (n <= 1) return n;
    cache[n] = fib(n-1) + fib(n-2);
    return cache[n];
  };
})();`,
							confidence: 0.91,
							reasoning: 'This memoized version caches previously calculated values, reducing time complexity to O(n).'
						},
						{
							id: 'fib-testing',
							type: 'hint',
							title: 'Testing Improvement',
							content: 'Consider adding edge case tests for negative numbers and non-integer inputs to make your code more robust.',
							confidence: 0.78,
							reasoning: 'Good testing practices include checking edge cases and invalid inputs.'
						}
					]}
					title="Code Analysis Results"
					subtitle="Grade: B+ (85/100) - Good implementation with room for optimization"
					showConfidence={true}
					showReasoning={true}
					allowRegenerate={true}
					on:applySuggestion={handleApplySuggestion}
					on:copySuggestion={handleCopySuggestion}
					on:regenerate={handleRegenerate}
				>
					{#snippet headerActions()}
						<div class="flex items-center gap-2 text-xs">
							<span class="px-2 py-1 bg-success/10 text-success rounded">85/100</span>
							<span class="text-muted-foreground">|</span>
							<span class="text-muted-foreground">3 suggestions</span>
						</div>
					{/snippet}
				</AISuggestionPanel>
			</div>
		</div>
	</div>
</Story>

<!-- Accessibility Demo -->
<Story name="Accessibility" parameters={{ layout: 'padded' }}>
	<div class="space-y-6 max-w-2xl">
		<h3 class="text-lg font-semibold mb-4">Accessibility Features</h3>
		<div class="space-y-4">
			<div>
				<h4 class="font-medium mb-2">Keyboard Navigation</h4>
				<p class="text-sm text-muted-foreground mb-3">
					Use Tab to navigate, Enter/Space to activate buttons, Escape to close
				</p>
			</div>

			<AISuggestionPanel
				{suggestions}
				title="Accessible AI Suggestions"
				subtitle="Fully keyboard navigable with screen reader support"
				showConfidence={true}
				showReasoning={true}
				collapsible={true}
				on:applySuggestion={handleApplySuggestion}
				on:copySuggestion={handleCopySuggestion}
				on:regenerate={handleRegenerate}
			/>

			<div class="text-sm text-muted-foreground space-y-1">
				<p>✅ ARIA labels and roles implemented</p>
				<p>✅ Keyboard navigation support</p>
				<p>✅ Focus management</p>
				<p>✅ Screen reader announcements</p>
				<p>✅ High contrast mode support</p>
				<p>✅ Reduced motion respect</p>
			</div>
		</div>
	</div>
</Story>
