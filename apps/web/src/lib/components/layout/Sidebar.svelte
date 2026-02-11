<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';

	interface NavItem {
		id: string;
		label: string;
		href?: string;
		icon?: any;
		badge?: string | number;
		active?: boolean;
		disabled?: boolean;
		children?: NavItem[];
		roles?: string[];
	}

	interface Props {
		items: NavItem[];
		collapsed?: boolean;
		userRole?: string;
		currentPath?: string;
		logo?: Snippet;
		header?: Snippet;
		footer?: Snippet;
		class?: string;
		onNavigate?: (item: NavItem) => void;
		onToggleCollapse?: () => void;
	}

	let {
		items,
		collapsed = false,
		userRole = 'student',
		currentPath = '',
		logo,
		header,
		footer,
		class: className = '',
		onNavigate,
		onToggleCollapse
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		navigate: NavItem;
		toggleCollapse: boolean;
	}>();

	let expandedItems = $state<Set<string>>(new Set());

	// Filter items based on user role
	$: filteredItems = items.filter(item => {
		if (!item.roles || item.roles.length === 0) return true;
		return item.roles.includes(userRole);
	});

	function isItemActive(item: NavItem): boolean {
		if (item.active) return true;
		if (item.href === currentPath) return true;
		if (item.children?.some(child => isItemActive(child))) return true;
		return false;
	}

	function handleItemClick(item: NavItem) {
		if (item.disabled) return;

		if (item.children && item.children.length > 0) {
			toggleExpanded(item.id);
		} else {
			dispatch('navigate', item);
			onNavigate?.(item);
		}
	}

	function toggleExpanded(itemId: string) {
		if (expandedItems.has(itemId)) {
			expandedItems.delete(itemId);
		} else {
			expandedItems.add(itemId);
		}
		expandedItems = new Set(expandedItems);
	}

	function toggleCollapse() {
		dispatch('toggleCollapse', !collapsed);
		onToggleCollapse?.();
	}

	function handleKeydown(event: KeyboardEvent, item: NavItem) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleItemClick(item);
		}
	}

	// Auto-expand parent items if child is active
	$: {
		items.forEach(item => {
			if (item.children?.some(child => isItemActive(child))) {
				expandedItems.add(item.id);
			}
		});
		expandedItems = new Set(expandedItems);
	}
</script>

<div
	class={twMerge(
		'flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-300',
		collapsed ? 'w-16' : 'w-64',
		className
	)}
>
	<!-- Sidebar Header -->
	{#if header || logo}
		<div class="flex items-center justify-between p-4 border-b border-sidebar-border">
			{#if logo}
				<div class="flex items-center gap-2 min-w-0">
					{@render logo()}
				</div>
			{/if}

			{#if header}
				<div class="flex-1 min-w-0 {collapsed ? 'hidden' : 'block'}">
					{@render header()}
				</div>
			{/if}

			<!-- Collapse Toggle -->
			<button
				type="button"
				class="hidden lg:flex items-center justify-center w-8 h-8 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
				onclick={toggleCollapse}
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<svg
					class="w-4 h-4 transition-transform duration-200 {collapsed ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
		</div>
	{/if}

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto p-2" aria-label="Main navigation">
		<ul class="space-y-1">
			{#each filteredItems as item (item.id)}
				<li>
					<div class="relative">
						<!-- Main Item -->
						<button
							type="button"
							class={twMerge(
								'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
								'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
								'focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar',
								isItemActive(item) && 'bg-sidebar-primary text-sidebar-primary-foreground',
								item.disabled && 'opacity-50 cursor-not-allowed'
							)}
							onclick={() => handleItemClick(item)}
							onkeydown={(e) => handleKeydown(e, item)}
							disabled={item.disabled}
							aria-expanded={item.children && expandedItems.has(item.id)}
							aria-haspopup={item.children ? 'true' : undefined}
							title={collapsed ? item.label : undefined}
						>
							<!-- Icon -->
							{#if item.icon}
								<div class="flex-shrink-0 w-5 h-5">
									<svelte:component this={item.icon} class="w-full h-full" />
								</div>
							{/if}

							<!-- Label -->
							{#if !collapsed}
								<span class="flex-1 text-left truncate">{item.label}</span>

								<!-- Badge -->
								{#if item.badge}
									<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-sidebar-primary-foreground bg-sidebar-primary rounded-full">
										{item.badge}
									</span>
								{/if}

								<!-- Expand/Collapse Arrow -->
								{#if item.children && item.children.length > 0}
									<svg
										class="w-4 h-4 transition-transform duration-200 {expandedItems.has(item.id) ? 'rotate-90' : ''}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										/>
									</svg>
								{/if}
							{/if}
						</button>

						<!-- Tooltip for collapsed state -->
						{#if collapsed && item.label}
							<div
								class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
							>
								{item.label}
							</div>
						{/if}
					</div>

					<!-- Sub Navigation -->
					{#if item.children && item.children.length > 0 && !collapsed && expandedItems.has(item.id)}
						<ul class="ml-8 mt-1 space-y-1" role="group">
							{#each item.children as child (child.id)}
								{#if !child.roles || child.roles.length === 0 || child.roles.includes(userRole)}
									<li>
										<button
											type="button"
											class={twMerge(
												'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
												'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
												'focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar',
												isItemActive(child) && 'bg-sidebar-primary text-sidebar-primary-foreground',
												child.disabled && 'opacity-50 cursor-not-allowed'
											)}
											onclick={() => handleItemClick(child)}
											onkeydown={(e) => handleKeydown(e, child)}
											disabled={child.disabled}
										>
											{#if child.icon}
												<div class="flex-shrink-0 w-4 h-4">
													<svelte:component this={child.icon} class="w-full h-full" />
												</div>
											{/if}
											<span class="flex-1 text-left truncate">{child.label}</span>
											{#if child.badge}
												<span class="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-sidebar-primary-foreground bg-sidebar-primary rounded-full">
													{child.badge}
												</span>
											{/if}
										</button>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Sidebar Footer -->
	{#if footer && !collapsed}
		<div class="border-t border-sidebar-border p-4">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	/* Smooth transitions for collapse/expand */
	.transition-all {
		transition-property: all;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 300ms;
	}

	/* Enhanced focus states for accessibility */
	button:focus-visible {
		outline: none;
	}

	/* Tooltip positioning */
	.group:hover .group-hover\:opacity-100 {
		opacity: 1;
	}

	/* Scrollbar styling for navigation */
	nav::-webkit-scrollbar {
		width: 4px;
	}

	nav::-webkit-scrollbar-track {
		background: transparent;
	}

	nav::-webkit-scrollbar-thumb {
		background: var(--color-sidebar-border);
		border-radius: 2px;
	}

	nav::-webkit-scrollbar-thumb:hover {
		background: var(--color-sidebar-accent);
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
		button {
			outline: 1px solid transparent;
		}

		button:focus,
		button:hover {
			outline-color: currentColor;
		}
	}

	/* Focus trap for keyboard navigation */
	:global(.sidebar-focus-trap) {
		position: relative;
	}
</style>
