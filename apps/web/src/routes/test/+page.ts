import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	// Pre-load test data and configuration
	const testConfig = {
		title: 'GradeLoop Component Test Suite',
		description: 'Interactive testing environment for all GradeLoop components',
		version: '1.0.0',
		components: [
			'Button',
			'Input',
			'Textarea',
			'Checkbox',
			'AppShell',
			'Sidebar',
			'TopBar',
			'ThemeToggle',
			'AISuggestionPanel',
			'AIInlineHint',
			'AIStreamingText'
		],
		testCategories: [
			'Foundation Components',
			'Form Components',
			'Layout Components',
			'AI-Enhanced Components',
			'Theme System',
			'Accessibility Features'
		],
		features: {
			accessibility: true,
			theming: true,
			aiIntegration: true,
			responsiveDesign: true,
			keyboardNavigation: true,
			screenReaderSupport: true
		}
	};

	// Simulate loading time for demo purposes
	await new Promise(resolve => setTimeout(resolve, 100));

	return {
		testConfig,
		meta: {
			title: 'Component Test Suite - GradeLoop',
			description: 'Comprehensive test page for GradeLoop\'s AI-focused component library',
			keywords: 'gradeloop, components, testing, ai, lms, svelte, tailwind'
		}
	};
};

export const prerender = true;
