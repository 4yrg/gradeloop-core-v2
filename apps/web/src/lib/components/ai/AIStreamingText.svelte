<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Sparkles, Square, Copy, Check, RotateCcw } from 'lucide-svelte';

	interface Props {
		text: string;
		streaming?: boolean;
		typewriterSpeed?: number;
		showCursor?: boolean;
		autoStart?: boolean;
		variant?: 'default' | 'code' | 'explanation' | 'response';
		size?: 'sm' | 'md' | 'lg';
		showActions?: boolean;
		copyable?: boolean;
		retryable?: boolean;
		title?: string;
		class?: string;
	}

	let {
		text = '',
		streaming = false,
		typewriterSpeed = 30,
		showCursor = true,
		autoStart = true,
		variant = 'default',
		size = 'md',
		showActions = true,
		copyable = true,
		retryable = false,
		title,
		class: className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		start: void;
		complete: void;
		stop: void;
		copy: string;
		retry: void;
	}>();

	let displayedText = $state('');
	let isAnimating = $state(false);
	let currentIndex = $state(0);
	let animationId: number | null = null;
	let copied = $state(false);
	let cursorVisible = $state(true);

	const variantStyles = {
		default: 'bg-background text-foreground border border-border',
		code: 'bg-code-bg text-code-text font-mono border border-code-gutter',
		explanation: 'bg-ai-bg/30 text-ai-text border border-ai-border/50',
		response: 'bg-muted/50 text-foreground border border-border'
	};

	const sizeStyles = {
		sm: 'text-sm p-3 rounded-md',
		md: 'text-base p-4 rounded-lg',
		lg: 'text-lg p-6 rounded-xl'
	};

	// Typewriter animation
	function startTypewriter() {
		if (isAnimating || !text) return;

		isAnimating = true;
		currentIndex = 0;
		displayedText = '';
		dispatch('start');

		const animate = () => {
			if (currentIndex < text.length) {
				displayedText = text.slice(0, currentIndex + 1);
				currentIndex++;
				animationId = setTimeout(animate, typewriterSpeed);
			} else {
				isAnimating = false;
				dispatch('complete');
			}
		};

		animate();
	}

	function stopTypewriter() {
		if (animationId) {
			clearTimeout(animationId);
			animationId = null;
		}
		isAnimating = false;
		displayedText = text;
		dispatch('stop');
	}

	function resetTypewriter() {
		stopTypewriter();
		displayedText = '';
		currentIndex = 0;
	}

	function handleCopy() {
		navigator.clipboard.writeText(displayedText || text);
		copied = true;
		dispatch('copy', displayedText || text);

		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function handleRetry() {
		resetTypewriter();
		dispatch('retry');
		if (autoStart) {
			startTypewriter();
		}
	}

	// Cursor blinking animation
	let cursorInterval: number | null = null;
	function startCursorBlink() {
		if (cursorInterval) return;
		cursorInterval = setInterval(() => {
			cursorVisible = !cursorVisible;
		}, 530);
	}

	function stopCursorBlink() {
		if (cursorInterval) {
			clearInterval(cursorInterval);
			cursorInterval = null;
		}
		cursorVisible = true;
	}

	// Watch for text changes
	$effect(() => {
		if (streaming && text && autoStart && !isAnimating) {
			startTypewriter();
		} else if (!streaming && text) {
			displayedText = text;
		}
	});

	// Cursor management
	$effect(() => {
		if (showCursor && (isAnimating || streaming)) {
			startCursorBlink();
		} else {
			stopCursorBlink();
		}

		return () => {
			stopCursorBlink();
		};
	});

	// Cleanup
	onDestroy(() => {
		if (animationId) {
			clearTimeout(animationId);
		}
		if (cursorInterval) {
			clearInterval(cursorInterval);
		}
	});

	$: containerClasses = twMerge(
		'relative overflow-hidden transition-all duration-200',
		variantStyles[variant],
		sizeStyles[size],
		streaming && 'ai-glow',
		className
	);

	// Export methods for external control
	export { startTypewriter as start, stopTypewriter as stop, resetTypewriter as reset };
</script>

<div class={containerClasses}>
	{#if title}
		<div class="flex items-center gap-2 mb-3 pb-2 border-b border-current/20">
			<Sparkles size={16} class="text-ai-highlight" />
			<h3 class="font-medium text-sm">{title}</h3>
			{#if streaming}
				<div class="flex items-center gap-1 text-xs text-ai-highlight">
					<div class="w-2 h-2 bg-ai-highlight rounded-full animate-pulse"></div>
					<span>Streaming...</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Text Content -->
	<div class="relative">
		{#if variant === 'code'}
			<pre class="whitespace-pre-wrap break-words leading-relaxed"><code>{displayedText}{#if showCursor && (isAnimating || streaming) && cursorVisible}<span class="animate-pulse">|</span>{/if}</code></pre>
		{:else}
			<div class="whitespace-pre-wrap break-words leading-relaxed">
				{displayedText}{#if showCursor && (isAnimating || streaming) && cursorVisible}<span
					class="inline-block w-2 h-5 bg-current ml-1 animate-pulse"
					style="animation: blink 1.06s infinite;"
				></span>{/if}
			</div>
		{/if}

		<!-- Streaming Indicator -->
		{#if streaming && isAnimating}
			<div
				class="absolute -bottom-1 left-0 h-1 bg-ai-highlight rounded-full animate-pulse"
				style="width: {(currentIndex / text.length) * 100}%"
				transition:fade
			></div>
		{/if}
	</div>

	<!-- Actions -->
	{#if showActions && (displayedText || text)}
		<div class="flex items-center justify-between mt-4 pt-3 border-t border-current/20">
			<div class="flex items-center gap-2">
				{#if streaming && isAnimating}
					<button
						type="button"
						class="flex items-center gap-2 px-2 py-1 text-xs font-medium bg-error/10 text-error hover:bg-error/20 rounded-md transition-colors"
						onclick={stopTypewriter}
						title="Stop streaming"
					>
						<Square size={12} />
						<span>Stop</span>
					</button>
				{:else if !streaming && !isAnimating && text && displayedText !== text}
					<button
						type="button"
						class="flex items-center gap-2 px-2 py-1 text-xs font-medium bg-ai-highlight/10 text-ai-highlight hover:bg-ai-highlight/20 rounded-md transition-colors"
						onclick={startTypewriter}
						title="Start animation"
					>
						<Sparkles size={12} />
						<span>Animate</span>
					</button>
				{/if}

				{#if retryable}
					<button
						type="button"
						class="flex items-center gap-2 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors"
						onclick={handleRetry}
						title="Retry generation"
					>
						<RotateCcw size={12} />
						<span>Retry</span>
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if streaming && currentIndex > 0 && text.length > 0}
					<span class="text-xs text-muted-foreground">
						{currentIndex} / {text.length} chars
					</span>
				{/if}

				{#if copyable && (displayedText || text)}
					<button
						type="button"
						class="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors"
						onclick={handleCopy}
						title="Copy text"
					>
						{#if copied}
							<Check size={12} class="text-success" />
							<span class="text-success">Copied</span>
						{:else}
							<Copy size={12} />
							<span>Copy</span>
						{/if}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom cursor blink animation */
	@keyframes blink {
		0%, 50% {
			opacity: 1;
		}
		51%, 100% {
			opacity: 0;
		}
	}

	/* Code formatting */
	pre {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	code {
		font-family: inherit;
	}

	/* AI glow effect during streaming */
	:global(.ai-glow) {
		box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
		border-color: var(--color-ai-highlight);
	}

	/* Smooth animations */
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Progress bar animation */
	.animate-pulse {
		animation: pulse 1.5s ease-in-out infinite;
	}

	/* Enhanced hover states */
	button:hover {
		transform: translateY(-1px);
	}

	button:active {
		transform: translateY(0);
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
			animation: none !important;
		}

		@keyframes blink {
			to {
				opacity: 1;
			}
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		button:focus,
		button:hover {
			outline: 2px solid currentColor;
			outline-offset: 2px;
		}

		.ai-glow {
			outline: 2px solid var(--color-ai-highlight);
		}
	}
</style>
