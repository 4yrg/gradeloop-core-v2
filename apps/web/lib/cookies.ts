import { cookies } from "next/headers";
import type { CookieConfig } from "@/schemas/auth.schema";

// Environment-based configuration
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN;
const SECURE_COOKIES = process.env.NEXT_PUBLIC_SECURE_COOKIES !== "false";

// Cookie names (prefixed for security)
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "__Secure-gl-access-token",
  REFRESH_TOKEN: "__Secure-gl-refresh-token",
  CSRF_TOKEN: "__Secure-gl-csrf-token",
  SESSION_ID: "__Secure-gl-session-id",
  DEVICE_ID: "__Secure-gl-device-id",
} as const;

// Cookie configurations with security defaults
export const COOKIE_CONFIGS: Record<keyof typeof COOKIE_NAMES, CookieConfig> = {
  ACCESS_TOKEN: {
    name: COOKIE_NAMES.ACCESS_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false, // Client needs access for Authorization headers
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  REFRESH_TOKEN: {
    name: COOKIE_NAMES.REFRESH_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false, // Client needs access for refresh requests
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  CSRF_TOKEN: {
    name: COOKIE_NAMES.CSRF_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false, // Needs to be accessible by client for CSRF protection
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes (same as access token)
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  SESSION_ID: {
    name: COOKIE_NAMES.SESSION_ID,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false, // Client needs access for session management
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  DEVICE_ID: {
    name: COOKIE_NAMES.DEVICE_ID,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false, // Client may need access for device management
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
};

// Cookie utility class for server-side operations
export class ServerCookieManager {
  private cookieStore: ReturnType<typeof cookies>;

  constructor() {
    this.cookieStore = cookies();
  }

  /**
   * Set a secure cookie with proper configuration
   */
  setCookie(
    name: keyof typeof COOKIE_NAMES,
    value: string,
    options?: Partial<CookieConfig>,
  ): void {
    const config = COOKIE_CONFIGS[name];
    const finalConfig = { ...config, ...options };

    this.cookieStore.set(finalConfig.name, value, {
      secure: finalConfig.secure,
      httpOnly: finalConfig.httpOnly,
      sameSite: finalConfig.sameSite,
      maxAge: finalConfig.maxAge,
      path: finalConfig.path,
      domain: finalConfig.domain,
    });
  }

  /**
   * Get a cookie value by name
   */
  getCookie(name: keyof typeof COOKIE_NAMES): string | undefined {
    const config = COOKIE_CONFIGS[name];
    return this.cookieStore.get(config.name)?.value;
  }

  /**
   * Delete a cookie by setting it to expire immediately
   */
  deleteCookie(name: keyof typeof COOKIE_NAMES): void {
    const config = COOKIE_CONFIGS[name];
    this.cookieStore.set(config.name, "", {
      secure: config.secure,
      httpOnly: config.httpOnly,
      sameSite: config.sameSite,
      maxAge: 0, // Expire immediately
      path: config.path,
      domain: config.domain,
    });
  }

  /**
   * Set authentication cookies (access + refresh + session)
   */
  setAuthCookies(
    accessToken: string,
    refreshToken: string,
    sessionId: string,
    csrfToken: string,
  ): void {
    this.setCookie("ACCESS_TOKEN", accessToken);
    this.setCookie("REFRESH_TOKEN", refreshToken);
    this.setCookie("SESSION_ID", sessionId);
    this.setCookie("CSRF_TOKEN", csrfToken);
  }

  /**
   * Clear all authentication cookies
   */
  clearAuthCookies(): void {
    this.deleteCookie("ACCESS_TOKEN");
    this.deleteCookie("REFRESH_TOKEN");
    this.deleteCookie("SESSION_ID");
    this.deleteCookie("CSRF_TOKEN");
  }

  /**
   * Get all authentication cookies
   */
  getAuthCookies(): {
    accessToken?: string;
    refreshToken?: string;
    sessionId?: string;
    csrfToken?: string;
  } {
    return {
      accessToken: this.getCookie("ACCESS_TOKEN"),
      refreshToken: this.getCookie("REFRESH_TOKEN"),
      sessionId: this.getCookie("SESSION_ID"),
      csrfToken: this.getCookie("CSRF_TOKEN"),
    };
  }

  /**
   * Check if user has valid auth cookies
   */
  hasAuthCookies(): boolean {
    const { accessToken, refreshToken, sessionId } = this.getAuthCookies();
    return !!(accessToken && refreshToken && sessionId);
  }

  /**
   * Set device ID for device tracking
   */
  setDeviceId(deviceId: string): void {
    this.setCookie("DEVICE_ID", deviceId);
  }

  /**
   * Get device ID
   */
  getDeviceId(): string | undefined {
    return this.getCookie("DEVICE_ID");
  }
}

// Client-side cookie utilities for non-HTTP-only cookies
export class ClientCookieManager {
  /**
   * Get a client-accessible cookie (non-HTTP-only)
   */
  static getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(";").shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  }

  /**
   * Set a client-side cookie
   */
  static setCookie(
    name: string,
    value: string,
    options: Partial<CookieConfig> = {},
  ): void {
    if (typeof document === "undefined") return;

    let cookieString = `${name}=${value}`;

    if (options.maxAge) {
      const expires = new Date(Date.now() + options.maxAge * 1000);
      cookieString += `; expires=${expires.toUTCString()}`;
    }

    if (options.path) {
      cookieString += `; path=${options.path}`;
    }

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    if (options.secure) {
      cookieString += "; secure";
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieString;
  }

  /**
   * Delete a client-side cookie
   */
  static deleteCookie(name: string, path = "/"): void {
    if (typeof document === "undefined") return;

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
  }

  /**
   * Get CSRF token for client-side requests
   */
  static getCsrfToken(): string | null {
    return this.getCookie(COOKIE_NAMES.CSRF_TOKEN);
  }

  /**
   * Get access token from cookies
   */
  static getAccessToken(): string | null {
    return this.getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  }

  /**
   * Get refresh token from cookies
   */
  static getRefreshToken(): string | null {
    return this.getCookie(COOKIE_NAMES.REFRESH_TOKEN);
  }

  /**
   * Get session ID from cookies
   */
  static getSessionId(): string | null {
    return this.getCookie(COOKIE_NAMES.SESSION_ID);
  }
}

// Cookie security validation utilities
export class CookieSecurityValidator {
  /**
   * Validate cookie configuration for security compliance
   */
  static validateConfig(config: CookieConfig): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check for secure flag in production
    if (IS_PRODUCTION && !config.secure) {
      violations.push("Secure flag must be set in production");
    }

    // Check for HTTPOnly for sensitive cookies
    if (
      (config.name.includes("token") || config.name.includes("session")) &&
      !config.httpOnly &&
      config.name !== COOKIE_NAMES.CSRF_TOKEN
    ) {
      violations.push("HTTPOnly must be set for authentication cookies");
    }

    // Check SameSite attribute
    if (!config.sameSite || config.sameSite === "none") {
      if (!config.secure) {
        violations.push("SameSite=None requires Secure flag");
      }
    }

    // Check cookie name prefixes for secure cookies
    if (config.secure && !config.name.startsWith("__Secure-")) {
      violations.push("Secure cookies should use __Secure- prefix");
    }

    // Check max age limits
    const MAX_AGES = {
      ACCESS_TOKEN: 30 * 60, // 30 minutes max
      REFRESH_TOKEN: 90 * 24 * 60 * 60, // 90 days max
      SESSION_ID: 90 * 24 * 60 * 60, // 90 days max
    };

    Object.entries(MAX_AGES).forEach(([type, maxAllowed]) => {
      if (config.name.toLowerCase().includes(type.toLowerCase())) {
        if (config.maxAge > maxAllowed) {
          violations.push(
            `${type} maxAge (${config.maxAge}s) exceeds recommended maximum (${maxAllowed}s)`,
          );
        }
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Audit all cookie configurations
   */
  static auditAllConfigs(): {
    isCompliant: boolean;
    results: Array<{
      cookieName: string;
      isValid: boolean;
      violations: string[];
    }>;
  } {
    const results = Object.entries(COOKIE_CONFIGS).map(([name, config]) => {
      const validation = this.validateConfig(config);
      return {
        cookieName: name,
        ...validation,
      };
    });

    const isCompliant = results.every((result) => result.isValid);

    return {
      isCompliant,
      results,
    };
  }
}

// Utility functions for cookie operations
export const cookieUtils = {
  /**
   * Generate a secure device ID
   */
  generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2);
    return `${timestamp}-${randomPart}`;
  },

  /**
   * Parse cookie string into object
   */
  parseCookieString(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    cookieString.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  },

  /**
   * Format cookies for HTTP headers
   */
  formatCookiesForHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join("; ");
  },

  /**
   * Check if cookies are enabled in browser
   */
  areCookiesEnabled(): boolean {
    if (typeof document === "undefined") return false;

    try {
      const testCookie = "test_cookie";
      document.cookie = `${testCookie}=test; path=/`;
      const enabled = document.cookie.indexOf(testCookie) !== -1;

      // Clean up test cookie
      if (enabled) {
        document.cookie = `${testCookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      }

      return enabled;
    } catch {
      return false;
    }
  },
};

// Export singleton instances
export const serverCookies = new ServerCookieManager();
export const clientCookies = ClientCookieManager;
export const cookieSecurity = CookieSecurityValidator;

// Development helpers
if (IS_DEVELOPMENT) {
  // Log cookie security audit in development
  const audit = CookieSecurityValidator.auditAllConfigs();
  if (!audit.isCompliant) {
    console.warn("Cookie Security Audit Failed:", audit.results);
  }
}
