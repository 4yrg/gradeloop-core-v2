<script lang="ts">
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { Sun, Moon, Monitor } from 'lucide-svelte';

	interface Props {
		size?: 'sm' | 'md' | 'lg';
		variant?: 'button' | 'dropdown';
		showLabel?: boolean;
		class?: string;
	}

	let {
		size = 'md',
		variant = 'button',
		showLabel = false,
		class: className = ''
	}: Props = $props();

	const $themeStore = $state(themeStore);

	const themes: { value: Theme; label: string; icon: any }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	const sizeClasses = {
		sm: 'h-8 w-8 text-sm',
		md: 'h-10 w-10 text-base',
		lg: 'h-12 w-12 text-lg'
	};

	const iconSizes = {
		sm: 16,
		md: 20,
		lg: 24
	};

	function handleThemeChange(theme: Theme) {
		themeStore.setTheme(theme);
	}

	function getThemeIcon(theme: Theme) {
		return themes.find(t => t.value === theme)?.icon || Sun;
	}

	function getThemeLabel(theme: Theme) {
		return themes.find(t => t.value === theme)?.label || 'Light';
	}

	let dropdownOpen = $state(false);

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	function closeDropdown() {
		dropdownOpen = false;
	}
</script>

{#if variant === 'button'}
	<button
		type="button"
		class="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors {sizeClasses[size]} {className}"
		onclick={() => themeStore.toggleTheme()}
		aria-label="Toggle theme"
		title="Toggle theme (currently {getThemeLabel($themeStore.resolvedTheme)})"
	>
		{#if $themeStore.resolvedTheme === 'dark'}
			<Sun size={iconSizes[size]} />
		{:else}
			<Moon size={iconSizes[size]} />
		{/if}
		{#if showLabel}
			<span class="ml-2">
				{$themeStore.resolvedTheme === 'dark' ? 'Light' : 'Dark'}
			</span>
		{/if}
	</button>
{:else if variant === 'dropdown'}
	<div class="relative">
		<button
			type="button"
			class="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-colors {sizeClasses[size]} {className}"
			onclick={toggleDropdown}
			aria-label="Select theme"
			aria-expanded={dropdownOpen}
			aria-haspopup="true"
		>
			{@const CurrentIcon = getThemeIcon($themeStore.theme)}
			<CurrentIcon size={iconSizes[size]} />
			{#if showLabel}
				<span class="ml-2">{getThemeLabel($themeStore.theme)}</span>
			{/if}
		</button>

		{#if dropdownOpen}
			<!-- Backdrop -->
			<div
				class="fixed inset-0 z-40"
				onclick={closeDropdown}
				onkeydown={(e) => e.key === 'Escape' && closeDropdown()}
				role="button"
				tabindex="-1"
				aria-hidden="true"
			></div>

			<!-- Dropdown menu -->
			<div
				class="absolute right-0 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
				role="menu"
				aria-orientation="vertical"
				aria-labelledby="theme-menu"
			>
				{#each themes as theme}
					<button
						type="button"
						class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors"
						onclick={() => {
							handleThemeChange(theme.value);
							closeDropdown();
						}}
						role="menuitem"
						aria-current={$themeStore.theme === theme.value ? 'true' : 'false'}
					>
						<theme.icon size={16} class="mr-2" />
						<span>{theme.label}</span>
						{#if $themeStore.theme === theme.value}
							<span class="ml-auto">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-check"
								>
									<path d="M20 6 9 17l-5-5" />
								</svg>
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes zoomIn95 {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-in {
		animation: fadeIn 0.15s ease-out, zoomIn95 0.15s ease-out;
	}
</style>
