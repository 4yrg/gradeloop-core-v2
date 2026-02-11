<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Lightbulb, ChevronRight, ChevronDown, X, Copy, Check } from 'lucide-svelte';

	interface Props {
		content: string;
		hint?: string;
		type?: 'suggestion' | 'improvement' | 'warning' | 'info';
		expanded?: boolean;
		position?: 'top' | 'bottom' | 'left' | 'right';
		size?: 'sm' | 'md' | 'lg';
		showIcon?: boolean;
		dismissible?: boolean;
		copyable?: boolean;
		confidence?: number;
		class?: string;
	}

	let {
		content,
		hint = 'AI suggestion available',
		type = 'suggestion',
		expanded = $bindable(false),
		position = 'right',
		size = 'md',
		showIcon = true,
		dismissible = true,
		copyable = false,
		confidence,
		class: className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		expand: void;
		collapse: void;
		dismiss: void;
		copy: string;
	}>();

	let copied = $state(false);
	let dismissed = $state(false);

	const typeStyles = {
		suggestion: 'border-ai-highlight bg-ai-bg text-ai-text',
		improvement: 'border-accent bg-accent-bg text-accent-foreground',
		warning: 'border-warning bg-warning-bg text-warning',
		info: 'border-info bg-info-bg text-info'
	};

	const sizeStyles = {
		sm: 'text-xs px-2 py-1',
		md: 'text-sm px-3 py-2',
		lg: 'text-base px-4 py-3'
	};

	const positionStyles = {
		top: 'mb-2',
		bottom: 'mt-2',
		left: 'mr-2',
		right: 'ml-2'
	};

	function handleToggle() {
		expanded = !expanded;
		if (expanded) {
			dispatch('expand');
		} else {
			dispatch('collapse');
		}
	}

	function handleDismiss() {
		dismissed = true;
		dispatch('dismiss');
	}

	function handleCopy() {
		navigator.clipboard.writeText(content);
		copied = true;
		dispatch('copy', content);

		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function getConfidenceColor(conf: number): string {
		if (conf >= 0.8) return 'text-success';
		if (conf >= 0.6) return 'text-warning';
		return 'text-error';
	}

	$: containerClasses = twMerge(
		'relative inline-block border rounded-lg transition-all duration-200',
		typeStyles[type],
		sizeStyles[size],
		positionStyles[position],
		expanded && 'shadow-md',
		className
	);
</script>

{#if !dismissed}
	<div class={containerClasses}>
		<!-- Collapsed State - Hint Button -->
		{#if !expanded}
			<button
				type="button"
				class="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
				onclick={handleToggle}
				aria-expanded="false"
				aria-label="Expand AI hint"
			>
				{#if showIcon}
					<Lightbulb size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
				{/if}
				<span class="truncate flex-1">{hint}</span>
				<ChevronRight size={size === 'sm' ? 12 : 14} class="flex-shrink-0" />
			</button>
		{/if}

		<!-- Expanded State - Full Content -->
		{#if expanded}
			<div transition:slide={{ duration: 200 }}>
				<!-- Header -->
				<div class="flex items-center justify-between mb-2">
					<button
						type="button"
						class="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
						onclick={handleToggle}
						aria-expanded="true"
						aria-label="Collapse AI hint"
					>
						{#if showIcon}
							<Lightbulb size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
						{/if}
						<span class="font-medium">AI Suggestion</span>
						<ChevronDown size={size === 'sm' ? 12 : 14} />
					</button>

					<div class="flex items-center gap-1">
						{#if copyable}
							<button
								type="button"
								class="p-1 rounded hover:bg-current/10 transition-colors"
								onclick={handleCopy}
								title="Copy content"
							>
								{#if copied}
									<Check size={14} class="text-success" />
								{:else}
									<Copy size={14} />
								{/if}
							</button>
						{/if}

						{#if dismissible}
							<button
								type="button"
								class="p-1 rounded hover:bg-current/10 transition-colors"
								onclick={handleDismiss}
								title="Dismiss hint"
							>
								<X size={14} />
							</button>
						{/if}
					</div>
				</div>

				<!-- Confidence Indicator -->
				{#if confidence !== undefined}
					<div class="flex items-center gap-2 mb-2 text-xs">
						<span class="text-muted-foreground">Confidence:</span>
						<span class="font-medium {getConfidenceColor(confidence)}">
							{Math.round(confidence * 100)}%
						</span>
						<div class="flex-1 bg-current/10 rounded-full h-1 overflow-hidden">
							<div
								class="h-full {getConfidenceColor(confidence)} bg-current transition-all duration-300"
								style="width: {confidence * 100}%"
							></div>
						</div>
					</div>
				{/if}

				<!-- Content -->
				<div class="leading-relaxed">
					<p>{content}</p>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-current/20">
					<button
						type="button"
						class="text-xs font-medium hover:underline"
						onclick={handleToggle}
					>
						Collapse
					</button>
				</div>
			</div>
		{/if}

		<!-- Pulse Animation for New Hints -->
		{#if !expanded && type === 'suggestion'}
			<div class="absolute inset-0 rounded-lg bg-ai-highlight/20 animate-pulse pointer-events-none"></div>
		{/if}
	</div>
{/if}

<style>
	/* Custom pulse animation for AI hints */
	@keyframes pulse {
		0%, 100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.8;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 3;
	}

	/* Smooth transitions */
	button {
		transition: opacity 0.15s ease-in-out;
	}

	/* Enhanced focus states */
	button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Confidence bar styling */
	.bg-current {
		background-color: currentColor;
	}

	/* Hover effects */
	.hover\:bg-current\/10:hover {
		background-color: rgb(from currentColor r g b / 0.1);
	}

	.hover\:opacity-80:hover {
		opacity: 0.8;
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

		.animate-pulse {
			animation: none;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		button:focus,
		button:hover {
			outline: 2px solid currentColor;
			outline-offset: 2px;
		}
	}
</style>
