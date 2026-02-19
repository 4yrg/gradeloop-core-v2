<script lang="ts">
	import { ErrorBoundary } from '$lib/components';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Gradeloop Core</title>
</svelte:head>

<ErrorBoundary>
	<main class="flex min-h-screen flex-col items-center justify-center p-8">
		<div class="w-full max-w-2xl space-y-8 text-center">
			<div>
				<h1 class="text-4xl font-bold text-foreground">Gradeloop Core v2</h1>
				<p class="mt-4 text-lg text-muted-foreground">
					AI-integrated Learning Management System
				</p>
			</div>

			<div class="rounded-lg border bg-card p-6 shadow-sm">
				<h2 class="mb-4 text-xl font-semibold text-card-foreground">System Status</h2>

				<div class="space-y-3 text-left">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">API Client</span>
						<span class="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
							Initialized
						</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Authentication</span>
						{#if data.auth.isLoading}
							<span class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
								Loading...
							</span>
						{:else if data.auth.isAuthenticated}
							<span class="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
								Authenticated
							</span>
						{:else}
							<span class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
								Guest
							</span>
						{/if}
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Environment</span>
						<span class="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
							{import.meta.env.PUBLIC_APP_ENV || 'development'}
						</span>
					</div>
				</div>
			</div>

			<div class="text-sm text-muted-foreground">
				<p>Frontend is ready. Authentication UI coming soon.</p>
			</div>
		</div>
	</main>
</ErrorBoundary>
