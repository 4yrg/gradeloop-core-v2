"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { TokenManager } from "@/lib/api";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time for auth-related queries
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      // Refetch on window focus for auth queries
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Auth provider component
function AuthProvider({ children }: { children: React.ReactNode }) {
  const authStore = useAuthStore();

  // Initialize auth state on mount
  React.useEffect(() => {
    const initializeAuth = () => {
      // Check if we have tokens in cookies
      const accessToken = TokenManager.getAccessToken();
      const sessionId = TokenManager.getSessionId();

      if (accessToken && sessionId && !authStore.isAuthenticated) {
        // We have tokens but store shows not authenticated
        // This can happen on page refresh
        try {
          // Validate the token by making a request to get current user
          // This will trigger the auth flow if token is valid
          authStore.setLoading(true);

          // Set a minimal authenticated state to enable API calls
          authStore.setAuthenticated(true);
          authStore.setSessionId(sessionId);

          // The API will handle token validation and refresh if needed
        } catch (error) {
          console.error("Auth initialization error:", error);
          // Clear invalid tokens
          TokenManager.clearTokens();
          authStore.logout();
        } finally {
          authStore.setLoading(false);
        }
      } else if (!accessToken && authStore.isAuthenticated) {
        // No tokens but store shows authenticated - clear state
        authStore.logout();
      }
    };

    initializeAuth();
  }, [authStore]);

  // Auto-refresh token when it's about to expire
  React.useEffect(() => {
    if (!authStore.isAuthenticated) return;

    const checkTokenExpiry = async () => {
      if (authStore.shouldRefresh() && !authStore.refreshing) {
        try {
          authStore.setRefreshing(true);
          await TokenManager.refreshAccessToken();
        } catch (error) {
          console.error("Auto-refresh failed:", error);
          authStore.logout();
        } finally {
          authStore.setRefreshing(false);
        }
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkTokenExpiry, 30 * 1000);

    // Initial check
    checkTokenExpiry();

    return () => clearInterval(interval);
  }, [authStore.isAuthenticated, authStore.shouldRefresh, authStore.refreshing]);

  // Update activity on user interactions
  React.useEffect(() => {
    if (!authStore.isAuthenticated) return;

    const updateActivity = () => {
      authStore.updateLastActivity();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, [authStore.isAuthenticated]);

  return <>{children}</>;
}

// Session monitor component
function SessionMonitor({ children }: { children: React.ReactNode }) {
  const authStore = useAuthStore();

  // Monitor session validity
  React.useEffect(() => {
    if (!authStore.isAuthenticated) return;

    const checkSession = () => {
      // Check if session is expired based on local state
      if (authStore.isSessionExpired()) {
        console.log("Session expired, logging out");
        authStore.logout();
        return;
      }

      // Check for inactivity timeout (30 minutes)
      const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      const timeSinceActivity = Date.now() - authStore.lastActivity;

      if (timeSinceActivity > INACTIVITY_TIMEOUT) {
        console.log("Session inactive timeout, logging out");
        authStore.logout();
        return;
      }
    };

    // Check session every minute
    const interval = setInterval(checkSession, 60 * 1000);

    // Initial check
    checkSession();

    return () => clearInterval(interval);
  }, [authStore.isAuthenticated, authStore.lastActivity, authStore.isSessionExpired]);

  return <>{children}</>;
}

// Main providers component
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <SessionMonitor>
            {children}
            <Toaster
              position="top-right"
              expand={true}
              richColors={true}
              closeButton={true}
            />
          </SessionMonitor>
        </AuthProvider>
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom-right"
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Export query client for use in other parts of the app
export { queryClient };
