import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type {
  LoginRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  LoginResponse,
  User,
  Session,
} from "@/schemas/auth.schema";

// Login hook
export const useLogin = () => {
  const router = useRouter();
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return apiClient.login(credentials);
    },
    onSuccess: (data: LoginResponse) => {
      // Update auth store
      authStore.login(
        data.user as User,
        {
          id: data.session_id,
          user_id: data.user.id,
          device_name: "Web Browser",
          is_active: true,
          last_activity: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + data.expires_in * 1000,
          ).toISOString(),
          created_at: new Date().toISOString(),
        } as Session,
        Date.now() + data.expires_in * 1000,
        data.session_id,
      );

      // Invalidate user-related queries
      queryClient.invalidateQueries({ queryKey: ["user"] });

      // Show success message
      toast.success("Welcome back!", {
        description: `Logged in as ${(data.user as User).full_name}`,
      });

      // Redirect to dashboard or return URL
      const urlParams = new URLSearchParams(window.location.search);
      const returnTo = urlParams.get("returnTo");
      router.push(returnTo || "/dashboard");
    },
    onError: (error: any) => {
      console.error("Login error:", error);

      // Handle specific error cases
      let errorMessage = "Login failed";

      if (error?.status === 401) {
        errorMessage = "Invalid email or password";
      } else if (error?.status === 429) {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error?.status === 403) {
        errorMessage = "Account is locked or inactive";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error("Login Failed", {
        description: errorMessage,
      });

      // Re-throw error so form can handle it
      throw error;
    },
  });
};

// Logout hook
export const useLogout = () => {
  const router = useRouter();
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiClient.logout();
    },
    onSuccess: () => {
      // Clear auth store
      authStore.logout();

      // Clear all cached data
      queryClient.clear();

      // Show success message
      toast.success("Logged out successfully");

      // Redirect to login
      router.push("/login");
    },
    onError: (error: any) => {
      console.error("Logout error:", error);

      // Even if logout fails on server, clear local state
      authStore.logout();
      queryClient.clear();
      router.push("/login");

      toast.error("Logout completed", {
        description: "Session cleared locally",
      });
    },
  });
};

// Change password hook
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: {
      current_password: string;
      new_password: string;
    }) => {
      return apiClient.changePassword(data);
    },
    onSuccess: (data) => {
      toast.success("Password Changed", {
        description:
          data.message || "Your password has been updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Change password error:", error);

      let errorMessage = "Failed to change password";

      if (error.status === 400) {
        errorMessage = "Current password is incorrect";
      } else if (error.status === 422) {
        errorMessage = "New password does not meet requirements";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error("Password Change Failed", {
        description: errorMessage,
      });
    },
  });
};

// Forgot password hook
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      return apiClient.forgotPassword(data);
    },
    onSuccess: (data) => {
      toast.success("Reset Email Sent", {
        description:
          data.message || "Check your email for password reset instructions",
      });
    },
    onError: (error: any) => {
      console.error("Forgot password error:", error);

      // Don't reveal whether email exists for security
      toast.success("Reset Email Sent", {
        description: "If the email exists, you'll receive reset instructions",
      });
      
      // Still throw error for form handling
      throw error;
    },
  });
};

// Reset password hook
export const useResetPassword = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      return apiClient.resetPassword(data);
    },
    onSuccess: (data) => {
      toast.success("Password Reset Complete", {
        description:
          data.message || "Your password has been reset successfully",
      });

      // Redirect to login
      router.push("/login");
    },
    onError: (error: any) => {
      console.error("Reset password error:", error);

      let errorMessage = "Failed to reset password";

      if (error?.status === 400) {
        errorMessage = "Invalid or expired reset token";
      } else if (error?.status === 422) {
        errorMessage = "Password does not meet requirements";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error("Password Reset Failed", {
        description: errorMessage,
      });
      
      // Throw error for form handling
      throw error;
    },
  });
};

// Session validation hook
export const useValidateSession = () => {
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      return apiClient.validateSession();
    },
    onSuccess: (data) => {
      if (!data.valid) {
        // Session invalid, logout user
        authStore.logout();
      }
    },
    onError: (error: any) => {
      console.error("Session validation error:", error);
      
      // Handle rate limiting specifically
      if (error?.status === 429) {
        // Rate limited - don't logout, just wait
        console.warn("Session validation rate limited, will retry");
        return;
      }
      
      // For other errors, logout user
      authStore.logout();
    },
  });
};

// Refresh token hook
export const useRefreshToken = () => {
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      return apiClient.refresh();
    },
    onSuccess: (data) => {
      // Update auth store with new token expiration
      authStore.refresh(Date.now() + data.expires_in * 1000);
      authStore.updateLastActivity();
    },
    onError: (error: any) => {
      console.error("Token refresh error:", error);

      // Refresh failed, logout user
      authStore.logout();
    },
  });
};

// Combined auth actions hook
export const useAuthActions = () => {
  const login = useLogin();
  const logout = useLogout();
  const changePassword = useChangePassword();
  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();
  const validateSession = useValidateSession();
  const refreshToken = useRefreshToken();

  return {
    // Login/Logout
    login: login.mutateAsync,
    logout: logout.mutate,
    isLoggingIn: login.isPending,
    isLoggingOut: logout.isPending,

    // Password management
    changePassword: changePassword.mutate,
    forgotPassword: forgotPassword.mutateAsync,
    resetPassword: resetPassword.mutateAsync,
    isChangingPassword: changePassword.isPending,
    isSendingResetEmail: forgotPassword.isPending,
    isResettingPassword: resetPassword.isPending,

    // Session management
    validateSession: validateSession.mutate,
    refreshToken: refreshToken.mutate,
    isValidatingSession: validateSession.isPending,
    isRefreshingToken: refreshToken.isPending,

    // Loading states
    isLoading: login.isPending || logout.isPending || refreshToken.isPending,

    // Error states
    loginError: login.error,
    logoutError: logout.error,
    changePasswordError: changePassword.error,
    forgotPasswordError: forgotPassword.error,
    resetPasswordError: resetPassword.error,
    sessionError: validateSession.error,
    refreshError: refreshToken.error,
  };
};

// Auto-refresh hook for maintaining session
export const useAutoRefresh = () => {
  const authStore = useAuthStore();
  const refreshMutation = useRefreshToken();

  // Auto-refresh when token is about to expire
  React.useEffect(() => {
    if (!authStore.isAuthenticated) return;

    const checkAndRefresh = () => {
      if (authStore.shouldRefresh() && !refreshMutation.isPending) {
        refreshMutation.mutate();
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefresh, 60 * 1000);

    // Initial check
    checkAndRefresh();

    return () => clearInterval(interval);
  }, [authStore.isAuthenticated, authStore.shouldRefresh, refreshMutation]);

  return {
    isRefreshing: refreshMutation.isPending,
    refreshError: refreshMutation.error,
  };
};
