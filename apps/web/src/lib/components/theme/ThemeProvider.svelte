<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore, initializeTheme } from '$lib/stores/theme';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		// Initialize theme on component mount
		initializeTheme();

		// Subscribe to theme changes and apply to document
		const unsubscribe = themeStore.subscribe(({ resolvedTheme }) => {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('light', 'dark');
				document.documentElement.classList.add(resolvedTheme);

				// Set theme-color meta tag for mobile browsers
				const themeColorMeta = document.querySelector('meta[name="theme-color"]');
				if (themeColorMeta) {
					const color = resolvedTheme === 'dark' ? '#0b1120' : '#f8fafc';
					themeColorMeta.setAttribute('content', color);
				}
			}
		});

		return unsubscribe;
	});
</script>

<!-- Theme provider wrapper -->
<div class="theme-provider">
	{@render children()}
</div>

<style>
	.theme-provider {
		/* Ensure smooth theme transitions */
		transition:
			color 0.2s ease-in-out,
			background-color 0.2s ease-in-out,
			border-color 0.2s ease-in-out;
	}

	:global(.theme-provider *) {
		/* Apply smooth transitions to all child elements */
		transition:
			color 0.2s ease-in-out,
			background-color 0.2s ease-in-out,
			border-color 0.2s ease-in-out,
			box-shadow 0.2s ease-in-out;
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.theme-provider,
		:global(.theme-provider *) {
			transition: none !important;
		}
	}
</style>
