<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import type { Snippet } from 'svelte';

	interface Props {
		sidebar?: Snippet;
		header?: Snippet;
		children: Snippet;
		footer?: Snippet;
		sidebarCollapsed?: boolean;
		sidebarPosition?: 'left' | 'right';
		headerHeight?: 'sm' | 'md' | 'lg';
		footerHeight?: 'sm' | 'md' | 'lg';
		class?: string;
		withScrollArea?: boolean;
		mobileSidebarOpen?: boolean;
	}

	let {
		sidebar,
		header,
		children,
		footer,
		sidebarCollapsed = false,
		sidebarPosition = 'left',
		headerHeight = 'md',
		footerHeight = 'sm',
		class: className = '',
		withScrollArea = true,
		mobileSidebarOpen = $bindable(false)
	}: Props = $props();

	const headerHeights = {
		sm: 'h-12',
		md: 'h-16',
		lg: 'h-20'
	};

	const footerHeights = {
		sm: 'h-12',
		md: 'h-16',
		lg: 'h-20'
	};

	const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
	const sidebarMobileWidth = 'w-64';

	function closeMobileSidebar() {
		mobileSidebarOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && mobileSidebarOpen) {
			closeMobileSidebar();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={twMerge('min-h-screen bg-background text-foreground flex flex-col', className)}>
	<!-- Mobile Sidebar Backdrop -->
	{#if mobileSidebarOpen && sidebar}
		<div
			class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
			onclick={closeMobileSidebar}
			aria-hidden="true"
		></div>
	{/if}

	<!-- Sidebar -->
	{#if sidebar}
		<aside
			class={twMerge(
				'fixed inset-y-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300',
				sidebarPosition === 'left' ? 'left-0' : 'right-0',
				// Desktop
				'hidden lg:flex',
				sidebarWidth,
				// Mobile
				mobileSidebarOpen ? 'flex' : 'hidden',
				mobileSidebarOpen && sidebarMobileWidth
			)}
			aria-label="Sidebar"
		>
			{@render sidebar()}
		</aside>
	{/if}

	<div
		class={twMerge(
			'flex flex-col flex-1',
			sidebar && sidebarPosition === 'left' && `lg:ml-${sidebarCollapsed ? '16' : '64'}`,
			sidebar && sidebarPosition === 'right' && `lg:mr-${sidebarCollapsed ? '16' : '64'}`
		)}
	>
		<!-- Header -->
		{#if header}
			<header
				class={twMerge(
					'sticky top-0 z-30 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border',
					headerHeights[headerHeight],
					'px-4 lg:px-6'
				)}
			>
				{@render header()}
			</header>
		{/if}

		<!-- Main Content -->
		<main class="flex-1 flex flex-col">
			{#if withScrollArea}
				<div class="flex-1 overflow-auto">
					<div class="container mx-auto p-4 lg:p-6">
						{@render children()}
					</div>
				</div>
			{:else}
				{@render children()}
			{/if}
		</main>

		<!-- Footer -->
		{#if footer}
			<footer
				class={twMerge(
					'flex items-center justify-between bg-card border-t border-border',
					footerHeights[footerHeight],
					'px-4 lg:px-6'
				)}
			>
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>

<style>
	/* Smooth transitions for layout changes */
	aside {
		transition: width 0.3s ease-in-out, margin 0.3s ease-in-out;
	}

	/* Ensure proper stacking context */
	.z-30 {
		z-index: 30;
	}

	.z-40 {
		z-index: 40;
	}

	.z-50 {
		z-index: 50;
	}

	/* Backdrop blur fallback */
	@supports not (backdrop-filter: blur(8px)) {
		header {
			background-color: var(--color-background);
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		aside,
		* {
			transition-duration: 0.01ms !important;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		aside,
		header,
		footer {
			border-width: 2px;
		}
	}

	/* Mobile-first responsive utilities */
	@media (max-width: 1024px) {
		.lg\:ml-16 {
			margin-left: 0;
		}
		.lg\:ml-64 {
			margin-left: 0;
		}
		.lg\:mr-16 {
			margin-right: 0;
		}
		.lg\:mr-64 {
			margin-right: 0;
		}
	}
</style>
