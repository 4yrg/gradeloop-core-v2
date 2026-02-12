import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// User type definitions matching backend
interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  user_type: "student" | "employee";
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
  }>;
  password_changed_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Authentication state interface
interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivity: number;
  sessionExpiry: number | null;

  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  updateLastActivity: () => void;
  setSessionExpiry: (expiry: number | null) => void;
  logout: () => void;
  reset: () => void;

  // Computed getters
  getUserRoles: () => string[];
  getUserPermissions: () => string[];
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  isSessionExpired: () => boolean;
  getTimeUntilExpiry: () => number;
}

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  lastActivity: Date.now(),
  sessionExpiry: null,
};

// Create the auth store with persistence
export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // State
      ...initialState,

      // Actions
      setUser: (user) =>
        set((state) => {
          state.user = user;
          if (user) {
            state.isAuthenticated = true;
            state.lastActivity = Date.now();
          }
        }),

      setAuthenticated: (authenticated) =>
        set((state) => {
          state.isAuthenticated = authenticated;
          if (!authenticated) {
            state.user = null;
            state.sessionExpiry = null;
          }
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      updateLastActivity: () =>
        set((state) => {
          state.lastActivity = Date.now();
        }),

      setSessionExpiry: (expiry) =>
        set((state) => {
          state.sessionExpiry = expiry;
        }),

      logout: () =>
        set((state) => {
          state.user = null;
          state.isAuthenticated = false;
          state.isLoading = false;
          state.sessionExpiry = null;
          state.lastActivity = Date.now();
        }),

      reset: () =>
        set(() => ({
          ...initialState,
        })),

      // Computed getters
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

      isSessionExpired: () => {
        const { sessionExpiry } = get();
        if (!sessionExpiry) return false;
        return Date.now() > sessionExpiry;
      },

      getTimeUntilExpiry: () => {
        const { sessionExpiry } = get();
        if (!sessionExpiry) return 0;
        return Math.max(0, sessionExpiry - Date.now());
      },
    })),
    {
      name: "gradeloop-auth",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Only persist minimal auth state, not sensitive data
          const item = localStorage.getItem(name);
          if (item) {
            try {
              const parsed = JSON.parse(item);
              // Remove sensitive data from persistence
              if (parsed.state) {
                delete parsed.state.user; // Don't persist user data
                delete parsed.state.sessionExpiry; // Don't persist session data
              }
              return JSON.stringify(parsed);
            } catch {
              return null;
            }
          }
          return null;
        },
        setItem: (name, value) => {
          try {
            const parsed = JSON.parse(value);
            // Only persist authentication state, not user data
            if (parsed.state) {
              const persistState = {
                isAuthenticated: parsed.state.isAuthenticated,
                lastActivity: parsed.state.lastActivity,
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
            // Fallback to default storage
            localStorage.setItem(name, value);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    },
  ),
);

// Selectors for common use cases
export const authSelectors = {
  // Basic selectors
  user: (state: AuthState) => state.user,
  isAuthenticated: (state: AuthState) => state.isAuthenticated,
  isLoading: (state: AuthState) => state.isLoading,

  // Role-based selectors
  isStudent: (state: AuthState) => state.user?.user_type === "student",
  isEmployee: (state: AuthState) => state.user?.user_type === "employee",
  isAdmin: (state: AuthState) => state.hasRole("admin"),
  isFaculty: (state: AuthState) => state.hasRole("faculty"),
  isSuperAdmin: (state: AuthState) => state.hasRole("super_admin"),

  // Permission-based selectors
  canManageUsers: (state: AuthState) => state.hasPermission("users:manage"),
  canManageCourses: (state: AuthState) => state.hasPermission("courses:manage"),
  canViewReports: (state: AuthState) => state.hasPermission("reports:view"),
  canGrade: (state: AuthState) =>
    state.hasAnyPermission(["assignments:grade", "admin"]),

  // Session selectors
  sessionInfo: (state: AuthState) => ({
    isExpired: state.isSessionExpired(),
    timeUntilExpiry: state.getTimeUntilExpiry(),
    lastActivity: state.lastActivity,
  }),
};

// Hook for common auth operations
export const useAuth = () => {
  const store = useAuthStore();

  return {
    // State
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,

    // Actions
    setUser: store.setUser,
    setAuthenticated: store.setAuthenticated,
    setLoading: store.setLoading,
    logout: store.logout,
    updateLastActivity: store.updateLastActivity,

    // Computed
    roles: store.getUserRoles(),
    permissions: store.getUserPermissions(),
    hasRole: store.hasRole,
    hasPermission: store.hasPermission,
    hasAnyRole: store.hasAnyRole,
    hasAnyPermission: store.hasAnyPermission,

    // Convenience flags
    isStudent: store.user?.user_type === "student",
    isEmployee: store.user?.user_type === "employee",
    isAdmin: store.hasRole("admin"),
    isFaculty: store.hasRole("faculty"),
    isSuperAdmin: store.hasRole("super_admin"),

    // Session
    isSessionExpired: store.isSessionExpired(),
    timeUntilExpiry: store.getTimeUntilExpiry(),
  };
};

// Types for external use
export type { AuthState, User };
