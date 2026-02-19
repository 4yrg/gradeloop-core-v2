declare module 'tailwind-variants' {
	import type { ClassValue } from 'clsx';

	interface TVConfig {
		base?: ClassValue;
		variants?: {
			[key: string]: {
				[key: string]: ClassValue;
			};
		};
		defaultVariants?: {
			[key: string]: string;
		};
		compoundVariants?: Array<{
			[key: string]: string;
			class: ClassValue;
		}>;
	}

	interface TVReturn {
		(config?: Record<string, string>): string;
	}

	export function tv(config: TVConfig): TVReturn;

	export type VariantProps<T extends TVReturn> = {
		[K in keyof T]?: string;
	};

	export type { ClassValue };
}
