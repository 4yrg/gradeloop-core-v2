<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'ai-action' | 'outline';
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
		disabled?: boolean;
		loading?: boolean;
		fullWidth?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: () => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		type = 'button',
		class: className = '',
		onclick,
		children
	}: Props = $props();

	const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

	const variants = {
		primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-sm hover:shadow-md',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active border border-input shadow-sm hover:shadow-md',
		ghost: 'text-primary hover:bg-primary/10 hover:text-primary active:bg-primary/20',
		destructive: 'bg-error text-white hover:bg-error-hover active:bg-red-700 shadow-sm hover:shadow-md',
		'ai-action': 'bg-ai-highlight text-white hover:bg-ai-hover active:bg-ai-active shadow-sm hover:shadow-md ai-glow',
		outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm'
	};

	const sizes = {
		sm: 'h-8 px-3 text-sm gap-2',
		md: 'h-10 px-4 text-sm gap-2',
		lg: 'h-11 px-6 text-base gap-3',
		xl: 'h-12 px-8 text-base gap-3',
		icon: 'h-10 w-10'
	};

	$: computedClasses = twMerge(
		baseClasses,
		variants[variant],
		sizes[size],
		fullWidth && 'w-full',
		loading && 'cursor-not-allowed',
		className
	);

	function handleClick() {
		if (!disabled && !loading && onclick) {
			onclick();
		}
	}
</script>

<button
	{type}
	class={computedClasses}
	disabled={disabled || loading}
	onclick={handleClick}
	aria-busy={loading}
	aria-label={loading ? 'Loading...' : undefined}
>
	{#if loading}
		<svg
			class="animate-spin h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
		{#if size !== 'icon'}
			<span>Loading...</span>
		{/if}
	{:else}
		{@render children()}
	{/if}
</button>

<style>
	/* AI action button glow effect */
	:global(.ai-glow:hover) {
		box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
	}

	/* Smooth loading animation */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* Enhanced focus states for accessibility */
	button:focus-visible {
		box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.35);
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none !important;
		}

		.animate-spin {
			animation: none;
		}
	}
</style>
