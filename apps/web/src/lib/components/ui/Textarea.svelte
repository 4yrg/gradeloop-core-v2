<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		rows?: number;
		cols?: number;
		minRows?: number;
		maxRows?: number;
		resize?: 'none' | 'vertical' | 'horizontal' | 'both';
		variant?: 'default' | 'error' | 'success' | 'ai-enhanced';
		label?: string;
		description?: string;
		error?: string;
		success?: string;
		aiSuggestion?: string;
		aiWritingMode?: boolean;
		fullWidth?: boolean;
		class?: string;
		id?: string;
		name?: string;
		maxlength?: number;
		minlength?: number;
		autoResize?: boolean;
		spellcheck?: boolean;
		autocomplete?: string;
		leftIcon?: Snippet;
		rightIcon?: Snippet;
	}

	let {
		value = $bindable(''),
		placeholder,
		disabled = false,
		readonly = false,
		required = false,
		rows = 4,
		cols,
		minRows = 2,
		maxRows = 10,
		resize = 'vertical',
		variant = 'default',
		label,
		description,
		error,
		success,
		aiSuggestion,
		aiWritingMode = false,
		fullWidth = true,
		class: className = '',
		id,
		name,
		maxlength,
		minlength,
		autoResize = false,
		spellcheck = true,
		autocomplete,
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
		aiAssist: { text: string; position: number };
	}>();

	let textareaElement: HTMLTextAreaElement;
	let focused = $state(false);
	let aiGenerating = $state(false);

	const baseClasses = 'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200';

	const variants = {
		default: 'border-input focus:border-primary',
		error: 'border-error focus:border-error focus-visible:ring-error/30',
		success: 'border-success focus:border-success focus-visible:ring-success/30',
		'ai-enhanced': 'border-ai-border bg-ai-bg/50 focus:border-ai-highlight focus-visible:ring-ai-highlight/30 ai-glow'
	};

	const resizeClasses = {
		none: 'resize-none',
		vertical: 'resize-y',
		horizontal: 'resize-x',
		both: 'resize'
	};

	$: computedClasses = twMerge(
		baseClasses,
		variants[variant],
		resizeClasses[resize],
		fullWidth && 'w-full',
		(leftIcon || rightIcon) && 'relative',
		className
	);

	$: hasError = !!error;
	$: hasSuccess = !!success && !hasError;
	$: hasAiSuggestion = !!aiSuggestion && !hasError && !hasSuccess;

	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		value = target.value;

		if (autoResize) {
			adjustHeight();
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
		// AI writing assistance hotkeys
		if (aiWritingMode && (event.ctrlKey || event.metaKey)) {
			if (event.key === 'i') {
				event.preventDefault();
				triggerAiAssist();
			} else if (event.key === 'Enter') {
				event.preventDefault();
				continueWithAi();
			}
		}

		dispatch('keydown', event);
	}

	function handleKeyup(event: KeyboardEvent) {
		dispatch('keyup', event);
	}

	function adjustHeight() {
		if (!textareaElement || !autoResize) return;

		// Reset height to auto to get the correct scrollHeight
		textareaElement.style.height = 'auto';

		const scrollHeight = textareaElement.scrollHeight;
		const minHeight = minRows * 24; // Approximate line height
		const maxHeight = maxRows * 24;

		const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
		textareaElement.style.height = `${newHeight}px`;
	}

	function triggerAiAssist() {
		if (!textareaElement) return;

		const cursorPosition = textareaElement.selectionStart;
		dispatch('aiAssist', {
			text: value,
			position: cursorPosition
		});
	}

	function continueWithAi() {
		if (aiGenerating) return;

		aiGenerating = true;
		// Simulate AI generation
		setTimeout(() => {
			aiGenerating = false;
		}, 2000);
	}

	// Auto-generated ID if not provided
	const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

	// Focus method for external access
	export function focus() {
		textareaElement?.focus();
	}

	// Blur method for external access
	export function blur() {
		textareaElement?.blur();
	}

	// Insert text at cursor position
	export function insertText(text: string) {
		if (!textareaElement) return;

		const start = textareaElement.selectionStart;
		const end = textareaElement.selectionEnd;
		const newValue = value.slice(0, start) + text + value.slice(end);

		value = newValue;

		// Restore cursor position
		setTimeout(() => {
			textareaElement.setSelectionRange(start + text.length, start + text.length);
		});
	}
</script>

<div class="space-y-2 {fullWidth ? 'w-full' : ''}">
	{#if label}
		<label
			for={textareaId}
			class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 {required ? "after:content-['*'] after:text-error after:ml-1" : ''}"
		>
			{label}
		</label>
	{/if}

	<div class="relative">
		{#if leftIcon}
			<div class="absolute left-3 top-3 text-muted-foreground pointer-events-none z-10">
				{@render leftIcon()}
			</div>
		{/if}

		<textarea
			bind:this={textareaElement}
			id={textareaId}
			{name}
			{placeholder}
			{disabled}
			{readonly}
			{required}
			{rows}
			{cols}
			{maxlength}
			{minlength}
			{spellcheck}
			{autocomplete}
			{value}
			class={computedClasses}
			style={autoResize ? 'min-height: {minRows * 1.5}rem; max-height: {maxRows * 1.5}rem;' : ''}
			oninput={handleInput}
			onchange={handleChange}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			onkeyup={handleKeyup}
			aria-invalid={hasError}
			aria-describedby={description || error || success || aiSuggestion ? `${textareaId}-description` : undefined}
		></textarea>

		{#if rightIcon}
			<div class="absolute right-3 top-3 text-muted-foreground pointer-events-none z-10">
				{@render rightIcon()}
			</div>
		{/if}

		{#if aiWritingMode}
			<div class="absolute bottom-2 right-2 flex items-center gap-2 z-20">
				{#if aiGenerating}
					<div class="flex items-center gap-1 text-ai-highlight bg-ai-bg rounded-full px-2 py-1 text-xs">
						<svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>AI writing...</span>
					</div>
				{:else}
					<button
						type="button"
						class="text-ai-highlight hover:text-ai-hover bg-ai-bg hover:bg-ai-bg/80 rounded-full p-1 transition-colors"
						onclick={triggerAiAssist}
						title="AI Assist (Ctrl+I)"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		{#if variant === 'ai-enhanced' && focused}
			<div class="absolute inset-0 rounded-md bg-ai-highlight/5 pointer-events-none animate-pulse"></div>
		{/if}
	</div>

	{#if aiWritingMode && focused}
		<div class="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 border border-dashed">
			<div class="flex items-center gap-4 text-center">
				<span><kbd class="px-1 py-0.5 text-xs bg-background border rounded">Ctrl+I</kbd> AI Assist</span>
				<span><kbd class="px-1 py-0.5 text-xs bg-background border rounded">Ctrl+Enter</kbd> Continue Writing</span>
			</div>
		</div>
	{/if}

	{#if description || error || success || aiSuggestion}
		<div id="{textareaId}-description" class="space-y-1">
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
				<div class="text-sm text-ai-text bg-ai-bg/30 border border-ai-border/50 rounded-md p-3 flex items-start gap-3">
					<svg class="h-4 w-4 mt-0.5 text-ai-highlight flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
					</svg>
					<div class="flex-1">
						<span class="font-medium text-ai-highlight">AI Suggestion:</span>
						<p class="mt-1">{aiSuggestion}</p>
						<button
							type="button"
							class="mt-2 text-xs text-ai-highlight hover:text-ai-hover underline"
							onclick={() => insertText(aiSuggestion)}
						>
							Apply suggestion
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if maxlength}
		<div class="flex justify-end">
			<span class="text-xs text-muted-foreground">
				{value?.length || 0}/{maxlength}
			</span>
		</div>
	{/if}
</div>

<style>
	/* AI enhanced textarea glow effect */
	:global(.ai-glow:focus-within) {
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.1);
	}

	/* Custom scrollbar for textarea */
	textarea::-webkit-scrollbar {
		width: 8px;
	}

	textarea::-webkit-scrollbar-track {
		background: transparent;
	}

	textarea::-webkit-scrollbar-thumb {
		background: var(--color-border-default);
		border-radius: 4px;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-muted);
	}

	/* Improved focus states for accessibility */
	textarea:focus-visible {
		outline: none;
	}

	/* Keyboard shortcuts styling */
	kbd {
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		textarea,
		.animate-pulse,
		.animate-spin {
			transition: none !important;
			animation: none !important;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		textarea {
			border-width: 2px;
		}
	}
</style>
