# GradeLoop Authentication System

A production-grade session management system built for GradeLoop's AI-integrated LMS, featuring secure JWT tokens, rotating refresh tokens, and comprehensive security hardening.

## 🏗️ Architecture Overview

### System Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   IAM Service   │    │   PostgreSQL    │
│  (Frontend)     │────┤   (Go/Fiber)    │────┤   (Database)    │
│  JWT + Cookies  │    │  Business Logic │    │  Session Data   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Token Strategy

- **Access Token**: JWT, 15 minutes, stateless verification
- **Refresh Token**: Opaque, 30 days, stored hashed in database  
- **Transport**: HTTP-only Secure cookies with SameSite=Lax
- **Rotation**: Refresh tokens rotate on each use with revocation of old tokens
- **CSRF Protection**: Double-submit cookie pattern

### Security Model

- ✅ Zero database hits for access token verification
- ✅ BCrypt hashed refresh tokens in database
- ✅ Rate limiting on auth endpoints (5 attempts/15min)
- ✅ Account lockout after failed attempts
- ✅ Session timeout and inactivity detection
- ✅ Multi-device support with session tracking
- ✅ Comprehensive audit logging

## 🔐 Security Features

### Cookie Security
```typescript
{
  secure: true,           // HTTPS only
  httpOnly: true,         // No client-side access
  sameSite: "lax",       // CSRF protection
  maxAge: 900,           // 15 minutes for access tokens
  path: "/",             // Scope to entire app
}
```

### JWT Claims
```typescript
{
  sub: string,           // User ID
  email: string,         // User email
  user_type: string,     // "student" | "employee"
  roles: string[],       // ["admin", "faculty"]
  permissions: string[], // ["courses:manage", "users:view"]
  session_id: string,    // Session tracking
  jti: string,          // JWT ID for revocation
}
```

### Rate Limiting
- **Login**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour
- **API Calls**: 100 requests per minute
- **General**: 1000 requests per minute

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Required environment variables
NEXT_PUBLIC_IAM_SERVICE_URL=http://localhost:3001
JWT_ACCESS_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret
NEXT_PUBLIC_SECURE_COOKIES=true
```

### 2. Basic Usage

```typescript
import { useAuth, useAuthActions } from '@/features/auth';

function LoginPage() {
  const { login, isLoggingIn } = useAuthActions();
  
  const handleLogin = async (email: string, password: string) => {
    await login({ email, password });
    // Automatic redirect to dashboard on success
  };
}
```

### 3. Route Protection

```typescript
import { ProtectedRoute, AdminRoute } from '@/components/auth/route-guard';

// Require authentication
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// Require admin role
<AdminRoute>
  <AdminPanel />
</AdminRoute>

// Custom permissions
<WithPermission permissions={["courses:manage"]}>
  <CourseEditor />
</WithPermission>
```

## 📁 File Structure

```
apps/web/
├── schemas/
│   └── auth.schema.ts           # Zod schemas for validation
├── lib/
│   ├── api.ts                  # API client with auto-refresh
│   ├── cookies.ts              # Secure cookie management
│   ├── jwt.ts                  # JWT utilities and validation
│   └── database-schemas.sql    # PostgreSQL session tables
├── store/
│   └── auth.store.ts           # Zustand auth state management
├── features/auth/hooks/
│   └── use-auth-actions.ts     # Authentication hooks
├── components/
│   ├── providers.tsx           # App providers wrapper
│   └── auth/route-guard.tsx    # Route protection components
├── middleware.ts               # Next.js middleware for security
└── README-AUTH.md             # This documentation
```

## 🎯 Core Components

### Authentication Hooks

```typescript
// Login with error handling and redirects
const { login, logout, isLoggingIn } = useAuthActions();

// Session management
const auth = useAuth();
console.log(auth.user, auth.roles, auth.permissions);

// Auto-refresh (runs automatically)
const { isRefreshing } = useAutoRefresh();
```

### API Integration

```typescript
import { apiClient } from '@/lib/api';

// All methods handle token refresh automatically
const user = await apiClient.getCurrentUser();
const courses = await apiClient.get('/courses');
```

### Cookie Management

```typescript
import { TokenManager } from '@/lib/api';

// Automatic secure storage
TokenManager.storeTokens(accessToken, refreshToken, sessionId);

// Automatic retrieval for API calls
const token = TokenManager.getAccessToken();
```

## 🛡️ Security Hardening Checklist

### ✅ Token Security
- [x] Short-lived access tokens (15 minutes)
- [x] Rotating refresh tokens with database storage
- [x] BCrypt hashing of refresh tokens (cost 12)
- [x] JWT blacklist for immediate revocation
- [x] Secure token generation with crypto.randomUUID()

### ✅ Cookie Security  
- [x] HTTP-only cookies for sensitive tokens
- [x] Secure flag in production
- [x] SameSite=Lax for CSRF protection
- [x] Proper cookie expiration times
- [x] __Secure- prefix for secure cookies

### ✅ Session Management
- [x] Session timeout (30 minutes inactivity)
- [x] Multi-device session tracking
- [x] Session revocation on logout
- [x] Automatic cleanup of expired sessions
- [x] Device fingerprinting for security

### ✅ Protection Mechanisms
- [x] Rate limiting on authentication endpoints
- [x] Brute force protection with account lockout
- [x] CSRF protection via double-submit cookies
- [x] XSS protection headers
- [x] Comprehensive security audit logging

### ✅ Database Security
- [x] Hashed token storage only
- [x] Proper database indexes for performance
- [x] Session cleanup procedures
- [x] Audit trail for security events
- [x] Password history to prevent reuse

## 🔄 Authentication Flows

### Login Flow
1. User submits credentials
2. API calls IAM service `/auth/login`
3. IAM validates credentials and returns tokens
4. Frontend stores tokens in secure cookies
5. Auth store updated with user data
6. Redirect to dashboard

### Token Refresh Flow
1. Middleware detects token expiry (5 minutes before)
2. Call IAM service `/auth/refresh` with refresh token
3. IAM validates refresh token and returns new tokens
4. Old refresh token revoked, new tokens stored
5. Original request retried with new access token

### Logout Flow
1. Call IAM service to revoke tokens
2. Clear all cookies and local state
3. Redirect to login page

## 🧪 Testing

### Unit Tests
```bash
# Run auth-related unit tests
npm run test -- --testPathPattern=auth

# Test specific components
npm run test auth.store.test.ts
npm run test route-guard.test.tsx
```

### Integration Tests
```typescript
import { renderWithAuth, mockUsers } from '@/lib/testing/auth-test-utils';

test('admin can access admin panel', () => {
  renderWithAuth(<AdminPanel />, {
    initialAuthState: 'authenticated',
    userType: 'admin'
  });
  
  expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
});
```

### Security Testing
```typescript
// Test CSRF protection
expect(await request('/api/protected', { 
  method: 'POST',
  // Missing CSRF token
})).toHaveStatus(403);

// Test rate limiting  
for (let i = 0; i < 6; i++) {
  await request('/auth/login', { method: 'POST' });
}
expect(lastResponse).toHaveStatus(429);
```

## 🚀 Production Deployment

### Environment Variables
```bash
# Production settings
NODE_ENV=production
NEXT_PUBLIC_SECURE_COOKIES=true
NEXT_PUBLIC_IAM_SERVICE_URL=https://iam.gradeloop.com

# JWT secrets (use strong random values)
JWT_ACCESS_SECRET=<256-bit-secret>
JWT_REFRESH_SECRET=<256-bit-secret>

# Domain for cookie scope
NEXT_PUBLIC_DOMAIN=gradeloop.com
```

### Database Setup
```sql
-- Run the database schema
\i apps/web/lib/database-schemas.sql

-- Set up cleanup job (every hour)
SELECT cron.schedule('session-cleanup', '0 * * * *', 
  'SELECT cleanup_expired_sessions(), cleanup_expired_refresh_tokens();'
);
```

### Security Headers
The middleware automatically sets:
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`

### Monitoring
```typescript
// Set up monitoring for auth events
const auditEvents = [
  'login_success',
  'login_failure', 
  'token_refresh',
  'session_expired',
  'rate_limit_exceeded'
];
```

## 🔧 Configuration

### Token Lifetimes
```typescript
const SECURITY_CONFIG = {
  ACCESS_TOKEN_TTL: 15,        // minutes
  REFRESH_TOKEN_TTL: 30,       // days
  SESSION_TIMEOUT: 30,         // minutes of inactivity
  MAX_SESSIONS_PER_USER: 5,    // concurrent sessions
  PASSWORD_RESET_TTL: 15,      // minutes
  ACCOUNT_LOCKOUT_ATTEMPTS: 5, // failed attempts
  ACCOUNT_LOCKOUT_DURATION: 15 // minutes
};
```

### Rate Limits
```typescript
const RATE_LIMITS = {
  login: { requests: 5, window: '15m' },
  passwordReset: { requests: 3, window: '1h' },
  api: { requests: 100, window: '1m' },
  general: { requests: 1000, window: '1m' }
};
```

## 🐛 Troubleshooting

### Common Issues

**Token Refresh Failing**
- Check IAM service connectivity
- Verify refresh token in database
- Check token expiration times

**CSRF Token Errors**  
- Ensure meta tag is set in layout
- Check double-submit cookie implementation
- Verify SameSite cookie settings

**Session Timeout Issues**
- Check activity tracking implementation
- Verify session cleanup job
- Monitor session table size

**Rate Limiting False Positives**
- Check IP extraction in middleware
- Review rate limit windows
- Monitor rate limit store cleanup

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('auth:debug', 'true');

// Check auth state
console.log(useAuthStore.getState());

// Validate tokens manually
import { JWTManager } from '@/lib/jwt';
JWTManager.validateTokenStructure(token);
```

## 📈 Performance Considerations

### Optimizations
- ✅ Stateless access token verification (no DB hits)
- ✅ Efficient database indexes on session tables
- ✅ Automatic cleanup of expired data
- ✅ Connection pooling for IAM service calls
- ✅ Middleware-level caching of validation results

### Monitoring Metrics
- Authentication latency (< 200ms target)
- Token refresh success rate (> 99.9%)
- Session cleanup efficiency
- Rate limiting effectiveness
- Database query performance

## 🤝 Contributing

When contributing to the auth system:

1. **Security First**: All changes must maintain security standards
2. **Test Coverage**: Maintain >90% test coverage for auth code
3. **Documentation**: Update this README for any API changes
4. **Review Process**: Security changes require additional review

### Commit Guidelines
```bash
# Follow conventional commits
git commit -m "feat(auth): add new security feature"
git commit -m "fix(auth): resolve token refresh issue"  
git commit -m "test(auth): add integration tests"
```

## 📚 Additional Resources

- [OWASP Authentication Guidelines](https://owasp.org/www-project-authentication-cheat-sheet/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Next.js Security Documentation](https://nextjs.org/docs/advanced-features/security-headers)
- [IAM Service Documentation](../services/iam-service/README.md)

## 🆘 Support

For authentication-related issues:
1. Check this documentation first
2. Review the troubleshooting section
3. Check existing GitHub issues
4. Create a new issue with the `auth` label

---

Built with ❤️ for GradeLoop's enterprise security requirements.