<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
		value?: string | number;
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		size?: 'sm' | 'md' | 'lg';
		variant?: 'default' | 'error' | 'success' | 'ai-enhanced';
		label?: string;
		description?: string;
		error?: string;
		success?: string;
		aiSuggestion?: string;
		fullWidth?: boolean;
		class?: string;
		id?: string;
		name?: string;
		autocomplete?: string;
		maxlength?: number;
		minlength?: number;
		min?: number | string;
		max?: number | string;
		step?: number | string;
		pattern?: string;
		leftIcon?: Snippet;
		rightIcon?: Snippet;
	}

	let {
		type = 'text',
		value = $bindable(),
		placeholder,
		disabled = false,
		readonly = false,
		required = false,
		size = 'md',
		variant = 'default',
		label,
		description,
		error,
		success,
		aiSuggestion,
		fullWidth = false,
		class: className = '',
		id,
		name,
		autocomplete,
		maxlength,
		minlength,
		min,
		max,
		step,
		pattern,
		leftIcon,
		rightIcon
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		input: Event;
		change: Event;
		focus: FocusEvent;
		blur: FocusEvent;
		keydown: KeyboardEvent;
		keyup: KeyboardEvent;
	}>();

	let inputElement: HTMLInputElement;
	let focused = $state(false);

	const baseClasses = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200';

	const variants = {
		default: 'border-input focus:border-primary',
		error: 'border-error focus:border-error focus-visible:ring-error/30',
		success: 'border-success focus:border-success focus-visible:ring-success/30',
		'ai-enhanced': 'border-ai-border bg-ai-bg/50 focus:border-ai-highlight focus-visible:ring-ai-highlight/30 ai-glow'
	};

	const sizes = {
		sm: 'h-8 px-2 text-xs',
		md: 'h-10 px-3 py-2 text-sm',
		lg: 'h-12 px-4 py-3 text-base'
	};

	$: computedClasses = twMerge(
		baseClasses,
		variants[variant],
		sizes[size],
		fullWidth && 'w-full',
		(leftIcon || rightIcon) && 'pl-10',
		rightIcon && 'pr-10',
		className
	);

	$: hasError = !!error;
	$: hasSuccess = !!success && !hasError;
	$: hasAiSuggestion = !!aiSuggestion && !hasError && !hasSuccess;

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		if (type === 'number') {
			value = target.valueAsNumber || 0;
		} else {
			value = target.value;
		}
		dispatch('input', event);
	}

	function handleChange(event: Event) {
		dispatch('change', event);
	}

	function handleFocus(event: FocusEvent) {
		focused = true;
		dispatch('focus', event);
	}

	function handleBlur(event: FocusEvent) {
		focused = false;
		dispatch('blur', event);
	}

	function handleKeydown(event: KeyboardEvent) {
		dispatch('keydown', event);
	}

	function handleKeyup(event: KeyboardEvent) {
		dispatch('keyup', event);
	}

	// Auto-generated ID if not provided
	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

	// Focus method for external access
	export function focus() {
		inputElement?.focus();
	}

	// Blur method for external access
	export function blur() {
		inputElement?.blur();
	}
</script>

<div class="space-y-2 {fullWidth ? 'w-full' : ''}">
	{#if label}
		<label
			for={inputId}
			class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 {required ? "after:content-['*'] after:text-error after:ml-1" : ''}"
		>
			{label}
		</label>
	{/if}

	<div class="relative">
		{#if leftIcon}
			<div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
				{@render leftIcon()}
			</div>
		{/if}

		<input
			bind:this={inputElement}
			{type}
			{id}
			{name}
			{placeholder}
			{disabled}
			{readonly}
			{required}
			{autocomplete}
			{maxlength}
			{minlength}
			{min}
			{max}
			{step}
			{pattern}
			{value}
			class={computedClasses}
			oninput={handleInput}
			onchange={handleChange}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			onkeyup={handleKeyup}
			aria-invalid={hasError}
			aria-describedby={description || error || success || aiSuggestion ? `${inputId}-description` : undefined}
		/>

		{#if rightIcon}
			<div class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
				{@render rightIcon()}
			</div>
		{/if}

		{#if variant === 'ai-enhanced' && focused}
			<div class="absolute inset-0 rounded-md bg-ai-highlight/5 pointer-events-none animate-pulse"></div>
		{/if}
	</div>

	{#if description || error || success || aiSuggestion}
		<div id="{inputId}-description" class="space-y-1">
			{#if description && !error && !success && !aiSuggestion}
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

			{#if aiSuggestion && !error && !success}
				<div class="text-sm text-ai-text bg-ai-bg/30 border border-ai-border/50 rounded-md p-2 flex items-start gap-2">
					<svg class="h-4 w-4 mt-0.5 text-ai-highlight" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
					</svg>
					<div>
						<span class="font-medium text-ai-highlight">AI Suggestion:</span>
						<span class="ml-1">{aiSuggestion}</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* AI enhanced input glow effect */
	:global(.ai-glow:focus-within) {
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.1);
	}

	/* Custom file input styling */
	input[type="file"] {
		padding: 0.5rem 0.75rem;
	}

	input[type="file"]::file-selector-button {
		@apply mr-2 rounded border-0 bg-muted px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted/80;
	}

	/* Number input arrows styling */
	input[type="number"]::-webkit-outer-spin-button,
	input[type="number"]::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type="number"] {
		-moz-appearance: textfield;
	}

	/* Search input styling */
	input[type="search"]::-webkit-search-decoration,
	input[type="search"]::-webkit-search-cancel-button,
	input[type="search"]::-webkit-search-results-button,
	input[type="search"]::-webkit-search-results-decoration {
		-webkit-appearance: none;
	}

	/* Improved focus states for accessibility */
	input:focus-visible {
		outline: none;
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		input,
		.animate-pulse {
			transition: none !important;
			animation: none !important;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		input {
			border-width: 2px;
		}
	}
</style>
