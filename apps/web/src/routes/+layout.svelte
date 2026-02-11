<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import { ThemeProvider } from '$lib/components';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>GradeLoop - AI-Powered Learning Management System</title>
	<meta name="description" content="Advanced LMS with AI-powered grading, feedback, and educational insights" />
</svelte:head>

<ThemeProvider>
	{@render children()}
</ThemeProvider>

<!-- Locale Links (Hidden) -->
<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>
			{locale}
		</a>
	{/each}
</div>
