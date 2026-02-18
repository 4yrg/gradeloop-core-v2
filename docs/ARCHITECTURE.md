# Authentication Architecture: Cookie-Based Token Delivery

## Decision Record

**Date:** 2026-02-19  
**Status:** Adopted  
**Deciders:** Core Team

## Context

The application requires a secure authentication mechanism that:
- Protects tokens from XSS attacks
- Supports SSR/Next.js proxy architecture
- Enables CSRF protection without server-side session storage
- Maintains backward compatibility during migration

## Decision: Server-Set Cookie Pattern

We adopt a **Server-Set Cookie Pattern** for token storage and transport.

### Token Configuration

| Token          | Storage                          | Transport                              | TTL      | Purpose           |
|----------------|----------------------------------|----------------------------------------|----------|-------------------|
| `access_token` | HttpOnly, Secure, SameSite=Lax   | Cookie (primary) + Authorization header (fallback) | 15 min   | API authentication |
| `refresh_token`| HttpOnly, Secure, SameSite=Lax   | Cookie only                            | 30 days  | Token rotation    |
| `csrf_token`   | Readable (non-HttpOnly)          | Cookie + X-CSRF-Token header           | 15 min   | CSRF protection   |

### Why This Pattern?

✅ **Mitigates XSS token theft** - Refresh token never touches JavaScript  
✅ **Works with SSR/Next.js proxy** - Cookies forward naturally through proxy layers  
✅ **Enables double-submit CSRF** - Without server-side session storage overhead  
✅ **Backward-compatible** - Middleware accepts header or cookie during transition period  

## Implementation Details

### Backend (Go/Fiber)

#### Cookie Configuration

```go
// Access token cookie
c.Cookie(&fiber.Cookie{
    Name:     "access_token",
    Value:    accessToken,
    Path:     "/",
    MaxAge:   900, // 15 min
    HTTPOnly: true,
    Secure:   cfg.Env == "production",
    SameSite: "lax",
})

// Refresh token cookie
c.Cookie(&fiber.Cookie{
    Name:     "refresh_token",
    Value:    refreshToken,
    Path:     "/",
    MaxAge:   2592000, // 30 days
    HTTPOnly: true,
    Secure:   cfg.Env == "production",
    SameSite: "lax",
})

// CSRF token cookie
c.Cookie(&fiber.Cookie{
    Name:     "csrf_token",
    Value:    csrfToken,
    Path:     "/",
    MaxAge:   900, // 15 min
    HTTPOnly: false, // Must be readable by JS
    Secure:   cfg.Env == "production",
    SameSite: "lax",
})
```

#### Auth Middleware (Dual Token Support)

```go
func AuthMiddleware() fiber.Handler {
    return func(c fiber.Ctx) error {
        // Priority: Authorization header > access_token cookie
        var tokenString string

        authHeader := c.Get("Authorization")
        if authHeader != "" {
            tokenString = strings.TrimPrefix(authHeader, "Bearer ")
        } else {
            tokenString = c.Cookies("access_token")
        }

        if tokenString == "" {
            return c.Status(fiber.StatusUnauthorized).JSON(
                fiber.Map{"error": "Missing authentication token"})
        }

        // ... JWT validation logic
    }
}
```

#### CSRF Middleware (Double-Submit Pattern)

```go
func CSRFMiddleware() fiber.Handler {
    return func(c fiber.Ctx) error {
        // Skip CSRF check for safe methods
        if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead {
            return c.Next()
        }

        cookieToken := c.Cookies("csrf_token")
        headerToken := c.Get("X-CSRF-Token")

        if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
            return c.Status(fiber.StatusForbidden).JSON(
                fiber.Map{"error": "Invalid CSRF token"})
        }

        return c.Next()
    }
}
```

### Frontend (React/Next.js)

#### Token Storage Strategy

- **Remove** `localStorage`/`sessionStorage` for `access_token` and `refresh_token`
- **Keep** in-memory or cookie-based `csrf_token` management
- **Keep** minimal session cookie for UI rendering (permissions, user_id)

#### API Client Updates

```typescript
// Request interceptor for mutating requests
if (['POST','PUT','PATCH','DELETE'].includes(method)) {
    const csrf = getCSRFToken(); // Read from cookie
    if (csrf) headers['X-CSRF-Token'] = csrf;
}
```

#### Login Flow

1. Submit credentials to `POST /api/auth/login`
2. Server sets cookies (`access_token`, `refresh_token`, `csrf_token`)
3. Client reads `csrf_token` from cookie for future requests
4. **Optional:** Prefetch `/api/auth/session` to validate before redirect
5. Redirect to dashboard

## Security Considerations

### Cookie Flags

| Flag         | Value     | Rationale                                      |
|--------------|-----------|------------------------------------------------|
| `HttpOnly`   | true      | Prevents XSS token theft (access/refresh)      |
| `Secure`     | production| Ensures HTTPS-only transmission                |
| `SameSite`   | Lax       | Prevents CSRF while allowing navigation        |
| `Path`       | /         | Available across entire application            |

### CSRF Protection

- Double-submit pattern: cookie value must match `X-CSRF-Token` header
- Applied to all mutating operations (POST, PUT, PATCH, DELETE)
- GET/HEAD requests exempted for usability

### Token Rotation

- Refresh tokens are rotated on each use
- Old refresh token is invalidated immediately
- New access + refresh tokens issued together

## Migration Strategy

### Phase 1: Backend Changes
1. Update login handler to set cookies
2. Update refresh handler to rotate tokens
3. Update auth middleware to accept cookie or header
4. Implement CSRF middleware

### Phase 2: Frontend Changes
1. Remove client-side token storage
2. Update API client to attach CSRF header
3. Add session validation before redirect
4. Ensure Next.js proxy forwards cookies

### Phase 3: Cleanup & Testing
1. Remove legacy auth handlers
2. Add end-to-end tests
3. Add monitoring and alerting
4. Gradual rollout with rollback plan

## Rollback Plan

If issues arise post-deployment:

1. **Backend remains compatible** - Dual token support (header + cookie) allows old frontend to work
2. **Frontend rollback only** - Revert frontend changes; backend continues serving header-based auth
3. **Monitoring triggers:**
   - 5% increase in auth failures
   - SSR pages returning 401 unexpectedly
   - Spike in 403 CSRF errors

## Testing Checklist

- [ ] Browser DevTools shows all 3 cookies with correct flags
- [ ] JSON response does not contain `refresh_token`
- [ ] Requests with `Authorization: Bearer <token>` still work
- [ ] Requests with `access_token` cookie work
- [ ] GET requests bypass CSRF check
- [ ] POST/PUT/PATCH/DELETE require matching CSRF token
- [ ] Refresh call updates both token cookies
- [ ] Old refresh token is invalidated after rotation
- [ ] SSR protected pages load without 401
- [ ] Playwright e2e: full login → protected page flow

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Fiber Cookie Documentation](https://docs.gofiber.io/api/ctx#cookie)
