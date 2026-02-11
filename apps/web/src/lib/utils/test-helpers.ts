/**
 * Test utilities and helper functions for GradeLoop component library
 * Provides common testing patterns, mock data, and utility functions
 */

export interface MockUser {
	id: string;
	name: string;
	email: string;
	role: 'student' | 'instructor' | 'admin';
	avatar?: string;
}

export interface MockNotification {
	id: string;
	title: string;
	message: string;
	type: 'info' | 'success' | 'warning' | 'error' | 'ai';
	timestamp: Date;
	read: boolean;
	href?: string;
}

export interface MockAISuggestion {
	id: string;
	type: 'code' | 'text' | 'explanation' | 'improvement' | 'hint';
	title: string;
	content: string;
	confidence: number;
	reasoning?: string;
	metadata?: Record<string, any>;
}

export interface MockNavItem {
	id: string;
	label: string;
	href?: string;
	icon?: any;
	badge?: string | number;
	active?: boolean;
	disabled?: boolean;
	children?: MockNavItem[];
	roles?: string[];
}

/**
 * Generate mock user data for testing
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
	return {
		id: 'user-' + Math.random().toString(36).substr(2, 9),
		name: 'Test User',
		email: 'test@gradeloop.com',
		role: 'instructor',
		avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
		...overrides
	};
}

/**
 * Generate mock notification data for testing
 */
export function createMockNotifications(count: number = 5): MockNotification[] {
	const types: MockNotification['type'][] = ['info', 'success', 'warning', 'error', 'ai'];
	const titles = [
		'Assignment Graded',
		'New Submission',
		'Grade Updated',
		'Due Date Reminder',
		'AI Analysis Complete',
		'Course Update',
		'System Maintenance',
		'New Message'
	];
	const messages = [
		'Your JavaScript assignment has been graded',
		'New student submission received',
		'Grade has been updated to reflect recent changes',
		'Assignment due in 2 hours',
		'AI has completed analysis of your code',
		'New course materials are available',
		'System will be down for maintenance',
		'You have a new message from your instructor'
	];

	return Array.from({ length: count }, (_, i) => ({
		id: `notification-${i}`,
		title: titles[Math.floor(Math.random() * titles.length)],
		message: messages[Math.floor(Math.random() * messages.length)],
		type: types[Math.floor(Math.random() * types.length)],
		timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7), // Random time in last week
		read: Math.random() > 0.6,
		href: Math.random() > 0.5 ? `/assignment/${i}` : undefined
	}));
}

/**
 * Generate mock AI suggestions for testing
 */
export function createMockAISuggestions(count: number = 3): MockAISuggestion[] {
	const suggestions = [
		{
			type: 'code' as const,
			title: 'Algorithm Optimization',
			content: `// Optimized function with memoization
const fibonacci = (function() {
  const cache = {};
  return function fib(n) {
    if (n in cache) return cache[n];
    if (n <= 1) return n;
    cache[n] = fib(n-1) + fib(n-2);
    return cache[n];
  };
})();`,
			confidence: 0.92,
			reasoning: 'This memoized version reduces time complexity from O(2^n) to O(n) by caching previously calculated values.'
		},
		{
			type: 'improvement' as const,
			title: 'Error Handling Enhancement',
			content: 'Add comprehensive error handling with try-catch blocks and meaningful error messages to improve user experience.',
			confidence: 0.88,
			reasoning: 'Your current code lacks proper error handling which could lead to unexpected crashes and poor user experience.'
		},
		{
			type: 'explanation' as const,
			title: 'Design Pattern Explanation',
			content: 'The Observer pattern allows objects to notify multiple subscribers about state changes without creating tight coupling.',
			confidence: 0.95,
			reasoning: 'This explanation covers the fundamental concept that applies to your event-driven architecture implementation.'
		},
		{
			type: 'hint' as const,
			title: 'Performance Tip',
			content: 'Consider using debouncing for search input to reduce API calls and improve performance.',
			confidence: 0.79,
			reasoning: 'Your search implementation triggers on every keystroke which could overwhelm the server with requests.'
		},
		{
			type: 'text' as const,
			title: 'Documentation Improvement',
			content: 'Add JSDoc comments to your functions to improve code documentation and developer experience.',
			confidence: 0.85,
			reasoning: 'Well-documented code is easier to maintain and helps other developers understand your implementation.'
		}
	];

	return Array.from({ length: Math.min(count, suggestions.length) }, (_, i) => ({
		id: `suggestion-${i}`,
		...suggestions[i % suggestions.length]
	}));
}

/**
 * Generate mock navigation items for testing
 */
export function createMockNavItems(): MockNavItem[] {
	return [
		{
			id: 'dashboard',
			label: 'Dashboard',
			href: '/dashboard',
			active: true,
			roles: ['student', 'instructor', 'admin']
		},
		{
			id: 'assignments',
			label: 'Assignments',
			href: '/assignments',
			badge: '3',
			roles: ['student', 'instructor'],
			children: [
				{
					id: 'active-assignments',
					label: 'Active Assignments',
					href: '/assignments/active',
					roles: ['student', 'instructor']
				},
				{
					id: 'completed-assignments',
					label: 'Completed',
					href: '/assignments/completed',
					roles: ['student', 'instructor']
				},
				{
					id: 'grading-queue',
					label: 'Needs Grading',
					href: '/assignments/grading',
					badge: '5',
					roles: ['instructor']
				}
			]
		},
		{
			id: 'students',
			label: 'Students',
			href: '/students',
			roles: ['instructor', 'admin']
		},
		{
			id: 'analytics',
			label: 'Analytics',
			href: '/analytics',
			roles: ['instructor', 'admin']
		},
		{
			id: 'settings',
			label: 'Settings',
			href: '/settings',
			roles: ['student', 'instructor', 'admin']
		}
	];
}

/**
 * Simulate async operations for testing
 */
export function delay(ms: number = 1000): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock form data for testing
 */
export function createMockFormData() {
	return {
		title: 'JavaScript Fundamentals Assignment',
		description: 'Complete the JavaScript exercises focusing on variables, functions, and control structures.',
		dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // One week from now
		points: 100,
		category: 'Programming',
		difficulty: 'Intermediate',
		allowLateSubmission: true,
		enableAIGrading: true,
		rubric: [
			{ criteria: 'Code Quality', points: 30 },
			{ criteria: 'Functionality', points: 40 },
			{ criteria: 'Documentation', points: 20 },
			{ criteria: 'Best Practices', points: 10 }
		]
	};
}

/**
 * Generate random loading states for testing
 */
export function createLoadingStates() {
	return {
		button: false,
		form: false,
		aiSuggestions: false,
		data: false
	};
}

/**
 * Mock API responses for testing
 */
export const mockApiResponses = {
	success: {
		status: 200,
		data: { message: 'Operation completed successfully' }
	},
	error: {
		status: 400,
		error: 'Bad Request',
		message: 'Invalid input data'
	},
	loading: {
		status: 'pending'
	}
};

/**
 * Test data generators for different scenarios
 */
export const testScenarios = {
	// Empty state scenarios
	empty: {
		users: [],
		notifications: [],
		suggestions: [],
		assignments: []
	},

	// Error state scenarios
	error: {
		networkError: new Error('Network connection failed'),
		validationError: new Error('Validation failed'),
		permissionError: new Error('Insufficient permissions')
	},

	// Loading state scenarios
	loading: {
		slow: 3000, // 3 seconds
		fast: 500,  // 0.5 seconds
		timeout: 10000 // 10 seconds
	}
};

/**
 * Accessibility testing helpers
 */
export const accessibilityHelpers = {
	/**
	 * Check if element has proper ARIA attributes
	 */
	hasAriaLabel: (element: HTMLElement): boolean => {
		return element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby');
	},

	/**
	 * Check if element is keyboard accessible
	 */
	isKeyboardAccessible: (element: HTMLElement): boolean => {
		const tabIndex = element.getAttribute('tabindex');
		return element.tagName.toLowerCase() === 'button' ||
			   element.tagName.toLowerCase() === 'a' ||
			   element.tagName.toLowerCase() === 'input' ||
			   element.tagName.toLowerCase() === 'textarea' ||
			   element.tagName.toLowerCase() === 'select' ||
			   (tabIndex !== null && parseInt(tabIndex) >= 0);
	},

	/**
	 * Check if element has proper contrast
	 */
	hasProperContrast: (element: HTMLElement): boolean => {
		// This would need actual color analysis in a real implementation
		// For testing purposes, we'll assume proper contrast if element has text
		return element.textContent?.trim().length > 0;
	}
};

/**
 * Performance testing helpers
 */
export const performanceHelpers = {
	/**
	 * Measure component render time
	 */
	measureRenderTime: async (renderFn: () => Promise<void>): Promise<number> => {
		const start = performance.now();
		await renderFn();
		const end = performance.now();
		return end - start;
	},

	/**
	 * Check if component is within performance budget
	 */
	isWithinBudget: (duration: number, budgetMs: number = 16): boolean => {
		return duration <= budgetMs; // 16ms for 60fps
	}
};

/**
 * Theme testing helpers
 */
export const themeHelpers = {
	/**
	 * Get current theme from document
	 */
	getCurrentTheme: (): 'light' | 'dark' => {
		return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	},

	/**
	 * Toggle theme for testing
	 */
	toggleTheme: (): void => {
		const isDark = document.documentElement.classList.contains('dark');
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(isDark ? 'light' : 'dark');
	},

	/**
	 * Apply specific theme for testing
	 */
	applyTheme: (theme: 'light' | 'dark'): void => {
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(theme);
	}
};

/**
 * Event simulation helpers
 */
export const eventHelpers = {
	/**
	 * Simulate keyboard event
	 */
	simulateKeyboard: (element: HTMLElement, key: string): void => {
		const event = new KeyboardEvent('keydown', { key });
		element.dispatchEvent(event);
	},

	/**
	 * Simulate mouse click
	 */
	simulateClick: (element: HTMLElement): void => {
		const event = new MouseEvent('click', { bubbles: true });
		element.dispatchEvent(event);
	},

	/**
	 * Simulate form submission
	 */
	simulateSubmit: (form: HTMLFormElement): void => {
		const event = new Event('submit', { bubbles: true });
		form.dispatchEvent(event);
	}
};

/**
 * Validation helpers for testing
 */
export const validationHelpers = {
	/**
	 * Validate email format
	 */
	isValidEmail: (email: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	},

	/**
	 * Validate password strength
	 */
	isStrongPassword: (password: string): boolean => {
		return password.length >= 8 &&
			   /[A-Z]/.test(password) &&
			   /[a-z]/.test(password) &&
			   /[0-9]/.test(password);
	},

	/**
	 * Validate required fields
	 */
	hasRequiredFields: (data: Record<string, any>, requiredFields: string[]): boolean => {
		return requiredFields.every(field => data[field] != null && data[field] !== '');
	}
};

/**
 * Component state helpers
 */
export const stateHelpers = {
	/**
	 * Create reactive state for testing
	 */
	createReactiveState: <T>(initialValue: T) => {
		let value = initialValue;
		const subscribers = new Set<(value: T) => void>();

		return {
			get: () => value,
			set: (newValue: T) => {
				value = newValue;
				subscribers.forEach(callback => callback(value));
			},
			subscribe: (callback: (value: T) => void) => {
				subscribers.add(callback);
				return () => subscribers.delete(callback);
			}
		};
	}
};

/**
 * Export all helpers as a single object for convenience
 */
export const testUtils = {
	createMockUser,
	createMockNotifications,
	createMockAISuggestions,
	createMockNavItems,
	createMockFormData,
	createLoadingStates,
	delay,
	mockApiResponses,
	testScenarios,
	accessibilityHelpers,
	performanceHelpers,
	themeHelpers,
	eventHelpers,
	validationHelpers,
	stateHelpers
};

export default testUtils;
