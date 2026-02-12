import { vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { User, Session } from '@/schemas/auth.schema';

// Mock user data for testing
export const mockUsers = {
  student: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'student@gradeloop.com',
    full_name: 'John Student',
    is_active: true,
    user_type: 'student' as const,
    roles: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'student',
        permissions: ['courses:view', 'assignments:submit', 'grades:view'],
      },
    ],
  },
  faculty: {
    id: '550e8400-e29b-41d4-a716-446655440010',
    email: 'faculty@gradeloop.com',
    full_name: 'Dr. Jane Faculty',
    is_active: true,
    user_type: 'employee' as const,
    roles: [
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'faculty',
        permissions: [
          'courses:manage',
          'assignments:create',
          'assignments:grade',
          'students:view',
          'grades:manage',
        ],
      },
    ],
  },
  admin: {
    id: '550e8400-e29b-41d4-a716-446655440020',
    email: 'admin@gradeloop.com',
    full_name: 'Alice Admin',
    is_active: true,
    user_type: 'employee' as const,
    roles: [
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'admin',
        permissions: [
          'users:manage',
          'courses:manage',
          'assignments:manage',
          'grades:manage',
          'reports:view',
          'institution:manage',
        ],
      },
    ],
  },
  superAdmin: {
    id: '550e8400-e29b-41d4-a716-446655440030',
    email: 'superadmin@gradeloop.com',
    full_name: 'Super Admin',
    is_active: true,
    user_type: 'employee' as const,
    roles: [
      {
        id: '550e8400-e29b-41d4-a716-446655440031',
        name: 'super_admin',
        permissions: ['*'], // All permissions
      },
    ],
  },
  inactive: {
    id: '550e8400-e29b-41d4-a716-446655440040',
    email: 'inactive@gradeloop.com',
    full_name: 'Inactive User',
    is_active: false,
    user_type: 'student' as const,
    roles: [],
  },
} as const;

// Mock session data
export const mockSessions = {
  active: {
    id: '550e8400-e29b-41d4-a716-446655440100',
    user_id: mockUsers.student.id,
    device_name: 'Test Browser',
    is_active: true,
    last_activity: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    created_at: new Date().toISOString(),
  },
  expired: {
    id: '550e8400-e29b-41d4-a716-446655440101',
    user_id: mockUsers.student.id,
    device_name: 'Test Browser',
    is_active: true,
    last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    expires_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Expired 15 minutes ago
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
} as const;

// Mock tokens
export const mockTokens = {
  validAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InN0dWRlbnRAZ3JhZGVsb29wLmNvbSIsInVzZXJfdHlwZSI6InN0dWRlbnQiLCJyb2xlcyI6WyJzdHVkZW50Il0sInBlcm1pc3Npb25zIjpbImNvdXJzZXM6dmlldyIsImFzc2lnbm1lbnRzOnN1Ym1pdCIsImdyYWRlczp2aWV3Il0sImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDA5MDAwLCJqdGkiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAxMDAiLCJzZXNzaW9uX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAwIn0.mock-signature',
  expiredAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InN0dWRlbnRAZ3JhZGVsb29wLmNvbSIsInVzZXJfdHlwZSI6InN0dWRlbnQiLCJyb2xlcyI6WyJzdHVkZW50Il0sInBlcm1pc3Npb25zIjpbImNvdXJzZXM6dmlldyIsImFzc2lnbm1lbnRzOnN1Ym1pdCIsImdyYWRlczp2aWV3Il0sImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDA5MDAwLCJqdGkiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAxMDEiLCJzZXNzaW9uX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAxIn0.mock-signature',
  validRefreshToken: 'mock-refresh-token-valid',
  expiredRefreshToken: 'mock-refresh-token-expired',
  csrfToken: 'mock-csrf-token-123456789',
};

// Mock API responses
export const mockAPIResponses = {
  loginSuccess: {
    user: mockUsers.student,
    access_token: mockTokens.validAccessToken,
    token_type: 'Bearer' as const,
    expires_in: 900, // 15 minutes
    session_id: mockSessions.active.id,
  },
  loginFailure: {
    error: 'invalid_credentials',
    error_description: 'Invalid email or password',
    error_code: 'AUTH001',
    timestamp: new Date().toISOString(),
  },
  refreshSuccess: {
    access_token: mockTokens.validAccessToken,
    token_type: 'Bearer' as const,
    expires_in: 900,
    session_id: mockSessions.active.id,
  },
  refreshFailure: {
    error: 'invalid_grant',
    error_description: 'Refresh token is invalid or expired',
    error_code: 'AUTH002',
    timestamp: new Date().toISOString(),
  },
  validateSuccess: {
    valid: true,
    user: mockUsers.student,
  },
  validateFailure: {
    valid: false,
  },
};

// Test utilities for auth store
export class AuthStoreTestUtils {
  /**
   * Reset auth store to initial state
   */
  static reset() {
    const authStore = useAuthStore.getState();
    authStore.reset();
  }

  /**
   * Set authenticated state with mock user
   */
  static setAuthenticated(userType: keyof typeof mockUsers = 'student') {
    const authStore = useAuthStore.getState();
    const user = mockUsers[userType];
    const session = mockSessions.active;

    authStore.login(
      user,
      session as Session,
      Date.now() + 15 * 60 * 1000, // 15 minutes
      session.id
    );
  }

  /**
   * Set unauthenticated state
   */
  static setUnauthenticated() {
    const authStore = useAuthStore.getState();
    authStore.logout();
  }

  /**
   * Set loading state
   */
  static setLoading(loading = true) {
    const authStore = useAuthStore.getState();
    authStore.setLoading(loading);
  }

  /**
   * Set expired session
   */
  static setExpiredSession() {
    const authStore = useAuthStore.getState();
    const user = mockUsers.student;
    const session = mockSessions.expired;

    authStore.login(
      user,
      session as Session,
      Date.now() - 15 * 60 * 1000, // Expired 15 minutes ago
      session.id
    );
  }

  /**
   * Get current auth state for assertions
   */
  static getAuthState() {
    return useAuthStore.getState();
  }
}

// Mock API client
export const mockAPIClient = {
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  validateSession: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  getCurrentUser: vi.fn(),
};

// Mock cookie utilities
export const mockCookieUtils = {
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  getCsrfToken: vi.fn(() => mockTokens.csrfToken),
  getAccessToken: vi.fn(() => mockTokens.validAccessToken),
  getRefreshToken: vi.fn(() => mockTokens.validRefreshToken),
  getSessionId: vi.fn(() => mockSessions.active.id),
};

// Mock JWT utilities
export const mockJWTUtils = {
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  isTokenExpired: vi.fn(),
  extractUserId: vi.fn(),
  extractSessionId: vi.fn(),
};

// Test wrapper component with providers
interface TestWrapperProps {
  children: ReactNode;
  initialAuthState?: 'authenticated' | 'unauthenticated' | 'loading' | 'expired';
  userType?: keyof typeof mockUsers;
}

export function TestWrapper({
  children,
  initialAuthState = 'unauthenticated',
  userType = 'student'
}: TestWrapperProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  // Set initial auth state
  React.useEffect(() => {
    switch (initialAuthState) {
      case 'authenticated':
        AuthStoreTestUtils.setAuthenticated(userType);
        break;
      case 'unauthenticated':
        AuthStoreTestUtils.setUnauthenticated();
        break;
      case 'loading':
        AuthStoreTestUtils.setLoading(true);
        break;
      case 'expired':
        AuthStoreTestUtils.setExpiredSession();
        break;
    }
  }, [initialAuthState, userType]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Custom render function with test wrapper
export function renderWithAuth(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    initialAuthState?: 'authenticated' | 'unauthenticated' | 'loading' | 'expired';
    userType?: keyof typeof mockUsers;
  }
) {
  const { initialAuthState, userType, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper
        initialAuthState={initialAuthState}
        userType={userType}
      >
        {children}
      </TestWrapper>
    ),
    ...renderOptions,
  });
}

// Security test scenarios
export const securityTestScenarios = {
  // CSRF Protection Tests
  csrf: {
    missingToken: {
      headers: {},
      expectStatus: 403,
      expectError: 'CSRF token missing',
    },
    invalidToken: {
      headers: { 'X-CSRF-Token': 'invalid-token' },
      expectStatus: 403,
      expectError: 'Invalid CSRF token',
    },
    validToken: {
      headers: { 'X-CSRF-Token': mockTokens.csrfToken },
      expectStatus: 200,
    },
  },

  // Rate Limiting Tests
  rateLimit: {
    loginAttempts: {
      endpoint: '/api/v1/auth/login',
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      expectStatus: 429,
    },
    passwordReset: {
      endpoint: '/api/v1/auth/forgot-password',
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      expectStatus: 429,
    },
  },

  // Token Security Tests
  tokenSecurity: {
    accessTokenReuse: {
      scenario: 'Attempt to reuse revoked access token',
      expectStatus: 401,
      expectError: 'Token has been revoked',
    },
    refreshTokenReuse: {
      scenario: 'Attempt to reuse consumed refresh token',
      expectStatus: 401,
      expectError: 'Token reuse detected',
    },
    expiredToken: {
      scenario: 'Use expired access token',
      expectStatus: 401,
      expectError: 'Token has expired',
    },
  },

  // Session Security Tests
  sessionSecurity: {
    concurrentSessions: {
      scenario: 'Multiple active sessions per user',
      maxSessions: 5,
      expectBehavior: 'Oldest session should be revoked',
    },
    sessionHijacking: {
      scenario: 'Different IP address for same session',
      expectBehavior: 'Session should be invalidated',
    },
    deviceFingerprint: {
      scenario: 'Different device fingerprint for same session',
      expectBehavior: 'Require re-authentication',
    },
  },

  // Password Security Tests
  passwordSecurity: {
    weakPassword: {
      password: 'password123',
      expectStatus: 422,
      expectError: 'Password does not meet security requirements',
    },
    passwordReuse: {
      scenario: 'Attempt to reuse recent password',
      expectStatus: 422,
      expectError: 'Cannot reuse recent passwords',
    },
    bruteForce: {
      scenario: 'Multiple failed login attempts',
      maxAttempts: 5,
      expectBehavior: 'Account should be locked',
    },
  },
};

// Performance test scenarios
export const performanceTestScenarios = {
  tokenRefresh: {
    scenario: 'Token refresh under load',
    concurrentRequests: 100,
    expectedResponseTime: 200, // ms
  },
  sessionValidation: {
    scenario: 'Session validation performance',
    requestsPerSecond: 1000,
    expectedResponseTime: 50, // ms
  },
  authMiddleware: {
    scenario: 'Middleware performance',
    requestsPerSecond: 2000,
    expectedOverhead: 10, // ms
  },
};

// Integration test helpers
export class IntegrationTestHelpers {
  /**
   * Simulate complete login flow
   */
  static async simulateLogin(credentials: { email: string; password: string }) {
    // Mock successful login API call
    mockAPIClient.login.mockResolvedValueOnce(mockAPIResponses.loginSuccess);

    // Simulate cookie storage
    mockCookieUtils.getAccessToken.mockReturnValue(mockTokens.validAccessToken);
    mockCookieUtils.getRefreshToken.mockReturnValue(mockTokens.validRefreshToken);
    mockCookieUtils.getSessionId.mockReturnValue(mockSessions.active.id);

    // Update auth store
    AuthStoreTestUtils.setAuthenticated('student');

    return mockAPIResponses.loginSuccess;
  }

  /**
   * Simulate token refresh flow
   */
  static async simulateTokenRefresh() {
    // Mock successful refresh API call
    mockAPIClient.refresh.mockResolvedValueOnce(mockAPIResponses.refreshSuccess);

    // Simulate new token storage
    const newToken = 'new-access-token';
    mockCookieUtils.getAccessToken.mockReturnValue(newToken);

    return { access_token: newToken };
  }

  /**
   * Simulate logout flow
   */
  static async simulateLogout() {
    // Mock successful logout API call
    mockAPIClient.logout.mockResolvedValueOnce({ message: 'Logged out successfully' });

    // Simulate cookie clearing
    mockCookieUtils.getAccessToken.mockReturnValue(null);
    mockCookieUtils.getRefreshToken.mockReturnValue(null);
    mockCookieUtils.getSessionId.mockReturnValue(null);

    // Update auth store
    AuthStoreTestUtils.setUnauthenticated();
  }

  /**
   * Simulate session expiry
   */
  static simulateSessionExpiry() {
    // Mock expired tokens
    mockCookieUtils.getAccessToken.mockReturnValue(mockTokens.expiredAccessToken);
    mockJWTUtils.isTokenExpired.mockReturnValue(true);

    // Update auth store
    AuthStoreTestUtils.setExpiredSession();
  }
}

// Test data generators
export class TestDataGenerators {
  /**
   * Generate random user data
   */
  static generateUser(overrides: Partial<User> = {}): User {
    const randomId = crypto.randomUUID();
    return {
      id: randomId,
      email: `user-${randomId.slice(0, 8)}@test.com`,
      full_name: `Test User ${randomId.slice(0, 8)}`,
      is_active: true,
      user_type: 'student',
      roles: [
        {
          id: crypto.randomUUID(),
          name: 'student',
          permissions: ['courses:view'],
        },
      ],
      ...overrides,
    };
  }

  /**
   * Generate random session data
   */
  static generateSession(overrides: Partial<Session> = {}): Session {
    const randomId = crypto.randomUUID();
    return {
      id: randomId,
      user_id: crypto.randomUUID(),
      device_name: 'Test Device',
      is_active: true,
      last_activity: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test credentials
   */
  static generateCredentials() {
    const randomId = crypto.randomUUID();
    return {
      email: `test-${randomId.slice(0, 8)}@gradeloop.com`,
      password: 'TestPassword123!',
    };
  }
}

// Cleanup utilities
export class TestCleanup {
  /**
   * Clean up all test state
   */
  static cleanupAll() {
    // Reset auth store
    AuthStoreTestUtils.reset();

    // Clear all mocks
    vi.clearAllMocks();

    // Reset mock implementations
    Object.values(mockAPIClient).forEach(mock => mock.mockReset());
    Object.values(mockCookieUtils).forEach(mock => mock.mockReset());
    Object.values(mockJWTUtils).forEach(mock => mock.mockReset());
  }

  /**
   * Setup default mock implementations
   */
  static setupDefaultMocks() {
    // Default cookie mocks
    mockCookieUtils.getCsrfToken.mockReturnValue(mockTokens.csrfToken);
    mockCookieUtils.getAccessToken.mockReturnValue(null);
    mockCookieUtils.getRefreshToken.mockReturnValue(null);
    mockCookieUtils.getSessionId.mockReturnValue(null);

    // Default JWT mocks
    mockJWTUtils.isTokenExpired.mockReturnValue(false);
    mockJWTUtils.extractUserId.mockReturnValue(mockUsers.student.id);
    mockJWTUtils.extractSessionId.mockReturnValue(mockSessions.active.id);
  }
}

// Export all utilities
export * from '@testing-library/react';
export { vi } from 'vitest';
