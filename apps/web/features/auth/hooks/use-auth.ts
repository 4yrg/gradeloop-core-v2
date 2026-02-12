import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient, handleApiError, type AuthResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { useAuth } from "@/store/auth.store";
import { sanitizeRedirectUrl } from "@/lib/utils";

// Login hook
export function useLogin() {
  const { setUser, setAuthenticated, setLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
      redirectTo?: string;
    }) => {
      setLoading(true);
      return apiClient.login(email, password);
    },
    onSuccess: (data: AuthResponse, variables) => {
      // Update auth state
      setUser(data.user);
      setAuthenticated(true);

      // Cache user data
      queryClient.setQueryData(queryKeys.auth.user(), data.user);

      // Success feedback
      toast.success("Welcome back!", {
        description: `Logged in as ${data.user.full_name}`,
      });

      // Redirect to intended page
      const redirectUrl = sanitizeRedirectUrl(
        variables.redirectTo || "/dashboard",
      );
      router.push(redirectUrl);
    },
    onError: (error) => {
      const message = handleApiError(error);
      toast.error("Login Failed", {
        description:
          message === "Unauthorized" ? "Invalid email or password" : message,
      });
    },
    onSettled: () => {
      setLoading(false);
    },
  });
}

// Logout hook
export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.logout();
    },
    onSuccess: () => {
      // Clear auth state
      logout();

      // Clear all cached data
      queryClient.clear();

      // Redirect to login
      router.push("/login");

      toast.success("Logged out successfully");
    },
    onError: (error) => {
      // Even if logout fails, clear local state
      logout();
      queryClient.clear();
      router.push("/login");

      console.error("Logout error:", error);
    },
  });
}

// Forgot password hook
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      return apiClient.forgotPassword(email);
    },
    onSuccess: () => {
      toast.success("Reset Link Sent", {
        description:
          "If an account with that email exists, we've sent a reset link.",
      });
    },
    onError: (error) => {
      const message = handleApiError(error);
      toast.error("Request Failed", {
        description: message,
      });
    },
  });
}

// Reset password hook
export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      token,
      password,
    }: {
      token: string;
      password: string;
    }) => {
      return apiClient.resetPassword(token, password);
    },
    onSuccess: () => {
      toast.success("Password Reset", {
        description:
          "Your password has been reset successfully. Please log in.",
      });
      router.push("/login");
    },
    onError: (error) => {
      const message = handleApiError(error);
      toast.error("Reset Failed", {
        description: message.includes("expired")
          ? "Reset link has expired. Please request a new one."
          : message,
      });
    },
  });
}

// Change password hook
export function useChangePassword() {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      return apiClient.changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      toast.success("Password Updated", {
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error) => {
      const message = handleApiError(error);
      toast.error("Update Failed", {
        description: message.includes("current password")
          ? "Current password is incorrect"
          : message,
      });
    },
  });
}

// Session validation hook
export function useValidateSession() {
  const { isAuthenticated, logout } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.auth.validate(),
    queryFn: async () => {
      const isValid = await apiClient.validateSession();
      return { isValid };
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // 5 minutes
    refetchIntervalInBackground: false,
    retry: false,
  });

  // Handle session validation results
  React.useEffect(() => {
    if (query.data && !query.data.isValid && isAuthenticated) {
      logout();
      toast.error("Session Expired", {
        description: "Please log in again.",
      });
    }
  }, [query.data, isAuthenticated, logout]);

  React.useEffect(() => {
    if (query.error && isAuthenticated) {
      logout();
    }
  }, [query.error, isAuthenticated, logout]);

  return query;
}

// Current user hook
export function useCurrentUser() {
  const { user, isAuthenticated, setUser } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: apiClient.getCurrentUser,
    enabled: isAuthenticated && !user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: user,
  });

  // Update auth store when user data is fetched
  React.useEffect(() => {
    if (query.data && !user) {
      setUser(query.data);
    }
  }, [query.data, user, setUser]);

  return query;
}

// Session activity hook for tracking user activity
export function useSessionActivity() {
  const { updateLastActivity, isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    const updateActivity = () => {
      updateLastActivity();
    };

    // Throttle activity updates to once per minute
    let lastUpdate = 0;
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) {
        // 1 minute
        updateActivity();
        lastUpdate = now;
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledUpdate, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledUpdate);
      });
    };
  }, [isAuthenticated, updateLastActivity]);
}

// Session timeout warning hook
export function useSessionTimeout() {
  const { isAuthenticated, timeUntilExpiry, logout } = useAuth();
  const [showWarning, setShowWarning] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const checkTimeout = () => {
      const timeLeft = timeUntilExpiry;

      if (timeLeft <= 0) {
        logout();
        toast.error("Session Expired", {
          description: "Your session has expired. Please log in again.",
        });
        return;
      }

      // Show warning when 5 minutes or less remain
      if (timeLeft <= 5 * 60 * 1000) {
        setShowWarning(true);
        setCountdown(Math.ceil(timeLeft / 1000));
      } else {
        setShowWarning(false);
        setCountdown(0);
      }
    };

    const interval = setInterval(checkTimeout, 1000);
    checkTimeout(); // Check immediately

    return () => clearInterval(interval);
  }, [isAuthenticated, timeUntilExpiry, logout]);

  return {
    showWarning,
    countdown,
    dismissWarning: () => setShowWarning(false),
  };
}

// Auth guards for components
export function useAuthGuard(
  options: {
    requiredRoles?: string[];
    requiredPermissions?: string[];
    redirectTo?: string;
  } = {},
) {
  const { isAuthenticated, hasAnyRole, hasAnyPermission, isLoading } =
    useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const redirectUrl = options.redirectTo || "/login";
      router.push(redirectUrl);
      return;
    }

    if (options.requiredRoles && !hasAnyRole(options.requiredRoles)) {
      router.push("/unauthorized");
      return;
    }

    if (
      options.requiredPermissions &&
      !hasAnyPermission(options.requiredPermissions)
    ) {
      router.push("/unauthorized");
      return;
    }
  }, [
    isAuthenticated,
    isLoading,
    hasAnyRole,
    hasAnyPermission,
    options.requiredRoles,
    options.requiredPermissions,
    options.redirectTo,
    router,
  ]);

  return {
    isAuthenticated,
    isLoading,
    canAccess:
      isAuthenticated &&
      (!options.requiredRoles || hasAnyRole(options.requiredRoles)) &&
      (!options.requiredPermissions ||
        hasAnyPermission(options.requiredPermissions)),
  };
}
