<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';
	import { Search, Bell, Menu, X } from 'lucide-svelte';

	interface NotificationItem {
		id: string;
		title: string;
		message: string;
		type: 'info' | 'success' | 'warning' | 'error' | 'ai';
		timestamp: Date;
		read: boolean;
		href?: string;
	}

	interface UserMenuItem {
		id: string;
		label: string;
		href?: string;
		icon?: any;
		divider?: boolean;
		onclick?: () => void;
	}

	interface User {
		name: string;
		email?: string;
		avatar?: string;
		role?: string;
	}

	interface Props {
		user?: User;
		notifications?: NotificationItem[];
		userMenuItems?: UserMenuItem[];
		searchPlaceholder?: string;
		searchValue?: string;
		showSearch?: boolean;
		showNotifications?: boolean;
		showUserMenu?: boolean;
		showMobileMenuToggle?: boolean;
		mobileSidebarOpen?: boolean;
		leftContent?: Snippet;
		centerContent?: Snippet;
		rightContent?: Snippet;
		class?: string;
		onSearch?: (query: string) => void;
		onNotificationClick?: (notification: NotificationItem) => void;
		onUserMenuClick?: (item: UserMenuItem) => void;
		onMobileMenuToggle?: () => void;
	}

	let {
		user,
		notifications = [],
		userMenuItems = [],
		searchPlaceholder = 'Search...',
		searchValue = $bindable(''),
		showSearch = true,
		showNotifications = true,
		showUserMenu = true,
		showMobileMenuToggle = true,
		mobileSidebarOpen = false,
		leftContent,
		centerContent,
		rightContent,
		class: className = '',
		onSearch,
		onNotificationClick,
		onUserMenuClick,
		onMobileMenuToggle
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		search: string;
		notificationClick: NotificationItem;
		userMenuClick: UserMenuItem;
		mobileMenuToggle: void;
	}>();

	let searchInputElement: HTMLInputElement;
	let notificationsOpen = $state(false);
	let userMenuOpen = $state(false);

	// Computed values
	$: unreadNotificationCount = notifications.filter(n => !n.read).length;
	$: recentNotifications = notifications.slice(0, 5);

	function handleSearch() {
		dispatch('search', searchValue);
		onSearch?.(searchValue);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		} else if (event.key === 'Escape') {
			searchValue = '';
			searchInputElement.blur();
		}
	}

	function handleNotificationClick(notification: NotificationItem) {
		dispatch('notificationClick', notification);
		onNotificationClick?.(notification);
		notificationsOpen = false;
	}

	function handleUserMenuClick(item: UserMenuItem) {
		if (item.onclick) {
			item.onclick();
		} else {
			dispatch('userMenuClick', item);
			onUserMenuClick?.(item);
		}
		userMenuOpen = false;
	}

	function handleMobileMenuToggle() {
		dispatch('mobileMenuToggle');
		onMobileMenuToggle?.();
	}

	function toggleNotifications() {
		notificationsOpen = !notificationsOpen;
		userMenuOpen = false;
	}

	function toggleUserMenu() {
		userMenuOpen = !userMenuOpen;
		notificationsOpen = false;
	}

	function closeDropdowns() {
		notificationsOpen = false;
		userMenuOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeDropdowns();
		}
	}

	function getNotificationIcon(type: NotificationItem['type']) {
		switch (type) {
			case 'success':
				return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'warning':
				return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.73 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z';
			case 'error':
				return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'ai':
				return 'M13 10V3L4 14h7v7l9-11h-7z';
			default:
				return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}

	function getNotificationColor(type: NotificationItem['type']) {
		switch (type) {
			case 'success':
				return 'text-success';
			case 'warning':
				return 'text-warning';
			case 'error':
				return 'text-error';
			case 'ai':
				return 'text-ai-highlight';
			default:
				return 'text-info';
		}
	}

	function formatTimestamp(date: Date) {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	}

	function getUserInitials(name: string) {
		return name
			.split(' ')
			.map(part => part.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={twMerge('flex items-center justify-between w-full', className)}>
	<!-- Left Section -->
	<div class="flex items-center gap-4">
		{#if showMobileMenuToggle}
			<button
				type="button"
				class="lg:hidden p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
				onclick={handleMobileMenuToggle}
				aria-label={mobileSidebarOpen ? 'Close mobile menu' : 'Open mobile menu'}
			>
				{#if mobileSidebarOpen}
					<X size={20} />
				{:else}
					<Menu size={20} />
				{/if}
			</button>
		{/if}

		{#if leftContent}
			{@render leftContent()}
		{/if}

		{#if showSearch}
			<div class="hidden sm:block relative max-w-sm w-full">
				<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<Search size={16} class="text-muted-foreground" />
				</div>
				<input
					bind:this={searchInputElement}
					type="search"
					bind:value={searchValue}
					placeholder={searchPlaceholder}
					class="block w-full pl-10 pr-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:border-ring transition-colors"
					onkeydown={handleSearchKeydown}
					aria-label="Search"
				/>
			</div>
		{/if}
	</div>

	<!-- Center Section -->
	{#if centerContent}
		<div class="flex-1 flex justify-center mx-4">
			{@render centerContent()}
		</div>
	{/if}

	<!-- Right Section -->
	<div class="flex items-center gap-2">
		{#if rightContent}
			{@render rightContent()}
		{/if}

		<!-- Mobile Search -->
		{#if showSearch}
			<button
				type="button"
				class="sm:hidden p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
				onclick={() => searchInputElement?.focus()}
				aria-label="Search"
			>
				<Search size={20} />
			</button>
		{/if}

		<!-- Notifications -->
		{#if showNotifications}
			<div class="relative">
				<button
					type="button"
					class="relative p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
					onclick={toggleNotifications}
					aria-label="Notifications"
					aria-expanded={notificationsOpen}
					aria-haspopup="true"
				>
					<Bell size={20} />
					{#if unreadNotificationCount > 0}
						<span class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-error text-white text-xs font-bold flex items-center justify-center">
							{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
						</span>
					{/if}
				</button>

				{#if notificationsOpen}
					<!-- Backdrop -->
					<div
						class="fixed inset-0 z-40"
						onclick={closeDropdowns}
						aria-hidden="true"
					></div>

					<!-- Notifications Dropdown -->
					<div
						class="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-md shadow-lg z-50 max-h-96 overflow-hidden"
						role="menu"
						aria-orientation="vertical"
					>
						<div class="p-4 border-b border-border">
							<h3 class="font-semibold text-sm">Notifications</h3>
							{#if unreadNotificationCount > 0}
								<p class="text-xs text-muted-foreground mt-1">
									{unreadNotificationCount} unread
								</p>
							{/if}
						</div>

						<div class="overflow-y-auto max-h-80">
							{#if recentNotifications.length === 0}
								<div class="p-4 text-center text-muted-foreground text-sm">
									No notifications
								</div>
							{:else}
								{#each recentNotifications as notification (notification.id)}
									<button
										type="button"
										class="w-full text-left p-4 hover:bg-accent transition-colors border-b border-border last:border-b-0 {!notification.read ? 'bg-accent/50' : ''}"
										onclick={() => handleNotificationClick(notification)}
										role="menuitem"
									>
										<div class="flex items-start gap-3">
											<div class="flex-shrink-0 mt-1">
												<svg
													class="w-4 h-4 {getNotificationColor(notification.type)}"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d={getNotificationIcon(notification.type)}
													/>
												</svg>
											</div>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">
													{notification.title}
												</p>
												<p class="text-sm text-muted-foreground mt-1 line-clamp-2">
													{notification.message}
												</p>
												<p class="text-xs text-muted-foreground mt-2">
													{formatTimestamp(notification.timestamp)}
												</p>
											</div>
											{#if !notification.read}
												<div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
											{/if}
										</div>
									</button>
								{/each}
							{/if}
						</div>

						{#if notifications.length > 5}
							<div class="p-4 border-t border-border">
								<button
									type="button"
									class="w-full text-center text-sm text-primary hover:text-primary-hover font-medium"
								>
									View all notifications
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- User Menu -->
		{#if showUserMenu && user}
			<div class="relative">
				<button
					type="button"
					class="flex items-center gap-2 p-1 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
					onclick={toggleUserMenu}
					aria-label="User menu"
					aria-expanded={userMenuOpen}
					aria-haspopup="true"
				>
					{#if user.avatar}
						<img
							src={user.avatar}
							alt={user.name}
							class="w-8 h-8 rounded-full object-cover"
						/>
					{:else}
						<div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
							{getUserInitials(user.name)}
						</div>
					{/if}
					<div class="hidden sm:block text-left">
						<p class="text-sm font-medium">{user.name}</p>
						{#if user.role}
							<p class="text-xs text-muted-foreground capitalize">{user.role}</p>
						{/if}
					</div>
				</button>

				{#if userMenuOpen}
					<!-- Backdrop -->
					<div
						class="fixed inset-0 z-40"
						onclick={closeDropdowns}
						aria-hidden="true"
					></div>

					<!-- User Menu Dropdown -->
					<div
						class="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-md shadow-lg z-50"
						role="menu"
						aria-orientation="vertical"
					>
						{#if user.email}
							<div class="p-3 border-b border-border">
								<p class="text-sm font-medium">{user.name}</p>
								<p class="text-xs text-muted-foreground">{user.email}</p>
							</div>
						{/if}

						<div class="py-1">
							{#each userMenuItems as item (item.id)}
								{#if item.divider}
									<div class="border-t border-border my-1"></div>
								{:else}
									<button
										type="button"
										class="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
										onclick={() => handleUserMenuClick(item)}
										role="menuitem"
									>
										{#if item.icon}
											<svelte:component this={item.icon} size={16} />
										{/if}
										{item.label}
									</button>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	/* Line clamp utility */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Enhanced focus states for accessibility */
	button:focus-visible {
		outline: none;
	}

	/* Smooth transitions */
	.transition-colors {
		transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out;
	}

	/* Search input styling */
	input[type="search"]::-webkit-search-decoration,
	input[type="search"]::-webkit-search-cancel-button,
	input[type="search"]::-webkit-search-results-button,
	input[type="search"]::-webkit-search-results-decoration {
		-webkit-appearance: none;
	}

	/* Scrollbar styling for notifications */
	.overflow-y-auto::-webkit-scrollbar {
		width: 4px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: var(--color-border-default);
		border-radius: 2px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-muted);
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
</style>
