import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JWTManager, TokenExpiredError, TokenInvalidError } from "./lib/jwt";
import { ServerCookieManager, COOKIE_NAMES } from "./lib/cookies.server";
import { CSRFTokenManager } from "./lib/jwt";

// Route configuration
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/courses",
  "/assignments",
  "/grades",
  "/settings",
];

const ADMIN_ROUTES = ["/admin", "/analytics", "/reports", "/users"];

const FACULTY_ROUTES = [
  "/courses/manage",
  "/assignments/create",
  "/assignments/grade",
  "/students",
];

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  general: { maxRequests: 1000, windowMs: 60 * 1000 }, // 1000 requests per minute
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

class MiddlewareError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public redirectTo?: string,
  ) {
    super(message);
    this.name = "MiddlewareError";
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  try {
    // Skip middleware for static assets and API routes that don't need auth
    if (shouldSkipMiddleware(pathname)) {
      return response;
    }

    // Apply rate limiting
    await applyRateLimit(request);

    // Handle CSRF protection for state-changing requests
    if (isStateMutatingRequest(request)) {
      await validateCSRFToken(request);
    }

    // Get authentication status
    const authResult = await getAuthenticationStatus(request);

    // Handle public routes
    if (isPublicRoute(pathname)) {
      // Redirect authenticated users away from auth pages
      if (authResult.isAuthenticated && isAuthRoute(pathname)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return addSecurityHeaders(response);
    }

    // Handle protected routes
    if (isProtectedRoute(pathname)) {
      if (!authResult.isAuthenticated) {
        return redirectToLogin(request);
      }

      // Check role-based access for admin routes
      if (isAdminRoute(pathname) && !hasAdminAccess(authResult.user)) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Check role-based access for faculty routes
      if (isFacultyRoute(pathname) && !hasFacultyAccess(authResult.user)) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Refresh token if needed
      if (authResult.shouldRefresh) {
        return await handleTokenRefresh(request, response);
      }

      // Update last activity
      updateLastActivity(response, authResult.sessionId);
    }

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Middleware error:", error);

    if (error instanceof MiddlewareError) {
      if (error.redirectTo) {
        return NextResponse.redirect(new URL(error.redirectTo, request.url));
      }
      return new NextResponse("Access denied", { status: error.statusCode });
    }

    // Fallback for unexpected errors
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Helper functions

function shouldSkipMiddleware(pathname: string): boolean {
  const skipPatterns = [
    /^\/api\/auth\//, // Auth API routes handle their own middleware
    /^\/api\/health/, // Health check endpoints
    /^\/_next\//, // Next.js internal files
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
    /^\/sitemap\.xml$/,
    /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/,
  ];

  return skipPatterns.some((pattern) => pattern.test(pathname));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  });
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

function isProtectedRoute(pathname: string): boolean {
  // If not public, it's protected
  return !isPublicRoute(pathname);
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route));
}

function isFacultyRoute(pathname: string): boolean {
  return FACULTY_ROUTES.some((route) => pathname.startsWith(route));
}

function isStateMutatingRequest(request: NextRequest): boolean {
  const method = request.method;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

async function applyRateLimit(request: NextRequest): Promise<void> {
  const clientIP = getClientIP(request);
  const pathname = request.nextUrl.pathname;

  let config = RATE_LIMIT_CONFIG.general;

  if (pathname.startsWith("/api/auth/")) {
    config = RATE_LIMIT_CONFIG.auth;
  } else if (pathname.startsWith("/api/")) {
    config = RATE_LIMIT_CONFIG.api;
  }

  const key = `${clientIP}:${pathname.startsWith("/api/auth/") ? "auth" : "general"}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let rateLimitData = rateLimitStore.get(key);

  if (!rateLimitData || rateLimitData.resetTime <= windowStart) {
    rateLimitData = { count: 1, resetTime: now + config.windowMs };
  } else {
    rateLimitData.count++;
  }

  rateLimitStore.set(key, rateLimitData);

  // Clean up old entries
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    cleanupRateLimitStore();
  }

  if (rateLimitData.count > config.maxRequests) {
    const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
    throw new MiddlewareError(`Rate limit exceeded`, 429);
  }
}

async function validateCSRFToken(request: NextRequest): Promise<void> {
  // Skip CSRF validation for auth endpoints (they handle it internally)
  if (request.nextUrl.pathname.startsWith("/api/auth/")) {
    return;
  }

  const headerToken = request.headers.get("X-CSRF-Token");
  const cookieToken = request.cookies.get(COOKIE_NAMES.CSRF_TOKEN)?.value;

  if (!headerToken || !cookieToken) {
    throw new MiddlewareError("CSRF token missing", 403);
  }

  if (!CSRFTokenManager.validateToken(headerToken, cookieToken)) {
    throw new MiddlewareError("Invalid CSRF token", 403);
  }
}

async function getAuthenticationStatus(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  user: any;
  sessionId: string | null;
  shouldRefresh: boolean;
}> {
  const accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const refreshToken = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;
  const sessionId = request.cookies.get(COOKIE_NAMES.SESSION_ID)?.value;

  if (!accessToken || !refreshToken || !sessionId) {
    return {
      isAuthenticated: false,
      user: null,
      sessionId: null,
      shouldRefresh: false,
    };
  }

  try {
    // Verify access token
    const payload = await JWTManager.verifyAccessToken(accessToken);

    // Check if token should be refreshed (5 minutes before expiry)
    const timeUntilExpiry = payload.exp * 1000 - Date.now();
    const shouldRefresh = timeUntilExpiry <= 5 * 60 * 1000; // 5 minutes

    return {
      isAuthenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        user_type: payload.user_type,
        roles: payload.roles,
        permissions: payload.permissions,
      },
      sessionId: payload.session_id,
      shouldRefresh,
    };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      try {
        const refreshPayload =
          await JWTManager.verifyRefreshToken(refreshToken);
        return {
          isAuthenticated: true,
          user: null, // Will be populated after refresh
          sessionId: refreshPayload.session_id,
          shouldRefresh: true,
        };
      } catch (refreshError) {
        // Refresh token also invalid
        return {
          isAuthenticated: false,
          user: null,
          sessionId: null,
          shouldRefresh: false,
        };
      }
    }

    return {
      isAuthenticated: false,
      user: null,
      sessionId: null,
      shouldRefresh: false,
    };
  }
}

function hasAdminAccess(user: any): boolean {
  if (!user) return false;

  const adminRoles = ["admin", "super_admin"];
  const adminPermissions = ["admin", "users:manage", "institution:manage"];

  return (
    user.roles?.some((role: string) => adminRoles.includes(role)) ||
    user.permissions?.some((permission: string) =>
      adminPermissions.includes(permission),
    )
  );
}

function hasFacultyAccess(user: any): boolean {
  if (!user) return false;

  const facultyRoles = [
    "faculty",
    "instructor",
    "teacher",
    "admin",
    "super_admin",
  ];
  const facultyPermissions = [
    "courses:manage",
    "assignments:create",
    "assignments:grade",
    "students:view",
  ];

  return (
    user.roles?.some((role: string) => facultyRoles.includes(role)) ||
    user.permissions?.some((permission: string) =>
      facultyPermissions.includes(permission),
    )
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);

  // Add return URL for post-login redirect
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
  }

  return NextResponse.redirect(loginUrl);
}

async function handleTokenRefresh(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  try {
    // Make internal request to refresh endpoint
    const refreshResponse = await fetch(
      `${request.nextUrl.origin}/api/auth/refresh`,
      {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      },
    );

    if (refreshResponse.ok) {
      // Copy new cookies to response
      const setCookieHeaders = refreshResponse.headers.getSetCookie();
      setCookieHeaders.forEach((cookie) => {
        response.headers.append("Set-Cookie", cookie);
      });

      return response;
    } else {
      // Refresh failed, redirect to login
      return redirectToLogin(request);
    }
  } catch (error) {
    console.error("Token refresh in middleware failed:", error);
    return redirectToLogin(request);
  }
}

function updateLastActivity(
  response: NextResponse,
  sessionId: string | null,
): void {
  if (sessionId) {
    // Add header to trigger activity update in API
    response.headers.set("X-Update-Activity", "true");
  }
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: Adjust for production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );

  return response;
}

function getClientIP(request: NextRequest): string {
  // Try different headers for client IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return "unknown";
}

function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled separately)
     * - _next (static files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - common static files
     */
    "/((?!api/auth|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*$).*)",
  ],
};
