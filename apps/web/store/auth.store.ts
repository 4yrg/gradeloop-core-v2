import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  User,
  Session,
  ActiveSession,
  ClientAuthState,
  AccessTokenPayload,
} from "@/schemas/auth.schema";

// Enhanced authentication state interface
interface AuthState {
  // Core state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Session management
  lastActivity: number;
  expiresAt: number | null;
  sessionId: string | null;

  // Multi-device support
  activeSessions: ActiveSession[];
  currentSessionId: string | null;

  // Security state
  csrfToken: string | null;
  refreshing: boolean;

  // Actions - Authentication
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;

  // Actions - Session management
  updateLastActivity: () => void;
  setExpiresAt: (expiresAt: number | null) => void;
  setSessionId: (sessionId: string | null) => void;
  setCsrfToken: (token: string | null) => void;
  setRefreshing: (refreshing: boolean) => void;

  // Actions - Multi-device
  setActiveSessions: (sessions: ActiveSession[]) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  removeSession: (sessionId: string) => void;

  // Actions - Auth operations
  login: (
    user: User,
    session: Session,
    expiresAt: number,
    sessionId: string,
  ) => void;
  logout: () => void;
  refresh: (expiresAt: number) => void;
  reset: () => void;

  // Computed getters - User info
  getUserRoles: () => string[];
  getUserPermissions: () => string[];
  getUserId: () => string | null;
  getUserEmail: () => string | null;
  getUserType: () => "student" | "employee" | null;

  // Computed getters - Authorization
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;

  // Computed getters - Session validation
  isSessionValid: () => boolean;
  isSessionExpired: () => boolean;
  getTimeUntilExpiry: () => number;
  shouldRefresh: () => boolean;

  // Computed getters - Role-based helpers
  isStudent: () => boolean;
  isEmployee: () => boolean;
  isAdmin: () => boolean;
  isFaculty: () => boolean;
  isSuperAdmin: () => boolean;

  // Computed getters - Permission helpers
  canManageUsers: () => boolean;
  canManageCourses: () => boolean;
  canViewReports: () => boolean;
  canGrade: () => boolean;
  canManageInstitution: () => boolean;
}

// Initial state
const initialState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  lastActivity: Date.now(),
  expiresAt: null,
  sessionId: null,
  activeSessions: [],
  currentSessionId: null,
  csrfToken: null,
  refreshing: false,
};

// Security configuration
const SECURITY_CONFIG = {
  ACCESS_TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  SESSION_ACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MAX_INACTIVE_TIME: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Create the enhanced auth store
export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // State
      ...initialState,

      // Core Actions
      setUser: (user) =>
        set((state) => {
          state.user = user;
          if (user) {
            state.lastActivity = Date.now();
          }
        }),

      setSession: (session) =>
        set((state) => {
          state.session = session;
          if (session) {
            state.sessionId = session.id;
            state.lastActivity = Date.now();
          }
        }),

      setAuthenticated: (authenticated) =>
        set((state) => {
          state.isAuthenticated = authenticated;
          if (!authenticated) {
            state.user = null;
            state.session = null;
            state.sessionId = null;
            state.expiresAt = null;
            state.activeSessions = [];
            state.currentSessionId = null;
            state.csrfToken = null;
          }
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      // Session Management Actions
      updateLastActivity: () =>
        set((state) => {
          state.lastActivity = Date.now();
        }),

      setExpiresAt: (expiresAt) =>
        set((state) => {
          state.expiresAt = expiresAt;
        }),

      setSessionId: (sessionId) =>
        set((state) => {
          state.sessionId = sessionId;
        }),

      setCsrfToken: (token) =>
        set((state) => {
          state.csrfToken = token;
        }),

      setRefreshing: (refreshing) =>
        set((state) => {
          state.refreshing = refreshing;
        }),

      // Multi-device Actions
      setActiveSessions: (sessions) =>
        set((state) => {
          state.activeSessions = sessions;
        }),

      setCurrentSessionId: (sessionId) =>
        set((state) => {
          state.currentSessionId = sessionId;
        }),

      removeSession: (sessionId) =>
        set((state) => {
          state.activeSessions = state.activeSessions.filter(
            (session) => session.session_id !== sessionId,
          );
          if (state.currentSessionId === sessionId) {
            state.currentSessionId = null;
          }
        }),

      // Auth Operation Actions
      login: (user, session, expiresAt, sessionId) =>
        set((state) => {
          state.user = user;
          state.session = session;
          state.isAuthenticated = true;
          state.isLoading = false;
          state.expiresAt = expiresAt;
          state.sessionId = sessionId;
          state.currentSessionId = sessionId;
          state.lastActivity = Date.now();
        }),

      logout: () =>
        set(() => ({
          ...initialState,
          lastActivity: Date.now(),
        })),

      refresh: (expiresAt) =>
        set((state) => {
          state.expiresAt = expiresAt;
          state.lastActivity = Date.now();
          state.refreshing = false;
        }),

      reset: () =>
        set(() => ({
          ...initialState,
        })),

      // User Info Getters
      getUserRoles: () => {
        const { user } = get();
        return user?.roles?.map((role) => role.name) ?? [];
      },

      getUserPermissions: () => {
        const { user } = get();
        const permissions = new Set<string>();

        user?.roles?.forEach((role) => {
          role.permissions?.forEach((permission) => {
            permissions.add(permission);
          });
        });

        return Array.from(permissions);
      },

      getUserId: () => {
        const { user } = get();
        return user?.id ?? null;
      },

      getUserEmail: () => {
        const { user } = get();
        return user?.email ?? null;
      },

      getUserType: () => {
        const { user } = get();
        return user?.user_type ?? null;
      },

      // Authorization Getters
      hasRole: (role) => {
        const { getUserRoles } = get();
        return getUserRoles().includes(role);
      },

      hasPermission: (permission) => {
        const { getUserPermissions } = get();
        return getUserPermissions().includes(permission);
      },

      hasAnyRole: (roles) => {
        const { getUserRoles } = get();
        const userRoles = getUserRoles();
        return roles.some((role) => userRoles.includes(role));
      },

      hasAnyPermission: (permissions) => {
        const { getUserPermissions } = get();
        const userPermissions = getUserPermissions();
        return permissions.some((permission) =>
          userPermissions.includes(permission),
        );
      },

      // Session Validation Getters
      isSessionValid: () => {
        const { isAuthenticated, expiresAt, lastActivity } = get();

        if (!isAuthenticated || !expiresAt) {
          return false;
        }

        const now = Date.now();
        const isNotExpired = now < expiresAt;
        const isNotInactive =
          now - lastActivity < SECURITY_CONFIG.SESSION_ACTIVITY_TIMEOUT;

        return isNotExpired && isNotInactive;
      },

      isSessionExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        return Date.now() >= expiresAt;
      },

      getTimeUntilExpiry: () => {
        const { expiresAt } = get();
        if (!expiresAt) return 0;
        return Math.max(0, expiresAt - Date.now());
      },

      shouldRefresh: () => {
        const { expiresAt, refreshing, isAuthenticated } = get();

        if (!isAuthenticated || refreshing || !expiresAt) {
          return false;
        }

        const timeUntilExpiry = expiresAt - Date.now();
        return (
          timeUntilExpiry <= SECURITY_CONFIG.ACCESS_TOKEN_REFRESH_THRESHOLD
        );
      },

      // Role-based Helpers
      isStudent: () => {
        const { getUserType } = get();
        return getUserType() === "student";
      },

      isEmployee: () => {
        const { getUserType } = get();
        return getUserType() === "employee";
      },

      isAdmin: () => {
        const { hasRole } = get();
        return hasRole("admin");
      },

      isFaculty: () => {
        const { hasAnyRole } = get();
        return hasAnyRole(["faculty", "instructor", "teacher"]);
      },

      isSuperAdmin: () => {
        const { hasRole } = get();
        return hasRole("super_admin");
      },

      // Permission Helpers
      canManageUsers: () => {
        const { hasAnyPermission } = get();
        return hasAnyPermission([
          "users:manage",
          "users:create",
          "users:update",
          "users:delete",
        ]);
      },

      canManageCourses: () => {
        const { hasAnyPermission } = get();
        return hasAnyPermission([
          "courses:manage",
          "courses:create",
          "courses:update",
          "courses:delete",
        ]);
      },

      canViewReports: () => {
        const { hasAnyPermission } = get();
        return hasAnyPermission(["reports:view", "analytics:view"]);
      },

      canGrade: () => {
        const { hasAnyPermission } = get();
        return hasAnyPermission(["assignments:grade", "grades:manage"]);
      },

      canManageInstitution: () => {
        const { hasAnyPermission } = get();
        return hasAnyPermission(["institution:manage", "settings:manage"]);
      },
    })),
    {
      name: "gradeloop-auth",
      version: 2, // Increment when schema changes
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const item = localStorage.getItem(name);
          if (!item) return null;

          try {
            const parsed = JSON.parse(item);

            // Security: Only persist minimal safe data
            if (parsed.state) {
              const safeState = {
                isAuthenticated: parsed.state.isAuthenticated || false,
                lastActivity: parsed.state.lastActivity || Date.now(),
                sessionId: parsed.state.sessionId || null,
                currentSessionId: parsed.state.currentSessionId || null,
              };

              return JSON.stringify({
                ...parsed,
                state: safeState,
              });
            }
          } catch {
            return null;
          }

          return item;
        },

        setItem: (name, value) => {
          try {
            const parsed = JSON.parse(value);

            // Only persist safe authentication state
            if (parsed.state) {
              const persistState = {
                isAuthenticated: parsed.state.isAuthenticated,
                lastActivity: parsed.state.lastActivity,
                sessionId: parsed.state.sessionId,
                currentSessionId: parsed.state.currentSessionId,
              };

              localStorage.setItem(
                name,
                JSON.stringify({
                  ...parsed,
                  state: persistState,
                }),
              );
            }
          } catch {
            // Fallback to default storage behavior
            localStorage.setItem(name, value);
          }
        },

        removeItem: (name) => localStorage.removeItem(name),
      })),

      // Only persist minimal auth state
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
        sessionId: state.sessionId,
        currentSessionId: state.currentSessionId,
      }),

      // Migration for store updates
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migrate from old auth store structure
          return {
            ...initialState,
            isAuthenticated: persistedState.isAuthenticated || false,
            lastActivity: persistedState.lastActivity || Date.now(),
          };
        }
        return persistedState;
      },
    },
  ),
);

// Optimized selectors to prevent unnecessary re-renders
export const authSelectors = {
  // Basic selectors
  user: (state: AuthState) => state.user,
  isAuthenticated: (state: AuthState) => state.isAuthenticated,
  isLoading: (state: AuthState) => state.isLoading,
  session: (state: AuthState) => state.session,

  // Session selectors
  sessionId: (state: AuthState) => state.sessionId,
  expiresAt: (state: AuthState) => state.expiresAt,
  isRefreshing: (state: AuthState) => state.refreshing,
  csrfToken: (state: AuthState) => state.csrfToken,

  // Multi-device selectors
  activeSessions: (state: AuthState) => state.activeSessions,
  currentSessionId: (state: AuthState) => state.currentSessionId,

  // Role-based selectors
  isStudent: (state: AuthState) => state.isStudent(),
  isEmployee: (state: AuthState) => state.isEmployee(),
  isAdmin: (state: AuthState) => state.isAdmin(),
  isFaculty: (state: AuthState) => state.isFaculty(),
  isSuperAdmin: (state: AuthState) => state.isSuperAdmin(),

  // Permission-based selectors
  canManageUsers: (state: AuthState) => state.canManageUsers(),
  canManageCourses: (state: AuthState) => state.canManageCourses(),
  canViewReports: (state: AuthState) => state.canViewReports(),
  canGrade: (state: AuthState) => state.canGrade(),
  canManageInstitution: (state: AuthState) => state.canManageInstitution(),

  // Session validation selectors
  isSessionValid: (state: AuthState) => state.isSessionValid(),
  shouldRefresh: (state: AuthState) => state.shouldRefresh(),
  timeUntilExpiry: (state: AuthState) => state.getTimeUntilExpiry(),

  // Computed session info
  sessionInfo: (state: AuthState) => ({
    isValid: state.isSessionValid(),
    isExpired: state.isSessionExpired(),
    shouldRefresh: state.shouldRefresh(),
    timeUntilExpiry: state.getTimeUntilExpiry(),
    lastActivity: state.lastActivity,
    sessionId: state.sessionId,
  }),
};

// Enhanced hook for auth operations with better performance
export const useAuth = () => {
  const store = useAuthStore();

  return {
    // State
    user: store.user,
    session: store.session,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    sessionId: store.sessionId,
    isRefreshing: store.refreshing,
    csrfToken: store.csrfToken,

    // Multi-device
    activeSessions: store.activeSessions,
    currentSessionId: store.currentSessionId,

    // Actions
    setUser: store.setUser,
    setSession: store.setSession,
    setAuthenticated: store.setAuthenticated,
    setLoading: store.setLoading,
    updateLastActivity: store.updateLastActivity,
    login: store.login,
    logout: store.logout,
    refresh: store.refresh,
    reset: store.reset,

    // User info
    userId: store.getUserId(),
    userEmail: store.getUserEmail(),
    userType: store.getUserType(),
    roles: store.getUserRoles(),
    permissions: store.getUserPermissions(),

    // Authorization methods
    hasRole: store.hasRole,
    hasPermission: store.hasPermission,
    hasAnyRole: store.hasAnyRole,
    hasAnyPermission: store.hasAnyPermission,

    // Convenience flags
    isStudent: store.isStudent(),
    isEmployee: store.isEmployee(),
    isAdmin: store.isAdmin(),
    isFaculty: store.isFaculty(),
    isSuperAdmin: store.isSuperAdmin(),

    // Permission flags
    canManageUsers: store.canManageUsers(),
    canManageCourses: store.canManageCourses(),
    canViewReports: store.canViewReports(),
    canGrade: store.canGrade(),
    canManageInstitution: store.canManageInstitution(),

    // Session validation
    isSessionValid: store.isSessionValid(),
    isSessionExpired: store.isSessionExpired(),
    shouldRefresh: store.shouldRefresh(),
    timeUntilExpiry: store.getTimeUntilExpiry(),
  };
};

// Hook for session monitoring (used by middleware and auth components)
export const useSessionMonitor = () => {
  const {
    isAuthenticated,
    isSessionValid,
    shouldRefresh,
    isSessionExpired,
    timeUntilExpiry,
    updateLastActivity,
  } = useAuth();

  return {
    isAuthenticated,
    isSessionValid,
    shouldRefresh,
    isSessionExpired,
    timeUntilExpiry,
    updateLastActivity,
  };
};

// Types for external use
export type { AuthState, User, Session, ActiveSession };
