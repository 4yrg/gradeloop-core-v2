<script lang="ts">
	import '../routes/layout.css';
	import { ErrorBoundary } from '$lib/components';

	// Setup global error handler on mount
	import { setupGlobalErrorHandler } from '$lib/utils/errors';
	setupGlobalErrorHandler();
</script>

<ErrorBoundary>
	<slot />
</ErrorBoundary>
