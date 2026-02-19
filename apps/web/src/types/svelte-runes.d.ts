/// <reference types="svelte" />

/**
 * Svelte 5 Runes type declarations
 * These are compile-time macros that don't exist at runtime
 */

declare global {
	/**
	 * Creates reactive state
	 */
	function $state<T>(value?: T): T;

	/**
	 * Creates derived reactive value
	 */
	function $derived<T>(expression: T): T;

	/**
	 * Creates reactive effect
	 */
	function $effect(fn: () => void | (() => void)): void;

	/**
	 * Access component props
	 */
	function $props<T extends Record<string, unknown>>(): T;

	/**
	 * Rest props
	 */
	function $$restProps(): Record<string, unknown>;

	/**
	 * Slots
	 */
	const $$slots: Record<string, boolean>;
}

export {};
