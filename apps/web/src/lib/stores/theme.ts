import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
	theme: Theme;
	resolvedTheme: 'light' | 'dark';
}

function createThemeStore() {
	// Get initial theme from localStorage or default to 'system'
	const getInitialTheme = (): Theme => {
		if (!browser) return 'system';

		const stored = localStorage.getItem('gradeloop-theme') as Theme;
		if (stored && ['light', 'dark', 'system'].includes(stored)) {
			return stored;
		}

		return 'system';
	};

	// Get system preference
	const getSystemTheme = (): 'light' | 'dark' => {
		if (!browser) return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	};

	const { subscribe, set, update } = writable<ThemeState>({
		theme: getInitialTheme(),
		resolvedTheme: getInitialTheme() === 'system' ? getSystemTheme() : (getInitialTheme() as 'light' | 'dark')
	});

	// Listen for system theme changes
	if (browser) {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			update(state => ({
				...state,
				resolvedTheme: state.theme === 'system' ? getSystemTheme() : state.resolvedTheme
			}));
		});
	}

	return {
		subscribe,
		setTheme: (theme: Theme) => {
			if (browser) {
				localStorage.setItem('gradeloop-theme', theme);
			}

			const resolvedTheme = theme === 'system' ? getSystemTheme() : theme as 'light' | 'dark';

			set({
				theme,
				resolvedTheme
			});

			// Apply theme to document
			if (browser) {
				document.documentElement.classList.remove('light', 'dark');
				document.documentElement.classList.add(resolvedTheme);
			}
		},
		toggleTheme: () => {
			update(state => {
				const newTheme = state.resolvedTheme === 'light' ? 'dark' : 'light';

				if (browser) {
					localStorage.setItem('gradeloop-theme', newTheme);
					document.documentElement.classList.remove('light', 'dark');
					document.documentElement.classList.add(newTheme);
				}

				return {
					theme: newTheme,
					resolvedTheme: newTheme
				};
			});
		}
	};
}

export const themeStore = createThemeStore();

// Derived store for easy access to current resolved theme
export const resolvedTheme = derived(themeStore, $themeStore => $themeStore.resolvedTheme);

// Derived store to check if dark mode is active
export const isDark = derived(resolvedTheme, $resolvedTheme => $resolvedTheme === 'dark');

// Helper function to initialize theme on page load
export function initializeTheme() {
	if (!browser) return;

	const stored = localStorage.getItem('gradeloop-theme') as Theme;
	const theme = stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';

	const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	const resolvedTheme = theme === 'system' ? systemTheme : theme as 'light' | 'dark';

	document.documentElement.classList.remove('light', 'dark');
	document.documentElement.classList.add(resolvedTheme);

	// Set the store without triggering side effects
	themeStore.setTheme(theme);
}
