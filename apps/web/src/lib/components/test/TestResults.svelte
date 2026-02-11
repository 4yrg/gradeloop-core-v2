<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { createEventDispatcher } from 'svelte';
	import { CheckCircle, XCircle, AlertCircle, Clock, Play, RefreshCw } from 'lucide-svelte';

	interface TestResult {
		id: string;
		name: string;
		status: 'passed' | 'failed' | 'warning' | 'running' | 'pending';
		duration?: number;
		message?: string;
		details?: string;
	}

	interface Props {
		results: TestResult[];
		title?: string;
		showSummary?: boolean;
		allowRetry?: boolean;
		class?: string;
	}

	let {
		results = [],
		title = 'Test Results',
		showSummary = true,
		allowRetry = true,
		class: className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		retry: string;
		runAll: void;
		viewDetails: TestResult;
	}>();

	// Computed summary statistics
	$: summary = {
		total: results.length,
		passed: results.filter(r => r.status === 'passed').length,
		failed: results.filter(r => r.status === 'failed').length,
		warning: results.filter(r => r.status === 'warning').length,
		running: results.filter(r => r.status === 'running').length,
		pending: results.filter(r => r.status === 'pending').length
	};

	$: overallStatus = summary.failed > 0 ? 'failed' :
					  summary.warning > 0 ? 'warning' :
					  summary.running > 0 ? 'running' :
					  summary.pending > 0 ? 'pending' : 'passed';

	function getStatusIcon(status: TestResult['status']) {
		switch (status) {
			case 'passed':
				return CheckCircle;
			case 'failed':
				return XCircle;
			case 'warning':
				return AlertCircle;
			case 'running':
				return Clock;
			case 'pending':
				return Clock;
			default:
				return Clock;
		}
	}

	function getStatusColor(status: TestResult['status']) {
		switch (status) {
			case 'passed':
				return 'text-success';
			case 'failed':
				return 'text-error';
			case 'warning':
				return 'text-warning';
			case 'running':
				return 'text-info';
			case 'pending':
				return 'text-muted-foreground';
			default:
				return 'text-muted-foreground';
		}
	}

	function getStatusBgColor(status: TestResult['status']) {
		switch (status) {
			case 'passed':
				return 'bg-success/10 border-success/20';
			case 'failed':
				return 'bg-error/10 border-error/20';
			case 'warning':
				return 'bg-warning/10 border-warning/20';
			case 'running':
				return 'bg-info/10 border-info/20';
			case 'pending':
				return 'bg-muted/10 border-border';
			default:
				return 'bg-muted/10 border-border';
		}
	}

	function formatDuration(ms?: number): string {
		if (!ms) return '';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function handleRetry(testId: string) {
		dispatch('retry', testId);
	}

	function handleRunAll() {
		dispatch('runAll');
	}

	function handleViewDetails(test: TestResult) {
		dispatch('viewDetails', test);
	}
</script>

<div class={twMerge('bg-card border border-border rounded-lg', className)}>
	<!-- Header -->
	<div class="flex items-center justify-between p-4 border-b border-border">
		<div class="flex items-center gap-3">
			<h3 class="font-semibold text-lg">{title}</h3>
			{#if showSummary}
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-full {overallStatus === 'passed' ? 'bg-success' : overallStatus === 'failed' ? 'bg-error' : overallStatus === 'warning' ? 'bg-warning' : 'bg-info'}"></div>
					<span class="text-sm text-muted-foreground">
						{summary.passed}/{summary.total} passed
					</span>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if allowRetry}
				<button
					type="button"
					class="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors"
					onclick={handleRunAll}
				>
					<Play size={14} />
					Run All
				</button>
			{/if}
		</div>
	</div>

	<!-- Summary Stats -->
	{#if showSummary && results.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/30">
			<div class="text-center">
				<div class="text-2xl font-bold text-success">{summary.passed}</div>
				<div class="text-xs text-muted-foreground">Passed</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-error">{summary.failed}</div>
				<div class="text-xs text-muted-foreground">Failed</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-warning">{summary.warning}</div>
				<div class="text-xs text-muted-foreground">Warnings</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-info">{summary.running}</div>
				<div class="text-xs text-muted-foreground">Running</div>
			</div>
			<div class="text-center">
				<div class="text-2xl font-bold text-muted-foreground">{summary.pending}</div>
				<div class="text-xs text-muted-foreground">Pending</div>
			</div>
		</div>
	{/if}

	<!-- Test Results -->
	<div class="p-4">
		{#if results.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<Clock size={48} class="mx-auto mb-4 opacity-50" />
				<h4 class="font-medium mb-2">No tests available</h4>
				<p class="text-sm">Run some tests to see results here</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each results as test (test.id)}
					<div class="border rounded-lg p-3 transition-all duration-200 hover:shadow-sm {getStatusBgColor(test.status)}">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								{@const StatusIcon = getStatusIcon(test.status)}
								<div class="flex-shrink-0">
									{#if test.status === 'running'}
										<StatusIcon size={16} class="{getStatusColor(test.status)} animate-spin" />
									{:else}
										<StatusIcon size={16} class={getStatusColor(test.status)} />
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<h4 class="font-medium text-sm truncate">{test.name}</h4>
										{#if test.duration}
											<span class="text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
												{formatDuration(test.duration)}
											</span>
										{/if}
									</div>
									{#if test.message}
										<p class="text-xs text-muted-foreground mt-1">{test.message}</p>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								{#if test.details}
									<button
										type="button"
										class="text-xs text-muted-foreground hover:text-foreground underline"
										onclick={() => handleViewDetails(test)}
									>
										Details
									</button>
								{/if}
								{#if allowRetry && test.status === 'failed'}
									<button
										type="button"
										class="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
										onclick={() => handleRetry(test.id)}
										title="Retry test"
									>
										<RefreshCw size={14} />
									</button>
								{/if}
							</div>
						</div>

						{#if test.details && test.status === 'failed'}
							<div class="mt-3 pt-3 border-t border-current/20">
								<pre class="text-xs text-error bg-error/5 p-2 rounded overflow-x-auto">{test.details}</pre>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	{#if results.length > 0}
		<div class="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
			<div class="flex items-center justify-between">
				<span>
					Last updated: {new Date().toLocaleTimeString()}
				</span>
				<span>
					Total duration: {formatDuration(results.reduce((sum, test) => sum + (test.duration || 0), 0))}
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom animations for test states */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* Smooth transitions */
	.transition-all {
		transition: all 0.2s ease-in-out;
	}

	/* Code formatting */
	pre {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Enhanced hover states */
	.hover\:shadow-sm:hover {
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.animate-spin {
			animation: none;
		}

		.transition-all {
			transition: none !important;
		}
	}
</style>
