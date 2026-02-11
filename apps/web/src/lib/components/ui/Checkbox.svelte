<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';

	interface Props {
		checked?: boolean;
		indeterminate?: boolean;
		disabled?: boolean;
		required?: boolean;
		value?: string;
		size?: 'sm' | 'md' | 'lg';
		variant?: 'default' | 'success' | 'error' | 'ai-enhanced';
		label?: string;
		description?: string;
		error?: string;
		success?: string;
		aiValidation?: string;
		class?: string;
		id?: string;
		name?: string;
	}

	let {
		checked = $bindable(false),
		indeterminate = false,
		disabled = false,
		required = false,
		value,
		size = 'md',
		variant = 'default',
		label,
		description,
		error,
		success,
		aiValidation,
		class: className = '',
		id,
		name
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { checked: boolean; value?: string };
		focus: FocusEvent;
		blur: FocusEvent;
	}>();

	let checkboxElement: HTMLInputElement;

	const sizes = {
		sm: 'h-3 w-3',
		md: 'h-4 w-4',
		lg: 'h-5 w-5'
	};

	const labelSizes = {
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base'
	};

	const baseClasses = 'border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-sm transition-all duration-200';

	const variants = {
		default: 'text-primary-foreground focus-visible:ring-ring',
		success: 'text-success-foreground border-success focus-visible:ring-success/30',
		error: 'text-error-foreground border-error focus-visible:ring-error/30',
		'ai-enhanced': 'text-ai-highlight border-ai-border bg-ai-bg/20 focus-visible:ring-ai-highlight/30 ai-glow'
	};

	$: computedClasses = twMerge(
		baseClasses,
		variants[variant],
		sizes[size],
		className
	);

	$: hasError = !!error;
	$: hasSuccess = !!success && !hasError;
	$: hasAiValidation = !!aiValidation && !hasError && !hasSuccess;

	function handleChange() {
		if (disabled) return;

		checked = !checked;
		dispatch('change', { checked, value });
	}

	function handleFocus(event: FocusEvent) {
		dispatch('focus', event);
	}

	function handleBlur(event: FocusEvent) {
		dispatch('blur', event);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			handleChange();
		}
	}

	// Auto-generated ID if not provided
	const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

	// Update indeterminate state
	$: if (checkboxElement) {
		checkboxElement.indeterminate = indeterminate;
	}

	// Focus method for external access
	export function focus() {
		checkboxElement?.focus();
	}

	// Blur method for external access
	export function blur() {
		checkboxElement?.blur();
	}
</script>

<div class="flex items-start space-x-2">
	<div class="relative flex items-center">
		<input
			bind:this={checkboxElement}
			type="checkbox"
			{id}
			{name}
			{value}
			{disabled}
			{required}
			bind:checked
			class="sr-only peer"
			onfocus={handleFocus}
			onblur={handleBlur}
			aria-invalid={hasError}
			aria-describedby={description || error || success || aiValidation ? `${checkboxId}-description` : undefined}
		/>

		<div
			class={computedClasses}
			onclick={handleChange}
			onkeydown={handleKeydown}
			role="checkbox"
			tabindex={disabled ? -1 : 0}
			aria-checked={indeterminate ? 'mixed' : checked}
			aria-labelledby={label ? `${checkboxId}-label` : undefined}
		>
			{#if checked && !indeterminate}
				<svg
					class="w-full h-full p-0.5 text-current"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			{:else if indeterminate}
				<svg
					class="w-full h-full p-0.5 text-current"
					fill="currentColor"
					viewBox="0 0 20 20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect x="4" y="9" width="12" height="2" rx="1" />
				</svg>
			{/if}
		</div>

		{#if variant === 'ai-enhanced'}
			<div class="absolute inset-0 rounded-sm bg-ai-highlight/5 pointer-events-none opacity-0 peer-focus:opacity-100 transition-opacity"></div>
		{/if}
	</div>

	{#if label || description || error || success || aiValidation}
		<div class="flex-1 space-y-1">
			{#if label}
				<label
					for={checkboxId}
					id="{checkboxId}-label"
					class="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer {labelSizes[size]} {required ? "after:content-['*'] after:text-error after:ml-1" : ''}"
					onclick={handleChange}
				>
					{label}
				</label>
			{/if}

			{#if description || error || success || aiValidation}
				<div id="{checkboxId}-description" class="space-y-1">
					{#if description && !error && !success && !aiValidation}
						<p class="text-sm text-muted-foreground">
							{description}
						</p>
					{/if}

					{#if error}
						<p class="text-sm text-error flex items-center gap-2">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							{error}
						</p>
					{/if}

					{#if success && !error}
						<p class="text-sm text-success flex items-center gap-2">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							{success}
						</p>
					{/if}

					{#if aiValidation && !error && !success}
						<div class="text-sm text-ai-text bg-ai-bg/30 border border-ai-border/50 rounded-md p-2 flex items-start gap-2">
							<svg class="h-4 w-4 mt-0.5 text-ai-highlight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
							</svg>
							<div>
								<span class="font-medium text-ai-highlight">AI Validation:</span>
								<span class="ml-1">{aiValidation}</span>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* AI enhanced checkbox glow effect */
	:global(.ai-glow:hover),
	:global(.ai-glow:focus-within) {
		box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
	}

	/* Custom checkbox styling */
	[role="checkbox"] {
		background-color: var(--color-background);
		cursor: pointer;
	}

	[role="checkbox"][aria-checked="true"],
	[role="checkbox"][aria-checked="mixed"] {
		background-color: var(--color-primary);
		border-color: var(--color-primary);
	}

	[role="checkbox"][aria-checked="true"]:hover,
	[role="checkbox"][aria-checked="mixed"]:hover {
		background-color: var(--color-primary-hover);
		border-color: var(--color-primary-hover);
	}

	/* Success state */
	.peer:checked + [role="checkbox"]:has(~ .text-success) {
		background-color: var(--color-success);
		border-color: var(--color-success);
	}

	/* Error state */
	.peer:checked + [role="checkbox"]:has(~ .text-error) {
		background-color: var(--color-error);
		border-color: var(--color-error);
	}

	/* AI enhanced state */
	.peer:checked + [role="checkbox"]:has(~ .ai-glow) {
		background-color: var(--color-ai-highlight);
		border-color: var(--color-ai-highlight);
	}

	/* Improved focus states for accessibility */
	[role="checkbox"]:focus-visible {
		box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.35);
	}

	/* Disabled state */
	[role="checkbox"][aria-disabled="true"] {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		[role="checkbox"],
		.transition-opacity {
			transition: none !important;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		[role="checkbox"] {
			border-width: 2px;
		}

		[role="checkbox"][aria-checked="true"],
		[role="checkbox"][aria-checked="mixed"] {
			outline: 2px solid currentColor;
			outline-offset: 2px;
		}
	}
</style>
