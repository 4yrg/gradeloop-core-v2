import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * ShadCN's core utility function for merging Tailwind CSS classes
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(
	bytes: number,
	opts: {
		decimals?: number;
		sizeType?: 'accurate' | 'normal';
	} = {}
) {
	const { decimals = 0, sizeType = 'normal' } = opts;

	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];

	if (bytes === 0) return '0 Byte';

	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
		sizeType === 'accurate' ? (accurateSizes[i] ?? 'Bytest') : (sizes[i] ?? 'Bytes')
	}`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number) {
	return str.length > length ? `${str.substring(0, length)}...` : str;
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatDate(
	date: Date | string | number,
	opts: Intl.RelativeTimeFormatOptions = {}
) {
	const d = new Date(date);
	const now = new Date();
	const diff = now.getTime() - d.getTime();

	const minute = 60 * 1000;
	const hour = minute * 60;
	const day = hour * 24;
	const week = day * 7;
	const month = day * 30;
	const year = day * 365;

	const rtf = new Intl.RelativeTimeFormat('en', opts);

	if (diff < minute) {
		return rtf.format(-Math.floor(diff / 1000), 'second');
	} else if (diff < hour) {
		return rtf.format(-Math.floor(diff / minute), 'minute');
	} else if (diff < day) {
		return rtf.format(-Math.floor(diff / hour), 'hour');
	} else if (diff < week) {
		return rtf.format(-Math.floor(diff / day), 'day');
	} else if (diff < month) {
		return rtf.format(-Math.floor(diff / week), 'week');
	} else if (diff < year) {
		return rtf.format(-Math.floor(diff / month), 'month');
	} else {
		return rtf.format(-Math.floor(diff / year), 'year');
	}
}

/**
 * Format date to absolute time
 */
export function formatAbsoluteDate(date: Date | string | number) {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
}

/**
 * Generate initials from name
 */
export function getInitials(name: string) {
	return name
		.split(' ')
		.map((word) => word[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to slug
 */
export function slugify(str: string) {
	return str
		.toLowerCase()
		.replace(/[^\w\s-]/g, '') // Remove special characters
		.replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate random string
 */
export function randomString(length: number = 10) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
	if (value == null) return true;
	if (typeof value === 'string') return value.trim() === '';
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'object') return Object.keys(value).length === 0;
	return false;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== 'object') return obj;
	if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
	if (obj instanceof Array) return obj.map((item) => deepClone(item)) as unknown as T;
	if (typeof obj === 'object') {
		const cloned = {} as T;
		Object.keys(obj).forEach((key) => {
			(cloned as any)[key] = deepClone((obj as any)[key]);
		});
		return cloned;
	}
	return obj;
}

/**
 * Format grade percentage with styling class
 */
export function formatGrade(grade: number): { formatted: string; className: string } {
	const percentage = Math.round(grade);
	let className = '';

	if (percentage >= 90) className = 'grade-a';
	else if (percentage >= 80) className = 'grade-b';
	else if (percentage >= 70) className = 'grade-c';
	else if (percentage >= 60) className = 'grade-d';
	else className = 'grade-f';

	return {
		formatted: `${percentage}%`,
		className
	};
}

/**
 * Calculate similarity score between two strings (for plagiarism detection UI)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) return 1.0;

	const levenshteinDistance = (s1: string, s2: string): number => {
		const costs = [];
		for (let i = 0; i <= s2.length; i++) {
			let lastValue = i;
			for (let j = 0; j <= s1.length; j++) {
				if (i === 0) {
					costs[j] = j;
				} else if (j > 0) {
					let newValue = costs[j - 1];
					if (s1.charAt(j - 1) !== s2.charAt(i - 1)) {
						newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
					}
					costs[j - 1] = lastValue;
					lastValue = newValue;
				}
			}
			if (i > 0) costs[s1.length] = lastValue;
		}
		return costs[s1.length];
	};

	return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

/**
 * Theme-related utilities
 */
export const themeUtils = {
	/**
	 * Get appropriate text color for background
	 */
	getContrastText(backgroundColor: string): 'light' | 'dark' {
		// Simple heuristic - in production you might want a more sophisticated algorithm
		const hex = backgroundColor.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;
		return brightness > 128 ? 'dark' : 'light';
	},

	/**
	 * Convert hex to HSL
	 */
	hexToHsl(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h: number, s: number;
		const l = (max + min) / 2;

		if (max === min) {
			h = s = 0;
		} else {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r:
					h = (g - b) / d + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / d + 2;
					break;
				case b:
					h = (r - g) / d + 4;
					break;
				default:
					h = 0;
			}
			h /= 6;
		}

		return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
	}
};

/**
 * Validation utilities
 */
export const validation = {
	isEmail: (email: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	},

	isStrongPassword: (password: string): boolean => {
		// At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
		const strongPasswordRegex =
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
		return strongPasswordRegex.test(password);
	},

	isUrl: (url: string): boolean => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}
};

/**
 * Local storage utilities with error handling
 */
export const storage = {
	get: <T>(key: string, defaultValue?: T): T | undefined => {
		try {
			const item = window.localStorage.getItem(key);
			return item ? JSON.parse(item) : defaultValue;
		} catch {
			return defaultValue;
		}
	},

	set: (key: string, value: any): boolean => {
		try {
			window.localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch {
			return false;
		}
	},

	remove: (key: string): boolean => {
		try {
			window.localStorage.removeItem(key);
			return true;
		} catch {
			return false;
		}
	},

	clear: (): boolean => {
		try {
			window.localStorage.clear();
			return true;
		} catch {
			return false;
		}
	}
};
