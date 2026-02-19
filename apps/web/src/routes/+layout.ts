/**
 * Root layout load function
 * Initializes API client and auth store at app startup
 */

import type { LayoutLoad } from './$types';
import { initApiClient } from '$lib/api/init';

export const load: LayoutLoad = async () => {
	// Initialize API client and auth store
	const { apiClient, tokenManager, authStore } = initApiClient();

	return {
		auth: {
			isAuthenticated: authStore.isAuthenticated(),
			isLoading: authStore.isLoading(),
			user: authStore.getUser()
		}
	};
};
