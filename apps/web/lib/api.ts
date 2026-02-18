import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { z } from "zod";
import { CSRFTokenManager } from "./jwt";
import { toast } from "sonner";
import { ClientCookieManager, COOKIE_NAMES } from "./cookies";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/schemas/auth.schema";
// Auth schema types available but not all currently used

// API Configuration - prefer same-origin in browser to avoid CSP/CORS issues
// When running in the browser we use a relative path so requests are same-origin
// and won't be blocked by a Content Security Policy that restricts `connect-src`.
// Server-side: Use IAM_SERVICE_URL or NEXT_PUBLIC_IAM_SERVICE_URL. If the
// frontend is talking to the Krakend gateway, the gateway exposes the
// public endpoints under `/api/v1` so we append `/api/v1` when a service URL
// is provided.
// Client-side: Use NEXT_PUBLIC_IAM_SERVICE_URL (relative path)
const IAM_SERVICE_URL =
  typeof window === "undefined"
    ? process.env.IAM_SERVICE_URL ||
      process.env.NEXT_PUBLIC_IAM_SERVICE_URL ||
      "http://localhost:8080"
    : process.env.NEXT_PUBLIC_IAM_SERVICE_URL || "";
const API_BASE_URL = IAM_SERVICE_URL
  ? `${IAM_SERVICE_URL.replace(/\/+$/g, "")}/api/v1`
  : "/api/iam/v1";
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second
let lastRateLimitToastAt = 0;

// Response schemas for validation based on IAM service
// Note: access_token and refresh_token are now delivered via HTTPOnly cookies
// They are optional in the response schema for backward compatibility
const IAMAuthResponseSchema = z.object({
  access_token: z.string().optional(), // Now delivered via cookie
  refresh_token: z.string().optional(), // Now delivered via cookie
  is_password_reset_required: z.boolean().optional(),
  csrf_token: z.string().optional(), // Optional CSRF token for immediate use
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    is_active: z.boolean(),
    user_type: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      z.enum(["student", "employee"]),
    ),
    roles: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        permissions: z.array(z.string()),
      }),
    ),
  }),
});

const IAMRefreshResponseSchema = z.object({
  access_token: z.string().optional(), // Now delivered via cookie
  refresh_token: z.string().optional(), // Now delivered via cookie
  is_password_reset_required: z.boolean().optional(),
  csrf_token: z.string().optional(), // Optional CSRF token for immediate use
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    is_active: z.boolean(),
    user_type: z.preprocess(
      (val) => (typeof val === "string" ? val.toLowerCase() : val),
      z.enum(["student", "employee"]),
    ),
    roles: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        permissions: z.array(z.string()),
      }),
    ),
  }),
});

// Error response schema (kept for future use)
// const ErrorResponseSchema = z.object({
//   error: z.string(),
//   error_description: z.string().optional(),
//   error_code: z.string().optional(),
//   timestamp: z.string().optional(),
// });

// Enhanced API Error classes
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class NetworkError extends APIError {
  constructor(message = "Network request failed") {
    super(message, 0, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends APIError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends APIError {
  constructor(message = "Request validation failed", data?: unknown) {
    super(message, 422, "VALIDATION_ERROR", data);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends APIError {
  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, "RATE_LIMIT_ERROR", { retryAfter });
    this.name = "RateLimitError";
  }
}

// Token Management for secure cookie-based auth
class TokenManager {
  private static refreshPromise: Promise<void> | null = null;
  private static refreshing = false;

  /**
   * Store tokens securely via server-side API call
   * NOTE: With HTTPOnly cookie-based auth, the server sets cookies directly.
   * This method is now a no-op - tokens are managed server-side.
   */
  static async storeTokens(
    _accessToken: string,
    _refreshToken: string,
    _sessionId: string,
  ): Promise<void> {
    // No-op: tokens are now server-managed via HTTPOnly cookies
    // CSRF token is set separately from the response
    return Promise.resolve();
  }

  /**
   * Access token is HTTPOnly and sent automatically with requests
   * This method is kept for compatibility but cannot access HTTPOnly cookies
   */
  static getAccessToken(): string | null {
    console.warn(
      "Access token is HTTPOnly and cannot be accessed from client-side JavaScript",
    );
    return null;
  }

  /**
   * Refresh token is HTTPOnly and sent automatically with requests
   * This method is kept for compatibility but cannot access HTTPOnly cookies
   */
  static getRefreshToken(): string | null {
    console.warn(
      "Refresh token is HTTPOnly and cannot be accessed from client-side JavaScript",
    );
    return null;
  }

  /**
   * Session ID is HTTPOnly and sent automatically with requests
   * This method is kept for compatibility but cannot access HTTPOnly cookies
   */
  static getSessionId(): string | null {
    console.warn(
      "Session ID is HTTPOnly and cannot be accessed from client-side JavaScript",
    );
    return null;
  }

  /**
   * Get CSRF token for headers
   */
  static getCSRFToken(): string | null {
    return ClientCookieManager.getCsrfToken();
  }

  /**
   * Clear all authentication tokens
   * Note: Cookies are cleared by the server on logout, this just clears client-side state
   */
  static async clearTokens(): Promise<void> {
    try {
      // Clear client-side CSRF token
      ClientCookieManager.deleteCookie(COOKIE_NAMES.CSRF_TOKEN);
    } catch (error) {
      console.error("Failed to clear tokens:", error);
      // Fallback: clear what we can client-side
      ClientCookieManager.deleteCookie(COOKIE_NAMES.CSRF_TOKEN);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(): Promise<void> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual refresh operation
   */
  private static async performRefresh(): Promise<void> {
    const authStore = useAuthStore.getState();

    if (this.refreshing) {
      throw new AuthenticationError("Refresh already in progress");
    }

    try {
      this.refreshing = true;
      authStore.setRefreshing(true);

      // Call IAM service refresh endpoint
      // Note: refresh token is sent automatically via HTTPOnly cookie
      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      );

      // Check if the response indicates refresh is not implemented
      if (
        response.data?.error &&
        response.data.error.includes("Not implemented")
      ) {
        // If refresh is not implemented, treat as session expired
        throw new AuthenticationError("Session expired");
      }

      const refreshData = IAMRefreshResponseSchema.parse(response.data);

      // Update CSRF token from response if present
      if (response.data.csrf_token) {
        ClientCookieManager.setCookie(
          COOKIE_NAMES.CSRF_TOKEN,
          response.data.csrf_token,
          {
            secure: process.env.NODE_ENV === "production",
            httpOnly: false,
            sameSite: "lax",
            maxAge: 15 * 60,
            path: "/",
          },
        );
      }

      // Update auth store with user data (tokens are in cookies)
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes from now
      authStore.refresh(expiresAt);
      authStore.setUser(refreshData.user);
      authStore.updateLastActivity();
    } catch (error) {
      console.error("Token refresh failed:", error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Refresh token expired - logout user
        await this.handleRefreshFailure();
        throw new AuthenticationError("Session expired");
      }

      // Handle 400 - refresh token not found in cookie
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.warn(
          "Refresh token not found in cookies - user may not be logged in",
        );
        await this.handleRefreshFailure();
        throw new AuthenticationError("Session expired");
      }

      throw error;
    } finally {
      this.refreshing = false;
      authStore.setRefreshing(false);
    }
  }

  /**
   * Handle refresh failure by logging out user
   */
  private static async handleRefreshFailure(): Promise<void> {
    // Clear tokens
    this.clearTokens();

    // Clear client state
    const authStore = useAuthStore.getState();
    authStore.logout();

    // Do not perform an automatic client-side redirect here.
    // Clearing tokens and logging out is sufficient - UI route guards
    // will show the appropriate unauthorized UI and let the user
    // initiate a sign-in if desired.
  }

  /**
   * Check if token should be refreshed
   */
  static shouldRefreshToken(): boolean {
    const authStore = useAuthStore.getState();
    return authStore.shouldRefresh();
  }
}

// Create axios instance for IAM service
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true, // Always send cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for authentication and CSRF
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh for auth endpoints that don't need tokens
    const noTokenEndpoints = [
      "/auth/login",
      "/auth/request-reset",
      "/auth/reset-password",
    ];
    const isNoTokenEndpoint = noTokenEndpoints.some((endpoint) =>
      config.url?.includes(endpoint),
    );

    if (!isNoTokenEndpoint) {
      // Pre-request token refresh disabled - refresh will happen on 401 response
      // This prevents issues with refresh being called before cookies are set
      // TokenManager.shouldRefreshToken() check removed to avoid premature refresh attempts
      // HTTPOnly cookies (access token, refresh token, session ID)
      // are automatically sent by the browser with each request
      // No manual Authorization header injection needed
    }

    // Add CSRF protection for state-changing operations
    const stateMutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (stateMutatingMethods.includes(config.method?.toUpperCase() || "")) {
      const csrfToken = TokenManager.getCSRFToken();
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    // Add request timestamp for debugging
    config.headers["X-Request-Time"] = new Date().toISOString();

    // Ensure cookies are sent with the request
    config.withCredentials = true;

    // Update activity timestamp
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated) {
      authStore.updateLastActivity();
    }

    return config;
  },
  () => {
    return Promise.reject(new NetworkError("Request configuration failed"));
  },
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => {
    // Update activity on successful response
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated) {
      authStore.updateLastActivity();
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle network errors
    if (!error.response) {
      // Log helpful debug info: request URL and axios message
      try {
        const reqUrl =
          (originalRequest && (originalRequest as any).url) ||
          api.defaults.baseURL;
        console.error("Network error contacting:", reqUrl, error.message);
      } catch (e) {
        console.error(
          "Network error (unable to determine request URL)",
          error.message,
        );
      }

      return Promise.reject(new NetworkError("Network request failed"));
    }

    const { status, data } = error.response;

    // Handle 401 responses (token expired)
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Skip refresh for auth endpoints
      const authEndpoints = ["/auth/login", "/auth/refresh"];
      const isAuthEndpoint = authEndpoints.some((endpoint) =>
        originalRequest.url?.includes(endpoint),
      );

      if (!isAuthEndpoint) {
        try {
          await TokenManager.refreshAccessToken();

          // Retry original request (tokens are sent automatically via HTTPOnly cookies)
          return api(originalRequest);
        } catch (refreshError) {
          console.error("Token refresh in interceptor failed:", refreshError);
          return Promise.reject(new AuthenticationError("Session expired"));
        }
      }

      return Promise.reject(new AuthenticationError("Authentication required"));
    }

    // Handle different error types
    const errorData = Array.isArray(data) ? data[0] : data;
    const errorMessage =
      errorData?.error || errorData?.message || error.message;

    switch (status) {
      case 400:
        return Promise.reject(new ValidationError(errorMessage, errorData));
      case 401:
        return Promise.reject(new AuthenticationError(errorMessage));
      case 403:
        return Promise.reject(new AuthorizationError(errorMessage));
      case 422:
        return Promise.reject(new ValidationError(errorMessage, errorData));
      case 429: {
        const retryAfter = error.response.headers["retry-after"];
        const retryAfterSec = retryAfter ? parseInt(retryAfter) : undefined;

        // Show a single toast to the user about rate limiting
        try {
          if (Date.now() - lastRateLimitToastAt > 3000) {
            lastRateLimitToastAt = Date.now();
            const humanWait = retryAfterSec
              ? `${retryAfterSec}s`
              : "a short while";
            toast.error(`Too many requests — try again in ${humanWait}`);
          }
        } catch (e) {
          // ignore toast errors
        }

        return Promise.reject(new RateLimitError(errorMessage, retryAfterSec));
      }
      case 500:
      case 502:
      case 503:
      case 504:
        return Promise.reject(
          new APIError(
            "Server error occurred",
            status,
            "SERVER_ERROR",
            errorData,
          ),
        );
      default:
        return Promise.reject(
          new APIError(errorMessage, status, "UNKNOWN_ERROR", errorData),
        );
    }
  },
);

// API client methods that work with IAM service
export const apiClient = {
  // Authentication methods
  async login(credentials: { email: string; password: string }): Promise<{
    user: User;
    token_type: "Bearer";
    expires_in: number;
    session_id: string;
    is_password_reset_required?: boolean;
  }> {
    // Login via IAM service - cookies are set automatically by the service
    const response = await api.post("/auth/login", credentials);
    const authData = IAMAuthResponseSchema.parse(response.data);

    // Update CSRF token from response (server sets it in cookie too)
    if (response.data.csrf_token) {
      ClientCookieManager.setCookie(
        COOKIE_NAMES.CSRF_TOKEN,
        response.data.csrf_token,
        {
          secure: process.env.NODE_ENV === "production",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 15 * 60,
          path: "/",
        },
      );
    }

    // Note: access_token and refresh_token are now in HTTPOnly cookies
    // They are not returned in the JSON response anymore
    return {
      user: authData.user,
      token_type: "Bearer" as const,
      expires_in: 900, // 15 minutes in seconds
      session_id: authData.user.id,
      is_password_reset_required: authData.is_password_reset_required,
    };
  },

  async refresh(): Promise<{
    token_type: "Bearer";
    expires_in: number;
    session_id: string;
  }> {
    // Refresh via IAM service - refresh token is sent automatically via HTTPOnly cookie
    const response = await api.post("/auth/refresh", {});

    // Check if refresh is not implemented
    if (
      response.data.error &&
      response.data.error.includes("Not implemented")
    ) {
      throw new AuthenticationError("Session expired");
    }

    const refreshData = IAMRefreshResponseSchema.parse(response.data);

    // Update CSRF token from response (server sets it in cookie too)
    if (response.data.csrf_token) {
      ClientCookieManager.setCookie(
        COOKIE_NAMES.CSRF_TOKEN,
        response.data.csrf_token,
        {
          secure: process.env.NODE_ENV === "production",
          httpOnly: false,
          sameSite: "lax",
          maxAge: 15 * 60,
          path: "/",
        },
      );
    }

    // Note: access_token and refresh_token are now in HTTPOnly cookies
    return {
      token_type: "Bearer" as const,
      expires_in: 900, // 15 minutes in seconds
      session_id: refreshData.user.id,
    };
  },

  async logout(): Promise<{ message: string }> {
    try {
      // Call IAM service logout endpoint to clear cookies and revoke tokens
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
      // Continue with local cleanup even if server logout fails
    }

    // Clear any remaining client-side tokens
    await TokenManager.clearTokens();

    // Clear auth store
    const authStore = useAuthStore.getState();
    authStore.logout();

    return { message: "Logged out successfully" };
  },

  async validateSession(): Promise<{
    valid: boolean;
    user?: unknown;
  }> {
    console.log("[API] validateSession called at", new Date().toISOString());
    try {
      // Validate session via IAM service - cookies are sent automatically
      const response = await api.get("/auth/session");
      console.log("[API] validateSession success:", response.data);
      return {
        valid: response.data.valid,
        user: response.data.user,
      };
    } catch (error) {
      console.log("[API] validateSession error:", error);
      // Handle 401 specifically - no valid session
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log("[API] 401 response - no valid session");
        return { valid: false };
      }

      // Detect rate limit either via our RateLimitError class or an Axios response status
      let isRateLimited = false;
      let retryAfterSeconds: number | undefined;

      if (error instanceof RateLimitError) {
        isRateLimited = true;
        retryAfterSeconds = (error.data as any)?.retryAfter;
      } else if (axios.isAxiosError(error) && error.response?.status === 429) {
        isRateLimited = true;
        const header = error.response.headers["retry-after"];
        retryAfterSeconds = header ? parseInt(header) : undefined;
      }

      if (isRateLimited) {
        try {
          const waitMs =
            retryAfterSeconds && Number.isFinite(retryAfterSeconds)
              ? retryAfterSeconds * 1000
              : 1000;
          console.warn(
            `Session validation rate limited, retrying after ${waitMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          const retryResponse = await api.get("/auth/session");
          return {
            valid: retryResponse.data.valid,
            user: retryResponse.data.user,
          };
        } catch (e) {
          console.error("Session validation retry failed:", e);
        }
      }

      console.error("Session validation error:", error);
      return { valid: false };
    }
  },

  // Password management
  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<{ message: string }> {
    const response = await api.patch("/users/me/password", data);
    return response.data;
  },

  async forgotPassword(data: { email: string }): Promise<{ message: string }> {
    const response = await api.post("/auth/request-reset", data);
    return response.data;
  },

  async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<{ message: string }> {
    const response = await api.post("/auth/reset-password", {
      token: data.token,
      new_password: data.password,
    });
    return response.data;
  },

  async getCurrentUser(): Promise<unknown> {
    const response = await api.get("/users/me");
    return response.data;
  },

  async updateProfile(data: Record<string, unknown>): Promise<unknown> {
    const response = await api.patch("/users/me", data);
    return response.data;
  },

  // Generic CRUD operations with validation
  async get<T>(url: string, schema?: z.ZodSchema<T>): Promise<T> {
    const response = await api.get(url);
    return schema ? schema.parse(response.data) : response.data;
  },

  async post<T>(
    url: string,
    data?: unknown,
    schema?: z.ZodSchema<T>,
  ): Promise<T> {
    const response = await api.post(url, data);
    return schema ? schema.parse(response.data) : response.data;
  },

  async put<T>(
    url: string,
    data?: unknown,
    schema?: z.ZodSchema<T>,
  ): Promise<T> {
    const response = await api.put(url, data);
    return schema ? schema.parse(response.data) : response.data;
  },

  async patch<T>(
    url: string,
    data?: unknown,
    schema?: z.ZodSchema<T>,
  ): Promise<T> {
    const response = await api.patch(url, data);
    return schema ? schema.parse(response.data) : response.data;
  },

  async delete<T>(url: string, schema?: z.ZodSchema<T>): Promise<T> {
    const response = await api.delete(url);
    return schema ? schema.parse(response.data) : response.data;
  },
};

// Retry utility for failed requests
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxAttempts = MAX_RETRY_ATTEMPTS,
  delay = RETRY_DELAY,
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry authentication errors
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      // Don't retry validation errors
      if (error instanceof ValidationError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};

// Error handling utility
export function handleApiError(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
}

// Type-safe request wrapper
export function createTypedRequest<TRequest, TResponse>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  requestSchema?: z.ZodSchema<TRequest>,
  responseSchema?: z.ZodSchema<TResponse>,
) {
  return async (data?: TRequest): Promise<TResponse> => {
    // Validate request data if schema provided
    const validatedData = requestSchema ? requestSchema.parse(data) : data;

    let response: AxiosResponse;
    switch (method) {
      case "GET":
        response = await api.get(url);
        break;
      case "POST":
        response = await api.post(url, validatedData);
        break;
      case "PUT":
        response = await api.put(url, validatedData);
        break;
      case "PATCH":
        response = await api.patch(url, validatedData);
        break;
      case "DELETE":
        response = await api.delete(url);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Validate response if schema provided
    return responseSchema
      ? responseSchema.parse(response.data)
      : (response.data as TResponse);
  };
}

// Export the token manager for use in other parts of the app
export { TokenManager };

// Export default api instance
export default api;
