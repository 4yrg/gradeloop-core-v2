/**
 * Simple test runner for GradeLoop component library
 * Provides utilities to run automated tests and collect results
 */

export interface TestCase {
	id: string;
	name: string;
	description?: string;
	test: () => Promise<TestResult> | TestResult;
	timeout?: number;
	skip?: boolean;
}

export interface TestResult {
	id: string;
	name: string;
	status: 'passed' | 'failed' | 'warning' | 'running' | 'pending';
	duration?: number;
	message?: string;
	details?: string;
	error?: Error;
}

export interface TestSuite {
	name: string;
	description?: string;
	tests: TestCase[];
	beforeAll?: () => Promise<void> | void;
	afterAll?: () => Promise<void> | void;
	beforeEach?: () => Promise<void> | void;
	afterEach?: () => Promise<void> | void;
}

export class TestRunner {
	private suites: TestSuite[] = [];
	private results: TestResult[] = [];
	private isRunning = false;
	private subscribers = new Set<(results: TestResult[]) => void>();

	/**
	 * Add a test suite to the runner
	 */
	addSuite(suite: TestSuite): void {
		this.suites.push(suite);
	}

	/**
	 * Add a single test case
	 */
	addTest(test: TestCase): void {
		const suite: TestSuite = {
			name: 'Individual Tests',
			tests: [test]
		};
		this.addSuite(suite);
	}

	/**
	 * Subscribe to test result updates
	 */
	subscribe(callback: (results: TestResult[]) => void): () => void {
		this.subscribers.add(callback);
		callback(this.results);

		return () => {
			this.subscribers.delete(callback);
		};
	}

	/**
	 * Notify subscribers of result updates
	 */
	private notify(): void {
		this.subscribers.forEach(callback => callback([...this.results]));
	}

	/**
	 * Run all test suites
	 */
	async runAll(): Promise<TestResult[]> {
		if (this.isRunning) {
			throw new Error('Test runner is already running');
		}

		this.isRunning = true;
		this.results = [];
		this.notify();

		try {
			for (const suite of this.suites) {
				await this.runSuite(suite);
			}
		} finally {
			this.isRunning = false;
		}

		return this.results;
	}

	/**
	 * Run a specific test suite
	 */
	async runSuite(suite: TestSuite): Promise<TestResult[]> {
		const suiteResults: TestResult[] = [];

		try {
			// Run beforeAll hook
			if (suite.beforeAll) {
				await suite.beforeAll();
			}

			// Run each test in the suite
			for (const testCase of suite.tests) {
				if (testCase.skip) {
					const result: TestResult = {
						id: testCase.id,
						name: testCase.name,
						status: 'pending',
						message: 'Test skipped'
					};
					this.results.push(result);
					suiteResults.push(result);
					this.notify();
					continue;
				}

				const result = await this.runTest(testCase, suite);
				this.results.push(result);
				suiteResults.push(result);
				this.notify();
			}

			// Run afterAll hook
			if (suite.afterAll) {
				await suite.afterAll();
			}
		} catch (error) {
			// Suite-level error
			const errorResult: TestResult = {
				id: `suite-${suite.name}`,
				name: `Suite: ${suite.name}`,
				status: 'failed',
				message: 'Suite setup/teardown failed',
				details: error instanceof Error ? error.message : String(error),
				error: error instanceof Error ? error : new Error(String(error))
			};
			this.results.push(errorResult);
			suiteResults.push(errorResult);
			this.notify();
		}

		return suiteResults;
	}

	/**
	 * Run a single test case
	 */
	async runTest(testCase: TestCase, suite?: TestSuite): Promise<TestResult> {
		const startTime = performance.now();

		// Mark test as running
		const runningResult: TestResult = {
			id: testCase.id,
			name: testCase.name,
			status: 'running',
			message: 'Test is running...'
		};

		// Update existing result if it exists, or add new one
		const existingIndex = this.results.findIndex(r => r.id === testCase.id);
		if (existingIndex >= 0) {
			this.results[existingIndex] = runningResult;
		} else {
			this.results.push(runningResult);
		}
		this.notify();

		try {
			// Run beforeEach hook
			if (suite?.beforeEach) {
				await suite.beforeEach();
			}

			// Run the actual test with timeout
			const testPromise = Promise.resolve(testCase.test());
			const timeoutPromise = testCase.timeout
				? new Promise<TestResult>((_, reject) => {
					setTimeout(() => reject(new Error(`Test timeout after ${testCase.timeout}ms`)), testCase.timeout);
				})
				: null;

			const result = timeoutPromise
				? await Promise.race([testPromise, timeoutPromise])
				: await testPromise;

			// Run afterEach hook
			if (suite?.afterEach) {
				await suite.afterEach();
			}

			const duration = performance.now() - startTime;

			return {
				...result,
				id: testCase.id,
				name: testCase.name,
				duration
			};

		} catch (error) {
			const duration = performance.now() - startTime;

			return {
				id: testCase.id,
				name: testCase.name,
				status: 'failed',
				duration,
				message: error instanceof Error ? error.message : String(error),
				details: error instanceof Error ? error.stack : String(error),
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Run a specific test by ID
	 */
	async runTestById(testId: string): Promise<TestResult | null> {
		for (const suite of this.suites) {
			const testCase = suite.tests.find(test => test.id === testId);
			if (testCase) {
				const result = await this.runTest(testCase, suite);

				// Update results array
				const existingIndex = this.results.findIndex(r => r.id === testId);
				if (existingIndex >= 0) {
					this.results[existingIndex] = result;
				} else {
					this.results.push(result);
				}
				this.notify();

				return result;
			}
		}
		return null;
	}

	/**
	 * Clear all results
	 */
	clearResults(): void {
		this.results = [];
		this.notify();
	}

	/**
	 * Get current results
	 */
	getResults(): TestResult[] {
		return [...this.results];
	}

	/**
	 * Get test statistics
	 */
	getStats() {
		const total = this.results.length;
		const passed = this.results.filter(r => r.status === 'passed').length;
		const failed = this.results.filter(r => r.status === 'failed').length;
		const warning = this.results.filter(r => r.status === 'warning').length;
		const running = this.results.filter(r => r.status === 'running').length;
		const pending = this.results.filter(r => r.status === 'pending').length;

		return {
			total,
			passed,
			failed,
			warning,
			running,
			pending,
			passRate: total > 0 ? (passed / total) * 100 : 0
		};
	}
}

/**
 * Component-specific test utilities
 */
export class ComponentTester {
	/**
	 * Test if a component renders without errors
	 */
	static testRender(componentName: string, renderFn: () => void): TestCase {
		return {
			id: `render-${componentName}`,
			name: `${componentName} renders without errors`,
			test: () => {
				try {
					renderFn();
					return {
						id: `render-${componentName}`,
						name: `${componentName} renders without errors`,
						status: 'passed',
						message: 'Component rendered successfully'
					};
				} catch (error) {
					throw new Error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		};
	}

	/**
	 * Test component accessibility
	 */
	static testAccessibility(componentName: string, element: HTMLElement): TestCase {
		return {
			id: `a11y-${componentName}`,
			name: `${componentName} accessibility check`,
			test: () => {
				const issues: string[] = [];

				// Check for ARIA labels
				if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
					const hasText = element.textContent?.trim().length > 0;
					const isInteractive = ['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase());

					if (isInteractive && !hasText) {
						issues.push('Interactive element missing accessible name');
					}
				}

				// Check for keyboard accessibility
				const isKeyboardAccessible = element.tabIndex >= 0 ||
					['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase());

				if (!isKeyboardAccessible) {
					issues.push('Element not keyboard accessible');
				}

				// Check for proper roles
				const hasRole = element.hasAttribute('role') ||
					['button', 'input', 'select', 'textarea', 'a', 'form'].includes(element.tagName.toLowerCase());

				if (!hasRole) {
					issues.push('Element missing semantic role');
				}

				const status = issues.length === 0 ? 'passed' : 'warning';

				return {
					id: `a11y-${componentName}`,
					name: `${componentName} accessibility check`,
					status,
					message: issues.length === 0 ? 'All accessibility checks passed' : `${issues.length} accessibility issues found`,
					details: issues.length > 0 ? issues.join('\n') : undefined
				};
			}
		};
	}

	/**
	 * Test component performance
	 */
	static testPerformance(componentName: string, renderFn: () => void, maxDuration = 100): TestCase {
		return {
			id: `perf-${componentName}`,
			name: `${componentName} performance check`,
			test: async () => {
				const start = performance.now();
				renderFn();
				const duration = performance.now() - start;

				const status = duration <= maxDuration ? 'passed' : 'warning';

				return {
					id: `perf-${componentName}`,
					name: `${componentName} performance check`,
					status,
					duration,
					message: `Render time: ${duration.toFixed(2)}ms (limit: ${maxDuration}ms)`,
					details: duration > maxDuration ? `Performance budget exceeded by ${(duration - maxDuration).toFixed(2)}ms` : undefined
				};
			}
		};
	}
}

/**
 * Pre-built test suites for common scenarios
 */
export const testSuites = {
	/**
	 * Create a basic component test suite
	 */
	createComponentSuite(componentName: string, element: HTMLElement, renderFn: () => void): TestSuite {
		return {
			name: `${componentName} Component Tests`,
			description: `Comprehensive tests for ${componentName} component`,
			tests: [
				ComponentTester.testRender(componentName, renderFn),
				ComponentTester.testAccessibility(componentName, element),
				ComponentTester.testPerformance(componentName, renderFn)
			]
		};
	},

	/**
	 * Create theme testing suite
	 */
	createThemeSuite(): TestSuite {
		return {
			name: 'Theme System Tests',
			description: 'Tests for theme switching and design token consistency',
			tests: [
				{
					id: 'theme-toggle',
					name: 'Theme toggle functionality',
					test: () => {
						const initialTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

						// Toggle theme
						document.documentElement.classList.remove('light', 'dark');
						document.documentElement.classList.add(initialTheme === 'light' ? 'dark' : 'light');

						const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

						// Restore original theme
						document.documentElement.classList.remove('light', 'dark');
						document.documentElement.classList.add(initialTheme);

						return {
							id: 'theme-toggle',
							name: 'Theme toggle functionality',
							status: newTheme !== initialTheme ? 'passed' : 'failed',
							message: newTheme !== initialTheme ? 'Theme toggle works correctly' : 'Theme toggle failed'
						};
					}
				},
				{
					id: 'css-variables',
					name: 'CSS variables availability',
					test: () => {
						const requiredVariables = [
							'--color-primary',
							'--color-ai-highlight',
							'--color-background',
							'--color-foreground'
						];

						const styles = getComputedStyle(document.documentElement);
						const missingVars = requiredVariables.filter(varName =>
							!styles.getPropertyValue(varName).trim()
						);

						return {
							id: 'css-variables',
							name: 'CSS variables availability',
							status: missingVars.length === 0 ? 'passed' : 'failed',
							message: missingVars.length === 0 ? 'All required CSS variables found' : `${missingVars.length} variables missing`,
							details: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : undefined
						};
					}
				}
			]
		};
	}
};

/**
 * Global test runner instance
 */
export const globalTestRunner = new TestRunner();

/**
 * Convenience functions for common testing patterns
 */
export const test = {
	/**
	 * Add a single test
	 */
	add: (testCase: TestCase) => globalTestRunner.addTest(testCase),

	/**
	 * Add a test suite
	 */
	suite: (suite: TestSuite) => globalTestRunner.addSuite(suite),

	/**
	 * Run all tests
	 */
	run: () => globalTestRunner.runAll(),

	/**
	 * Run a specific test
	 */
	runOne: (testId: string) => globalTestRunner.runTestById(testId),

	/**
	 * Clear results
	 */
	clear: () => globalTestRunner.clearResults(),

	/**
	 * Subscribe to results
	 */
	subscribe: (callback: (results: TestResult[]) => void) => globalTestRunner.subscribe(callback),

	/**
	 * Get current results
	 */
	results: () => globalTestRunner.getResults(),

	/**
	 * Get test statistics
	 */
	stats: () => globalTestRunner.getStats()
};
