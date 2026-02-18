/**
 * PermissionGuard Component
 *
 * Flexible wrapper component for permission-based rendering.
 * Hydration-safe - prevents server/client mismatches.
 *
 * @example
 * ```tsx
 * // Single permission
 * <PermissionGuard require="iam(dashboard):users:read">
 *   <UserManagementPanel />
 * </PermissionGuard>
 *
 * // OR logic (any of these permissions)
 * <PermissionGuard requireAny={[
 *   "iam(dashboard):users:read",
 *   "iam(admin):users:read"
 * ]}>
 *   <UserTable />
 * </PermissionGuard>
 *
 * // AND logic (all permissions required)
 * <PermissionGuard requireAll={[
 *   "iam(dashboard):users:read",
 *   "iam(dashboard):users:write"
 * ]}>
 *   <UserEditor />
 * </PermissionGuard>
 *
 * // With custom fallback
 * <PermissionGuard
 *   require="iam(dashboard):users:read"
 *   fallback={<UnauthorizedMessage />}
 * >
 *   <UserTable />
 * </PermissionGuard>
 *
 * // With loading state
 * <PermissionGuard
 *   require="iam(dashboard):users:read"
 *   loading={<LoadingSpinner />}
 * >
 *   <UserTable />
 * </PermissionGuard>
 * ```
 */

"use client";

import * as React from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Permission, PermissionGuardProps, PermissionMode } from "@/types/permissions";

// ============================================================================
// PermissionGuard Component
// ============================================================================

/**
 * PermissionGuard - Conditional rendering based on permissions
 *
 * Features:
 * - Hydration-safe (no server/client mismatch)
 * - Supports single or multiple permissions
 * - OR/AND logic for permission arrays
 * - Custom fallback and loading states
 * - Optional className for styling
 *
 * @param props - Component props
 * @returns Children if permitted, fallback otherwise
 */
export function PermissionGuard({
  require,
  mode = "any",
  children,
  fallback = null,
  loading = null,
  className,
}: PermissionGuardProps): React.JSX.Element {
  const { hasPermission, isLoading } = usePermission();

  // Show loading state during hydration
  if (isLoading) {
    return <>{loading}</>;
  }

  // No permission requirement = always show
  if (!require) {
    return <>{children}</>;
  }

  // Handle array permissions
  if (Array.isArray(require)) {
    if (require.length === 0) {
      // Empty array = no restrictions
      return <>{children}</>;
    }

    const isAllowed = mode === "all"
      ? hasPermission(require, "all")
      : hasPermission(require, "any");

    if (!isAllowed) {
      return <>{fallback}</>;
    }

    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  // Handle single permission
  const isAllowed = hasPermission(require);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// Convenience Components
// ============================================================================

/**
 * RequirePermission - Shorthand for single permission guard
 *
 * @example
 * ```tsx
 * <RequirePermission permission="iam(dashboard):users:read">
 *   <UserTable />
 * </RequirePermission>
 * ```
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
  loading = null,
  className,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <PermissionGuard
      require={permission}
      fallback={fallback}
      loading={loading}
      className={className}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * RequireAnyPermission - Shorthand for OR logic (any permission)
 *
 * @example
 * ```tsx
 * <RequireAnyPermission permissions={[
 *   "iam(dashboard):users:read",
 *   "iam(admin):users:read"
 * ]}>
 *   <UserTable />
 * </RequireAnyPermission>
 * ```
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
  loading = null,
  className,
}: {
  permissions: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <PermissionGuard
      require={permissions}
      mode="any"
      fallback={fallback}
      loading={loading}
      className={className}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * RequireAllPermissions - Shorthand for AND logic (all permissions)
 *
 * @example
 * ```tsx
 * <RequireAllPermissions permissions={[
 *   "iam(dashboard):users:read",
 *   "iam(dashboard):users:write",
 *   "iam(dashboard):users:delete"
 * ]}>
 *   <UserDeletionForm />
 * </RequireAllPermissions>
 * ```
 */
export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
  loading = null,
  className,
}: {
  permissions: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <PermissionGuard
      require={permissions}
      mode="all"
      fallback={fallback}
      loading={loading}
      className={className}
    >
      {children}
    </PermissionGuard>
  );
}

// ============================================================================
// Fallback Components
// ============================================================================

/**
 * UnauthorizedMessage - Default fallback component
 * Shows a styled "access denied" message
 */
export function UnauthorizedMessage({
  message = "You don't have permission to access this feature.",
  icon = true,
  className,
}: {
  message?: string;
  icon?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center text-slate-500 ${className || ""}`}
    >
      {icon && (
        <svg
          className="mb-4 h-12 w-12 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

/**
 * LoadingPlaceholder - Default loading component
 * Shows a skeleton placeholder
 */
export function LoadingPlaceholder({
  height = "h-32",
  className,
}: {
  height?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-100 ${height} ${className || ""}`}
    />
  );
}

/**
 * EmptyPlaceholder - Component for empty states
 */
export function EmptyPlaceholder({
  message = "No content available",
  icon,
  className,
}: {
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center text-slate-500 ${className || ""}`}
    >
      {icon && <div className="mb-4 text-slate-300">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ============================================================================
// Server Component Version
// ============================================================================

/**
 * ServerPermissionGuard - For Server Components
 *
 * Note: This is a function, not a component, because Server Components
 * can't use hooks. Use it like this:
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
 *       {canView.hasPermission("iam(dashboard):users:read") ? (
 *         <UserTable />
 *       ) : (
 *         <UnauthorizedMessage />
 *       )}
 *     </main>
 *   );
 * }
 * ```
 */
export function ServerPermissionGuard({
  userPermissions,
  require,
  mode = "any",
  children,
  fallback = null,
}: {
  userPermissions: string[];
  require?: Permission | Permission[];
  mode?: PermissionMode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const { hasPermission } = getServerPermissionChecker(userPermissions);

  if (!require) {
    return children;
  }

  if (Array.isArray(require)) {
    if (require.length === 0) {
      return children;
    }

    const isAllowed = mode === "all"
      ? hasPermission(require, "all")
      : hasPermission(require, "any");

    return isAllowed ? children : fallback;
  }

  const isAllowed = hasPermission(require);
  return isAllowed ? children : fallback;
}

// Import for server guard
import { getServerPermissionChecker } from "@/hooks/use-permission";

// ============================================================================
// Exports
// ============================================================================

export type { PermissionGuardProps };
