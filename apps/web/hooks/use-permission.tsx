/**
 * usePermission Hook
 *
 * React hook for permission checks with SSR safety.
 * Works in both Server Components (via direct utility import) and Client Components.
 *
 * @example
 * ```tsx
 * // Client Component
 * "use client";
 *
 * import { usePermission } from "@/hooks/use-permission";
 *
 * function UserPanel() {
 *   const { hasPermission, hasAllPermissions, isLoading } = usePermission();
 *
 *   if (isLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   if (hasPermission("iam:users:read")) {
 *     return <UserTable />;
 *   }
 *
 *   return <UnauthorizedMessage />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Server Component - use utilities directly
 * import { hasPermission } from "@/lib/permissions";
 * import { getCurrentUser } from "@/lib/auth";
 *
 * async function DashboardPage() {
 *   const { user } = await getCurrentUser();
 *   const canViewUsers = hasPermission(user.permissions, "iam:users:read");
 *
 *   return (
 *     <main>
 *       {canViewUsers && <UserManagement />}
 *     </main>
 *   );
 * }
 * ```
 */

"use client";

import * as React from "react";
import {
  hasPermission as checkPermission,
  hasAllPermissions as checkAllPermissions,
  hasAnyPermission as checkAnyPermission,
} from "@/lib/permissions";
import type { Permission, PermissionInput, PermissionMode } from "@/types/permissions";

// ============================================================================
// Hook Types
// ============================================================================

/** Return type for usePermission hook */
interface UsePermissionReturn {
  /** User's permissions array (empty if not loaded) */
  permissions: string[];
  /** Whether permissions are still loading/hydrating */
  isLoading: boolean;
  /** Check if user has a permission (or any in array) */
  hasPermission: (permission: PermissionInput, mode?: PermissionMode) => boolean;
  /** Check if user has all permissions in array */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Check if user has any permission in array */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Revalidate permissions (if callback provided) */
  revalidate?: () => Promise<void>;
  /** Error state if permission fetch failed */
  error?: Error;
}

/** Options for usePermission hook */
interface UsePermissionOptions {
  /** Initial permissions (for SSR hydration) */
  initialPermissions?: string[];
  /** Callback to fetch permissions (for client-side revalidation) */
  fetchPermissions?: () => Promise<string[]>;
  /** Whether to automatically fetch permissions on mount */
  autoFetch?: boolean;
  /** Enable permission change events */
  subscribeToChanges?: boolean;
}

// ============================================================================
// Context for Permission State
// ============================================================================

/** Context value shape */
interface PermissionContextValue {
  permissions: string[];
  isLoading: boolean;
  error?: Error;
  setPermissions: (permissions: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: Error) => void;
}

/** Create a context with undefined default to detect missing provider */
const PermissionContext = React.createContext<PermissionContextValue | undefined>(undefined);

/** Provider props */
interface PermissionProviderProps {
  children: React.ReactNode;
  initialPermissions?: string[];
  fetchPermissions?: () => Promise<string[]>;
}

/**
 * PermissionProvider - Optional context provider for global permission state
 * Use this if you want to share permission state across components
 *
 * @example
 * ```tsx
 * // In your app provider
 * <PermissionProvider fetchPermissions={() => fetchUserPermissions()}>
 *   <App />
 * </PermissionProvider>
 * ```
 */
function PermissionProvider({
  children,
  initialPermissions = [],
  fetchPermissions,
}: PermissionProviderProps): React.JSX.Element {
  const [permissions, setPermissions] = React.useState<string[]>(initialPermissions);
  const [isLoading, setIsLoading] = React.useState(initialPermissions.length === 0);
  const [error, setError] = React.useState<Error | undefined>();

  // Fetch permissions on mount if callback provided
  React.useEffect(() => {
    if (!fetchPermissions) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    fetchPermissions()
      .then((perms) => {
        if (mounted) {
          setPermissions(perms);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch permissions"));
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fetchPermissions]);

  const value = React.useMemo(
    () => ({
      permissions,
      isLoading,
      error,
      setPermissions,
      setLoading: setIsLoading,
      setError,
    }),
    [permissions, isLoading, error]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Get permission context (internal use)
 * @returns Context value or undefined if no provider
 */
function usePermissionContext(): PermissionContextValue | undefined {
  return React.useContext(PermissionContext);
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * usePermission - React hook for permission checks
 *
 * Features:
 * - SSR-safe (no flicker during hydration)
 * - Works with or without PermissionProvider
 * - Supports initial permissions from server
 * - Optional auto-fetch for client-side updates
 *
 * @param options - Hook options
 * @returns Permission check utilities and state
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { hasPermission, isLoading } = usePermission();
 *
 * if (isLoading) return <Loading />;
 * if (hasPermission("iam:users:read")) return <UserTable />;
 * return <Unauthorized />;
 * ```
 *
 * @example
 * ```tsx
 * // With initial permissions from SSR
 * const { hasPermission } = usePermission({
 *   initialPermissions: user.permissions,
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With auto-fetch
 * const { hasPermission, revalidate } = usePermission({
 *   fetchPermissions: async () => {
 *     const res = await fetch("/api/user/permissions");
 *     return res.json();
 *   },
 *   autoFetch: true,
 * });
 * ```
 */
function usePermission(options: UsePermissionOptions = {}): UsePermissionReturn {
  const {
    initialPermissions = [],
    fetchPermissions,
    autoFetch = false,
  } = options;

  // Try to use context if available, otherwise use local state
  const context = usePermissionContext();
  const hasContext = context !== undefined;

  // Local state (used when no provider)
  const [localPermissions, setLocalPermissions] = React.useState<string[]>(initialPermissions);
  const [localIsLoading, setLocalIsLoading] = React.useState(
    initialPermissions.length === 0 && autoFetch
  );
  const [localError, setLocalError] = React.useState<Error | undefined>();

  // Use context values if available, otherwise use local state
  const permissions = hasContext ? context.permissions : localPermissions;
  const isLoading = hasContext ? context.isLoading : localIsLoading;
  const error = hasContext ? context.error : localError;

  // Set local state from context if available
  React.useEffect(() => {
    if (hasContext) {
      setLocalPermissions(context.permissions);
      setLocalIsLoading(context.isLoading);
      setLocalError(context.error);
    }
  }, [hasContext, context?.permissions, context?.isLoading, context?.error]);

  // Auto-fetch on mount (only if no context and autoFetch enabled)
  React.useEffect(() => {
    if (!hasContext && fetchPermissions && autoFetch && initialPermissions.length === 0) {
      let mounted = true;

      fetchPermissions()
        .then((perms) => {
          if (mounted) {
            setLocalPermissions(perms);
            setLocalIsLoading(false);
          }
        })
        .catch((err) => {
          if (mounted) {
            setLocalError(err instanceof Error ? err : new Error("Failed to fetch permissions"));
            setLocalIsLoading(false);
          }
        });

      return () => {
        mounted = false;
      };
    }
  }, [hasContext, fetchPermissions, autoFetch, initialPermissions.length]);

  // Permission check functions
  const hasPermission = React.useCallback(
    (permission: PermissionInput, mode: PermissionMode = "any"): boolean => {
      return checkPermission(permissions, permission, mode);
    },
    [permissions]
  );

  const hasAllPermissions = React.useCallback(
    (permissionList: Permission[]): boolean => {
      return checkAllPermissions(permissions, permissionList);
    },
    [permissions]
  );

  const hasAnyPermission = React.useCallback(
    (permissionList: Permission[]): boolean => {
      return checkAnyPermission(permissions, permissionList);
    },
    [permissions]
  );

  // Revalidate function
  const revalidate = React.useCallback(async () => {
    if (!fetchPermissions) {
      throw new Error("fetchPermissions callback not provided");
    }

    if (!hasContext) {
      setLocalIsLoading(true);
    } else {
      context.setLoading(true);
    }

    try {
      const perms = await fetchPermissions();
      if (!hasContext) {
        setLocalPermissions(perms);
        setLocalIsLoading(false);
      } else {
        context.setPermissions(perms);
        context.setLoading(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to revalidate permissions");
      if (!hasContext) {
        setLocalError(error);
        setLocalIsLoading(false);
      } else {
        context.setError(error);
        context.setLoading(false);
      }
      throw error;
    }
  }, [fetchPermissions, hasContext, context]);

  return {
    permissions,
    isLoading,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    revalidate: fetchPermissions ? revalidate : undefined,
    error,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * useHasPermission - Simplified hook for single permission checks
 * Returns just a boolean for a specific permission
 *
 * @param permission - Permission to check
 * @returns true if user has the permission, false otherwise
 *
 * @example
 * ```tsx
 * const canViewUsers = useHasPermission("iam:users:read");
 *
 * return (
 *   <div>
 *     {canViewUsers && <UserTable />}
 *   </div>
 * );
 * ```
 */
function useHasPermission(permission: PermissionInput, mode: PermissionMode = "any"): boolean {
  const { hasPermission, isLoading } = usePermission();

  // Return false during loading to prevent flicker
  if (isLoading) {
    return false;
  }

  return hasPermission(permission, mode);
}

/**
 * useHasAllPermissions - Simplified hook for checking all permissions
 * Returns true only if user has ALL specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has all permissions
 *
 * @example
 * ```tsx
 * const canManageUsers = useHasAllPermissions([
 *   "iam:users:read",
 *   "iam:users:write",
 *   "iam:users:delete",
 * ]);
 * ```
 */
function useHasAllPermissions(permissions: Permission[]): boolean {
  const { hasAllPermissions, isLoading } = usePermission();

  if (isLoading) {
    return false;
  }

  return hasAllPermissions(permissions);
}

/**
 * useHasAnyPermission - Simplified hook for checking any permission
 * Returns true if user has ANY of the specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has any of the permissions
 *
 * @example
 * ```tsx
 * const canAccessAdmin = useHasAnyPermission([
 *   "admin:*:*",
 *   "dashboard:admin:access",
 * ]);
 * ```
 */
function useHasAnyPermission(permissions: Permission[]): boolean {
  const { hasAnyPermission, isLoading } = usePermission();

  if (isLoading) {
    return false;
  }

  return hasAnyPermission(permissions);
}

// ============================================================================
// Server Component Utilities
// ============================================================================

/**
 * Get permission checker for Server Components
 * Import and use directly in Server Components (no hook needed)
 *
 * @example
 * ```tsx
 * // app/dashboard/page.tsx (Server Component)
 * import { getServerPermissionChecker } from "@/hooks/use-permission";
 * import { getCurrentUser } from "@/lib/auth";
 *
 * export default async function DashboardPage() {
 *   const { user } = await getCurrentUser();
 *   const canView = getServerPermissionChecker(user.permissions);
 *
 *   return (
 *     <main>
 *       {canView.hasPermission("iam:users:read") && <UserTable />}
 *     </main>
 *   );
 * }
 * ```
 */
function getServerPermissionChecker(userPermissions: string[]) {
  return {
    hasPermission: (permission: PermissionInput, mode: PermissionMode = "any") =>
      checkPermission(userPermissions, permission, mode),
    hasAllPermissions: (permissions: Permission[]) =>
      checkAllPermissions(userPermissions, permissions),
    hasAnyPermission: (permissions: Permission[]) =>
      checkAnyPermission(userPermissions, permissions),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  PermissionProvider,
  usePermission,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
  getServerPermissionChecker,
};

export type {
  UsePermissionReturn,
  UsePermissionOptions,
  PermissionProviderProps,
};
