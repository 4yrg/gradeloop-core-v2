/**
 * Navigation Configuration with Permission Support
 *
 * Single source of truth for navigation items with permission metadata.
 * Used by AppNav component for dynamic, permission-based rendering.
 *
 * Permission format: service:component:action
 * Examples: iam:users:read, admin:system:read, *:*:* (superadmin)
 */

import type { JSX } from "react";
import type {
  Permission,
  PermissionMode,
  NavPermissionConfig,
} from "@/types/permissions";
import Icons from "@/components/ui/icons";

// ============================================================================
// Navigation Item Types
// ============================================================================

/** Extended navigation item with permission support */
export interface NavItem extends NavPermissionConfig {
  /** Display label */
  label: string;
  /** Navigation href */
  href: string;
  /** Optional icon key */
  icon?: keyof typeof Icons;
  /** Optional description for tooltips */
  description?: string;
  /** Badge to show (e.g., notification count) */
  badge?: string | number;
  /** Badge variant */
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "ai";
  /** External link */
  external?: boolean;
  /** Submenu items */
  children?: NavItem[];
  /** Sort order */
  order?: number;
  /** Feature flag (optional additional gating) */
  featureFlag?: string;
}

// ============================================================================
// Main Navigation Items
// ============================================================================

/**
 * Main navigation configuration
 * Items are filtered by permissions at render time
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    description: "Overview and analytics",
    order: 1,
    // No permission required - always visible to authenticated users
  },
  {
    label: "Courses",
    href: "/courses",
    icon: "book",
    description: "Course management",
    order: 2,
    permission: "courses:courses:read",
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: "assignment",
    description: "Assignment tracking",
    order: 3,
    permission: "assignments:assignments:read",
  },
  {
    label: "Grading",
    href: "/grading",
    icon: "grade",
    description: "Grade management",
    order: 4,
    permission: "grading:grades:read",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "analytics",
    description: "Reports and insights",
    order: 5,
    permission: ["analytics:reports:read", "dashboard:analytics:read"],
    permissionMode: "any",
  },
  {
    label: "User Management",
    href: "/users",
    icon: "users",
    description: "Manage users and roles",
    order: 6,
    permission: "iam:users:read",
  },
  {
    label: "Bulk Import",
    href: "/bulk-import",
    icon: "import",
    description: "Import data in bulk",
    order: 7,
    permission: "bulk-import:imports:write",
  },
];

// ============================================================================
// Admin Navigation Items
// ============================================================================

/**
 * Admin-specific navigation
 * Requires admin permissions
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Admin Dashboard",
    href: "/admin",
    icon: "dashboard",
    description: "Administration overview",
    order: 1,
    permission: "admin:system:read",
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: "users",
    description: "Manage all users",
    order: 2,
    permission: "admin:users:manage",
  },
  {
    label: "Roles & Permissions",
    href: "/admin/roles",
    icon: "roles",
    description: "Configure roles and permissions",
    order: 3,
    permission: "iam:roles:manage",
  },
  {
    label: "Audit Logs",
    href: "/admin/audit",
    icon: "audit",
    description: "System activity logs",
    order: 4,
    permission: "iam:audit:read",
  },
  {
    label: "Institution Settings",
    href: "/admin/institution",
    icon: "institution",
    description: "Institution configuration",
    order: 5,
    permission: "institution:institution:manage",
  },
  {
    label: "System Settings",
    href: "/admin/settings",
    icon: "settings",
    description: "System configuration",
    order: 6,
    permission: "settings:general:manage",
  },
];

// ============================================================================
// User Menu Items
// ============================================================================

/**
 * User menu (profile, settings, logout)
 * Always visible to authenticated users
 */
export const USER_MENU_ITEMS: NavItem[] = [
  {
    label: "Profile",
    href: "/profile",
    icon: "profile",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "settings",
    permission: "settings:general:read",
  },
  {
    label: "Help",
    href: "/help",
    icon: "help",
    external: true,
  },
];

// ============================================================================
// Navigation Utilities
// ============================================================================

/**
 * Filter navigation items by permissions
 * @param items - Navigation items to filter
 * @param userPermissions - User's permissions array
 * @returns Filtered navigation items
 */
export function filterNavItemsByPermission(
  items: NavItem[],
  userPermissions: string[],
): NavItem[] {
  return items
    .filter((item) => {
      // Skip items with feature flags that aren't enabled
      if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) {
        return false;
      }

      // Items without permission requirements are always shown
      if (!item.permission) {
        return true;
      }

      // Check permissions
      return checkNavPermission(item, userPermissions);
    })
    .map((item) => ({
      ...item,
      // Recursively filter children
      children: item.children
        ? filterNavItemsByPermission(item.children, userPermissions)
        : undefined,
    }))
    .filter((item) => {
      // Hide items with no visible children (if they have children)
      if (item.children && item.children.length === 0) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

/**
 * Check if a navigation item should be visible
 * @param item - Navigation item
 * @param userPermissions - User's permissions array
 * @returns true if item should be visible
 */
function checkNavPermission(item: NavItem, userPermissions: string[]): boolean {
  if (!item.permission) {
    return true;
  }

  const mode = item.permissionMode || "any";

  if (Array.isArray(item.permission)) {
    if (item.permission.length === 0) {
      return true;
    }

    if (mode === "all") {
      // User must have ALL permissions
      return item.permission.every((reqPerm) =>
        userPermissions.some((userPerm) =>
          permissionMatches(userPerm, reqPerm),
        ),
      );
    } else {
      // User must have ANY permission
      return item.permission.some((reqPerm) =>
        userPermissions.some((userPerm) =>
          permissionMatches(userPerm, reqPerm),
        ),
      );
    }
  }

  // Single permission check
  if (typeof item.permission === "string") {
    return userPermissions.some((userPerm) =>
      permissionMatches(userPerm, item.permission as string),
    );
  }

  return false;
}

/**
 * Check if a user permission matches a required permission
 * Simplified version for nav items - uses full matching from lib/permissions
 */
function permissionMatches(
  userPermission: string,
  requiredPermission: string,
): boolean {
  // Parse both permissions
  const user = parsePermission(userPermission);
  const required = parsePermission(requiredPermission);

  if (!user || !required) {
    return false;
  }

  // Check each segment with wildcard support
  const serviceMatches =
    user.service === "*" || user.service === required.service;
  const componentMatches =
    user.component === "*" || user.component === required.component;
  const actionMatches = user.action === "*" || user.action === required.action;

  return serviceMatches && componentMatches && actionMatches;
}

/**
 * Parse a permission string into segments
 */
function parsePermission(permission: string): {
  service: string;
  component: string;
  action: string;
} | null {
  if (!permission.includes(":")) {
    return null;
  }

  const parts = permission.split(":");
  if (parts.length !== 3) {
    return null;
  }

  const [service, component, action] = parts;

  if (!service || !component || !action) {
    return null;
  }

  return { service, component, action };
}

/**
 * Check if a feature flag is enabled
 * Replace with your actual feature flag implementation
 */
function isFeatureEnabled(flag: string): boolean {
  // Example: check environment variable or feature flag service
  if (typeof process !== "undefined" && process.env) {
    const flagValue = process.env[`FEATURE_${flag.toUpperCase()}`];
    return flagValue === "true" || flagValue === "1";
  }
  return false;
}

/**
 * Get all visible navigation items for a user
 * @param userPermissions - User's permissions array
 * @returns Filtered and sorted navigation items
 */
export function getVisibleNavItems(userPermissions: string[]): NavItem[] {
  return filterNavItemsByPermission(NAV_ITEMS, userPermissions);
}

/**
 * Get all visible admin navigation items for a user
 * @param userPermissions - User's permissions array
 * @returns Filtered and sorted admin navigation items
 */
export function getVisibleAdminNavItems(userPermissions: string[]): NavItem[] {
  return filterNavItemsByPermission(ADMIN_NAV_ITEMS, userPermissions);
}

// ============================================================================
// Exports
// ============================================================================

export { NAV_ITEMS as default };
