import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { z } from "zod";
import { JWTManager, TokenExpiredError, CSRFTokenManager } from "./jwt";
import { ClientCookieManager, COOKIE_NAMES } from "./cookies";
import { useAuthStore } from "@/store/auth.store";
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SessionValidationResponse,
  AuthError,
} from "@/schemas/auth.schema";

// API Configuration - Direct to IAM service
const IAM_SERVICE_URL =
  process.env.NEXT_PUBLIC_IAM_SERVICE_URL || "http://localhost:3001";
const API_BASE_URL = `${IAM_SERVICE_URL}/api/v1`;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// Response schemas for validation based on IAM service
const IAMAuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    is_active: z.boolean(),
    user_type: z.enum(["student", "employee"]),
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
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    is_active: z.boolean(),
    user_type: z.enum(["student", "employee"]),
    roles: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        permissions: z.array(z.string()),
      }),
    ),
  }),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  error_code: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

// Enhanced API Error classes
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: any,
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
  constructor(message = "Request validation failed", data?: any) {
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

// Token Management for cookie-based auth
class TokenManager {
  private static refreshPromise: Promise<void> | null = null;
  private static refreshing = false;

  /**
   * Store tokens in secure HTTP-only cookies via document.cookie
   * This is a fallback for client-side token storage
   */
  static storeTokens(
    accessToken: string,
    refreshToken: string,
    sessionId: string,
  ): void {
    // Generate CSRF token for double-submit cookie pattern
    const csrfToken = CSRFTokenManager.generateToken();

    // Store access token (shorter expiry)
    ClientCookieManager.setCookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Client needs access for Authorization header
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    // Store refresh token (longer expiry)
    ClientCookieManager.setCookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Client needs access for refresh requests
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    // Store session ID
    ClientCookieManager.setCookie(COOKIE_NAMES.SESSION_ID, sessionId, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    // Store CSRF token (client accessible for headers)
    ClientCookieManager.setCookie(COOKIE_NAMES.CSRF_TOKEN, csrfToken, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Must be accessible for CSRF protection
      sameSite: "lax",
      maxAge: 15 * 60, // Same as access token
      path: "/",
    });
  }

  /**
   * Get stored access token
   */
  static getAccessToken(): string | null {
    return ClientCookieManager.getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  }

  /**
   * Get stored refresh token
   */
  static getRefreshToken(): string | null {
    return ClientCookieManager.getCookie(COOKIE_NAMES.REFRESH_TOKEN);
  }

  /**
   * Get stored session ID
   */
  static getSessionId(): string | null {
    return ClientCookieManager.getCookie(COOKIE_NAMES.SESSION_ID);
  }

  /**
   * Get CSRF token for headers
   */
  static getCSRFToken(): string | null {
    return ClientCookieManager.getCookie(COOKIE_NAMES.CSRF_TOKEN);
  }

  /**
   * Clear all stored tokens
   */
  static clearTokens(): void {
    ClientCookieManager.deleteCookie(COOKIE_NAMES.ACCESS_TOKEN);
    ClientCookieManager.deleteCookie(COOKIE_NAMES.REFRESH_TOKEN);
    ClientCookieManager.deleteCookie(COOKIE_NAMES.SESSION_ID);
    ClientCookieManager.deleteCookie(COOKIE_NAMES.CSRF_TOKEN);
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

      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new AuthenticationError("No refresh token available");
      }

      // Call IAM service refresh endpoint
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const refreshData = IAMRefreshResponseSchema.parse(response.data);

      // Store new tokens
      this.storeTokens(
        refreshData.access_token,
        refreshData.refresh_token,
        refreshData.user.id, // Use user ID as session ID for now
      );

      // Update auth store
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

    // Redirect to login if in browser
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
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
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for authentication and CSRF
api.interceptors.request.use(
  async (config) => {
    // Skip token injection for auth endpoints that don't need tokens
    const noTokenEndpoints = [
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
    ];
    const isNoTokenEndpoint = noTokenEndpoints.some((endpoint) =>
      config.url?.includes(endpoint),
    );

    if (!isNoTokenEndpoint) {
      // Check if token should be refreshed before request
      if (TokenManager.shouldRefreshToken()) {
        try {
          await TokenManager.refreshAccessToken();
        } catch (error) {
          console.error("Pre-request refresh failed:", error);
        }
      }

      // Get and inject access token
      const token = TokenManager.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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

    // Update activity timestamp
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated) {
      authStore.updateLastActivity();
    }

    return config;
  },
  (error) => {
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

          // Retry original request with new token
          const newToken = TokenManager.getAccessToken();
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
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
      case 429:
        const retryAfter = error.response.headers["retry-after"];
        return Promise.reject(
          new RateLimitError(
            errorMessage,
            retryAfter ? parseInt(retryAfter) : undefined,
          ),
        );
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
    user: any;
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    session_id: string;
  }> {
    const response = await api.post("/auth/login", credentials);
    const authData = IAMAuthResponseSchema.parse(response.data);

    // Store tokens in cookies
    TokenManager.storeTokens(
      authData.access_token,
      authData.refresh_token,
      authData.user.id, // Use user ID as session ID for now
    );

    return {
      user: authData.user,
      access_token: authData.access_token,
      token_type: "Bearer" as const,
      expires_in: 900, // 15 minutes in seconds
      session_id: authData.user.id,
    };
  },

  async refresh(): Promise<{
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    session_id: string;
  }> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new AuthenticationError("No refresh token available");
    }

    const response = await api.post("/auth/refresh", {
      refresh_token: refreshToken,
    });

    const refreshData = IAMRefreshResponseSchema.parse(response.data);

    // Store new tokens
    TokenManager.storeTokens(
      refreshData.access_token,
      refreshData.refresh_token,
      refreshData.user.id,
    );

    return {
      access_token: refreshData.access_token,
      token_type: "Bearer" as const,
      expires_in: 900, // 15 minutes in seconds
      session_id: refreshData.user.id,
    };
  },

  async logout(): Promise<{ message: string }> {
    // Clear tokens locally
    TokenManager.clearTokens();

    // Clear auth store
    const authStore = useAuthStore.getState();
    authStore.logout();

    return { message: "Logged out successfully" };
  },

  async validateSession(): Promise<{
    valid: boolean;
    user?: any;
  }> {
    try {
      const response = await api.get("/auth/validate");
      return {
        valid: response.status === 200,
        user: response.data?.user,
      };
    } catch {
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
    const response = await api.post("/auth/forgot-password", data);
    return response.data;
  },

  async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<{ message: string }> {
    const response = await api.post("/auth/reset-password", data);
    return response.data;
  },

  // User methods
  async getCurrentUser() {
    const response = await api.get("/users/me");
    return response.data;
  },

  async updateProfile(data: any) {
    const response = await api.patch("/users/me", data);
    return response.data;
  },

  // Generic CRUD operations with validation
  async get<T>(url: string, schema?: z.ZodSchema<T>): Promise<T> {
    const response = await api.get(url);
    return schema ? schema.parse(response.data) : response.data;
  },

  async post<T>(url: string, data?: any, schema?: z.ZodSchema<T>): Promise<T> {
    const response = await api.post(url, data);
    return schema ? schema.parse(response.data) : response.data;
  },

  async put<T>(url: string, data?: any, schema?: z.ZodSchema<T>): Promise<T> {
    const response = await api.put(url, data);
    return schema ? schema.parse(response.data) : response.data;
  },

  async patch<T>(url: string, data?: any, schema?: z.ZodSchema<T>): Promise<T> {
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
export const createTypedRequest = <TResponse, TRequest = any>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  responseSchema: z.ZodSchema<TResponse>,
  requestSchema?: z.ZodSchema<TRequest>,
) => {
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

    return responseSchema.parse(response.data);
  };
};

// Export the token manager for use in other parts of the app
export { TokenManager };

// Export default api instance
export default api;
