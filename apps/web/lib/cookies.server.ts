import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { CookieConfig } from "@/schemas/auth.schema";

// Cookie names (same as client)
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "__Secure-gl-access-token",
  REFRESH_TOKEN: "__Secure-gl-refresh-token",
  CSRF_TOKEN: "__Secure-gl-csrf-token",
  SESSION_ID: "__Secure-gl-session-id",
  DEVICE_ID: "__Secure-gl-device-id",
} as const;

// Environment-based configuration
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN;
const SECURE_COOKIES = process.env.NEXT_PUBLIC_SECURE_COOKIES !== "false";

// Server-side cookie configurations (including HTTPOnly cookies)
export const SERVER_COOKIE_CONFIGS: Record<
  keyof typeof COOKIE_NAMES,
  CookieConfig
> = {
  ACCESS_TOKEN: {
    name: COOKIE_NAMES.ACCESS_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  REFRESH_TOKEN: {
    name: COOKIE_NAMES.REFRESH_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  CSRF_TOKEN: {
    name: COOKIE_NAMES.CSRF_TOKEN,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false,
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  SESSION_ID: {
    name: COOKIE_NAMES.SESSION_ID,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
  DEVICE_ID: {
    name: COOKIE_NAMES.DEVICE_ID,
    secure: IS_PRODUCTION || SECURE_COOKIES,
    httpOnly: false,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: "/",
    domain: IS_PRODUCTION ? DOMAIN : undefined,
  },
};

/**
 * Server-side cookie manager for Next.js middleware and API routes
 */
export class ServerCookieManager {
  /**
   * Get a cookie from the request
   */
  static getCookie(request: NextRequest, name: string): string | undefined {
    return request.cookies.get(name)?.value;
  }

  /**
   * Set a cookie in the response
   */
  static setCookie(
    response: NextResponse,
    name: string,
    value: string,
    config?: Partial<CookieConfig>,
  ): NextResponse {
    const cookieConfig = config || SERVER_COOKIE_CONFIGS[name as keyof typeof COOKIE_NAMES];
    
    response.cookies.set({
      name,
      value,
      ...cookieConfig,
    });

    return response;
  }

  /**
   * Delete a cookie from the response
   */
  static deleteCookie(response: NextResponse, name: string): NextResponse {
    response.cookies.delete(name);
    return response;
  }

  /**
   * Get access token from request cookies
   */
  static getAccessToken(request: NextRequest): string | undefined {
    return this.getCookie(request, COOKIE_NAMES.ACCESS_TOKEN);
  }

  /**
   * Get refresh token from request cookies
   */
  static getRefreshToken(request: NextRequest): string | undefined {
    return this.getCookie(request, COOKIE_NAMES.REFRESH_TOKEN);
  }

  /**
   * Get CSRF token from request cookies
   */
  static getCsrfToken(request: NextRequest): string | undefined {
    return this.getCookie(request, COOKIE_NAMES.CSRF_TOKEN);
  }

  /**
   * Get session ID from request cookies
   */
  static getSessionId(request: NextRequest): string | undefined {
    return this.getCookie(request, COOKIE_NAMES.SESSION_ID);
  }

  /**
   * Get device ID from request cookies
   */
  static getDeviceId(request: NextRequest): string | undefined {
    return this.getCookie(request, COOKIE_NAMES.DEVICE_ID);
  }

  /**
   * Set authentication cookies (access token, refresh token, session ID)
   */
  static setAuthCookies(
    response: NextResponse,
    tokens: {
      accessToken: string;
      refreshToken: string;
      sessionId: string;
      csrfToken: string;
    },
  ): NextResponse {
    this.setCookie(response, COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken);
    this.setCookie(response, COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken);
    this.setCookie(response, COOKIE_NAMES.SESSION_ID, tokens.sessionId);
    this.setCookie(response, COOKIE_NAMES.CSRF_TOKEN, tokens.csrfToken);
    return response;
  }

  /**
   * Clear all authentication cookies
   */
  static clearAuthCookies(response: NextResponse): NextResponse {
    this.deleteCookie(response, COOKIE_NAMES.ACCESS_TOKEN);
    this.deleteCookie(response, COOKIE_NAMES.REFRESH_TOKEN);
    this.deleteCookie(response, COOKIE_NAMES.SESSION_ID);
    this.deleteCookie(response, COOKIE_NAMES.CSRF_TOKEN);
    return response;
  }
}

/**
 * Server Components cookie manager (uses next/headers cookies())
 */
export class ServerComponentCookieManager {
  /**
   * Get a cookie in Server Components
   */
  static async getCookie(name: string): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(name)?.value;
  }

  /**
   * Get access token in Server Components
   */
  static async getAccessToken(): Promise<string | undefined> {
    return this.getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  }

  /**
   * Get refresh token in Server Components
   */
  static async getRefreshToken(): Promise<string | undefined> {
    return this.getCookie(COOKIE_NAMES.REFRESH_TOKEN);
  }

  /**
   * Get CSRF token in Server Components
   */
  static async getCsrfToken(): Promise<string | undefined> {
    return this.getCookie(COOKIE_NAMES.CSRF_TOKEN);
  }

  /**
   * Get session ID in Server Components
   */
  static async getSessionId(): Promise<string | undefined> {
    return this.getCookie(COOKIE_NAMES.SESSION_ID);
  }

  /**
   * Get device ID in Server Components
   */
  static async getDeviceId(): Promise<string | undefined> {
    return this.getCookie(COOKIE_NAMES.DEVICE_ID);
  }
}