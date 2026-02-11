import type { Preview } from '@storybook/sveltekit';
import '../src/routes/layout.css';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'todo'
		},

		backgrounds: {
			disable: true
		},

		docs: {
			theme: {
				base: 'light',
				colorPrimary: '#4f46e5',
				colorSecondary: '#8b5cf6',
				appBg: '#f8fafc',
				appContentBg: '#ffffff',
				appBorderColor: '#e2e8f0',
				textColor: '#1e293b',
				textInverseColor: '#f1f5f9',
				barTextColor: '#64748b',
				barSelectedColor: '#4f46e5',
				barBg: '#ffffff',
				inputBg: '#ffffff',
				inputBorder: '#e2e8f0',
				inputTextColor: '#1e293b',
				inputBorderRadius: 6
			}
		}
	},

	globalTypes: {
		theme: {
			description: 'Global theme for components',
			defaultValue: 'light',
			toolbar: {
				title: 'Theme',
				icon: 'paintbrush',
				items: [
					{ value: 'light', icon: 'sun', title: 'Light' },
					{ value: 'dark', icon: 'moon', title: 'Dark' },
					{ value: 'system', icon: 'monitor', title: 'System' }
				],
				dynamicTitle: true
			}
		}
	},

	decorators: [
		(story, context) => {
			const theme = context.globals.theme || 'light';

			// Apply theme to document
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('light', 'dark');

				if (theme === 'system') {
					const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
						? 'dark'
						: 'light';
					document.documentElement.classList.add(systemTheme);
				} else {
					document.documentElement.classList.add(theme);
				}
			}

			return {
				Component: story
			};
		}
	]
};

export default preview;
