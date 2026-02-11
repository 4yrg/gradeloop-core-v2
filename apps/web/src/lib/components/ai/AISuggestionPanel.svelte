<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import { X, ChevronUp, ChevronDown, Sparkles, Copy, Check, RefreshCw } from 'lucide-svelte';

	interface AISuggestion {
		id: string;
		type: 'code' | 'text' | 'explanation' | 'improvement' | 'hint';
		title: string;
		content: string;
		confidence: number; // 0-1
		reasoning?: string;
		metadata?: Record<string, any>;
	}

	interface Props {
		suggestions: AISuggestion[];
		mode?: 'inline' | 'drawer' | 'panel';
		position?: 'top' | 'bottom' | 'left' | 'right';
		open?: boolean;
		title?: string;
		subtitle?: string;
		loading?: boolean;
		error?: string;
		maxHeight?: string;
		collapsible?: boolean;
		showConfidence?: boolean;
		showReasoning?: boolean;
		allowRegenerate?: boolean;
		class?: string;
		headerActions?: Snippet;
		emptyState?: Snippet;
	}

	let {
		suggestions = [],
		mode = 'inline',
		position = 'bottom',
		open = $bindable(true),
		title = 'AI Suggestions',
		subtitle,
		loading = false,
		error,
		maxHeight = '400px',
		collapsible = true,
		showConfidence = true,
		showReasoning = false,
		allowRegenerate = true,
		class: className = '',
		headerActions,
		emptyState
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		toggle: boolean;
		applySuggestion: AISuggestion;
		copySuggestion: AISuggestion;
		regenerate: void;
		expandReasoning: AISuggestion;
	}>();

	let expandedReasoningIds = $state<Set<string>>(new Set());
	let copiedIds = $state<Set<string>>(new Set());

	const modeClasses = {
		inline: 'relative w-full',
		drawer: 'fixed inset-x-0 z-50 bg-background border-t border-border shadow-lg',
		panel: 'w-full h-full flex flex-col bg-background border border-border rounded-lg shadow-lg'
	};

	const positionClasses = {
		top: mode === 'drawer' ? 'top-0' : '',
		bottom: mode === 'drawer' ? 'bottom-0' : '',
		left: mode === 'panel' ? 'border-r' : '',
		right: mode === 'panel' ? 'border-l' : ''
	};

	function handleClose() {
		open = false;
		dispatch('close');
	}

	function handleToggle() {
		open = !open;
		dispatch('toggle', open);
	}

	function handleApplySuggestion(suggestion: AISuggestion) {
		dispatch('applySuggestion', suggestion);
	}

	function handleCopySuggestion(suggestion: AISuggestion) {
		navigator.clipboard.writeText(suggestion.content);
		copiedIds.add(suggestion.id);
		dispatch('copySuggestion', suggestion);

		// Reset copy state after 2 seconds
		setTimeout(() => {
			copiedIds.delete(suggestion.id);
			copiedIds = new Set(copiedIds);
		}, 2000);
	}

	function handleRegenerate() {
		dispatch('regenerate');
	}

	function toggleReasoning(suggestion: AISuggestion) {
		if (expandedReasoningIds.has(suggestion.id)) {
			expandedReasoningIds.delete(suggestion.id);
		} else {
			expandedReasoningIds.add(suggestion.id);
			dispatch('expandReasoning', suggestion);
		}
		expandedReasoningIds = new Set(expandedReasoningIds);
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-success';
		if (confidence >= 0.6) return 'text-warning';
		return 'text-error';
	}

	function getConfidenceText(confidence: number): string {
		if (confidence >= 0.9) return 'Very High';
		if (confidence >= 0.8) return 'High';
		if (confidence >= 0.6) return 'Medium';
		if (confidence >= 0.4) return 'Low';
		return 'Very Low';
	}

	function getSuggestionIcon(type: AISuggestion['type']) {
		switch (type) {
			case 'code':
				return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>';
			case 'explanation':
				return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>';
			case 'improvement':
				return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
			case 'hint':
				return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
			default:
				return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>';
		}
	}

	$: containerClasses = twMerge(
		modeClasses[mode],
		positionClasses[position],
		'ai-panel transition-all duration-300',
		open ? 'opacity-100' : 'opacity-0',
		mode === 'drawer' && !open && 'translate-y-full',
		className
	);
</script>

{#if mode === 'drawer'}
	<!-- Drawer Backdrop -->
	{#if open}
		<div
			class="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
			onclick={handleClose}
			transition:fade={{ duration: 200 }}
		></div>
	{/if}
{/if}

{#if open || mode !== 'drawer'}
	<div
		class={containerClasses}
		transition:slide={{ duration: 300, axis: mode === 'drawer' ? 'y' : 'x' }}
		style={mode === 'inline' ? `max-height: ${maxHeight}` : ''}
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-ai-border bg-ai-bg/30">
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2">
					<Sparkles size={20} class="text-ai-highlight" />
					<div>
						<h3 class="font-semibold text-ai-text">{title}</h3>
						{#if subtitle}
							<p class="text-xs text-ai-text/70 mt-1">{subtitle}</p>
						{/if}
					</div>
				</div>

				{#if loading}
					<div class="flex items-center gap-2 text-ai-highlight">
						<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span class="text-sm">Analyzing...</span>
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if headerActions}
					{@render headerActions()}
				{/if}

				{#if allowRegenerate && !loading}
					<button
						type="button"
						class="p-1.5 rounded-md hover:bg-ai-bg/50 text-ai-text hover:text-ai-highlight transition-colors"
						onclick={handleRegenerate}
						title="Regenerate suggestions"
					>
						<RefreshCw size={16} />
					</button>
				{/if}

				{#if collapsible}
					<button
						type="button"
						class="p-1.5 rounded-md hover:bg-ai-bg/50 text-ai-text hover:text-ai-highlight transition-colors"
						onclick={handleToggle}
						title={open ? 'Collapse' : 'Expand'}
					>
						{#if open}
							<ChevronUp size={16} />
						{:else}
							<ChevronDown size={16} />
						{/if}
					</button>
				{/if}

				{#if mode === 'drawer' || mode === 'panel'}
					<button
						type="button"
						class="p-1.5 rounded-md hover:bg-ai-bg/50 text-ai-text hover:text-ai-highlight transition-colors"
						onclick={handleClose}
						title="Close"
					>
						<X size={16} />
					</button>
				{/if}
			</div>
		</div>

		<!-- Content -->
		{#if open}
			<div class="flex-1 overflow-y-auto" style={mode === 'inline' ? `max-height: calc(${maxHeight} - 4rem)` : ''}>
				{#if error}
					<div class="p-4 text-center">
						<div class="inline-flex items-center gap-2 px-4 py-2 bg-error-bg border border-error-border rounded-lg text-error">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							<span>{error}</span>
						</div>
					</div>
				{:else if loading}
					<div class="p-8 text-center">
						<div class="inline-flex flex-col items-center gap-4">
							<div class="w-8 h-8 border-2 border-ai-highlight border-t-transparent rounded-full animate-spin"></div>
							<p class="text-ai-text">Generating AI suggestions...</p>
						</div>
					</div>
				{:else if suggestions.length === 0}
					{#if emptyState}
						{@render emptyState()}
					{:else}
						<div class="p-8 text-center text-ai-text/70">
							<Sparkles size={48} class="mx-auto mb-4 text-ai-highlight/50" />
							<h4 class="font-medium mb-2">No suggestions available</h4>
							<p class="text-sm">AI suggestions will appear here when available.</p>
						</div>
					{/fi}
				{:else}
					<div class="space-y-3 p-4">
						{#each suggestions as suggestion, index (suggestion.id)}
							<div class="bg-background border border-ai-border/30 rounded-lg p-4 hover:border-ai-border transition-colors">
								<!-- Suggestion Header -->
								<div class="flex items-start justify-between mb-3">
									<div class="flex items-center gap-2">
										<div class="text-ai-highlight">
											{@html getSuggestionIcon(suggestion.type)}
										</div>
										<div>
											<h4 class="font-medium text-sm">{suggestion.title}</h4>
											{#if showConfidence}
												<div class="flex items-center gap-2 mt-1">
													<span class="text-xs text-muted-foreground">Confidence:</span>
													<span class="text-xs font-medium {getConfidenceColor(suggestion.confidence)}">
														{getConfidenceText(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
													</span>
												</div>
											{/if}
										</div>
									</div>

									<div class="flex items-center gap-1">
										<button
											type="button"
											class="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
											onclick={() => handleCopySuggestion(suggestion)}
											title="Copy suggestion"
										>
											{#if copiedIds.has(suggestion.id)}
												<Check size={14} class="text-success" />
											{:else}
												<Copy size={14} />
											{/if}
										</button>
									</div>
								</div>

								<!-- Suggestion Content -->
								<div class="mb-3">
									{#if suggestion.type === 'code'}
										<pre class="bg-code-bg text-code-text p-3 rounded-md text-sm overflow-x-auto"><code>{suggestion.content}</code></pre>
									{:else}
										<p class="text-sm leading-relaxed">{suggestion.content}</p>
									{/fi}
								</div>

								<!-- Reasoning Section -->
								{#if suggestion.reasoning && showReasoning}
									<div class="border-t border-border pt-3 mt-3">
										<button
											type="button"
											class="flex items-center gap-2 text-sm text-ai-highlight hover:text-ai-hover transition-colors"
											onclick={() => toggleReasoning(suggestion)}
										>
											<span>Reasoning</span>
											{#if expandedReasoningIds.has(suggestion.id)}
												<ChevronUp size={14} />
											{:else}
												<ChevronDown size={14} />
											{/if}
										</button>

										{#if expandedReasoningIds.has(suggestion.id)}
											<div class="mt-2 p-3 bg-ai-bg/20 rounded-md" transition:slide={{ duration: 200 }}>
												<p class="text-sm text-ai-text/80 leading-relaxed">{suggestion.reasoning}</p>
											</div>
										{/if}
									</div>
								{/fi}

								<!-- Actions -->
								<div class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
									<button
										type="button"
										class="px-3 py-1.5 text-xs font-medium text-ai-highlight hover:text-ai-hover hover:bg-ai-bg/30 rounded-md transition-colors"
										onclick={() => handleApplySuggestion(suggestion)}
									>
										Apply Suggestion
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Custom scrollbar for suggestion content */
	.overflow-y-auto::-webkit-scrollbar {
		width: 6px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: var(--color-ai-border);
		border-radius: 3px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: var(--color-ai-highlight);
	}

	/* Code block styling */
	pre {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
	}

	code {
		font-family: inherit;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Loading animation */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* Enhanced hover states */
	.hover\:border-ai-border:hover {
		border-color: var(--color-ai-border);
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		.ai-panel {
			outline: 2px solid var(--color-ai-highlight);
		}

		button:focus,
		button:hover {
			outline: 2px solid currentColor;
			outline-offset: 2px;
		}
	}
</style>
