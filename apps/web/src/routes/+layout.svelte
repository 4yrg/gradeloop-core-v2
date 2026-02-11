<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const navItems = [
		{ label: 'Dashboard', href: '/' },
		{ label: 'Kanban', href: '/kanban' },
		{ label: 'Inbox', href: '/inbox' },
		{ label: 'Users', href: '/users' },
		{ label: 'Products', href: '/products' },
		{ label: 'Sign In', href: '/signin' },
		{ label: 'Sign Up', href: '/signup' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
	<aside class="w-64 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
		<div class="h-full overflow-y-auto px-3 py-4">
			<ul class="space-y-2 font-medium">
				{#each navItems as item}
					<li>
						<a
							href={item.href}
							class="group flex items-center rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
						>
							<span class="ms-3">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>
	<main class="flex-1 p-4">
		{@render children()}
	</main>
</div>
