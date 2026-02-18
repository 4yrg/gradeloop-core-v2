"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, type NavItem } from "@/config/navigation";
import { useAuth } from "@/store/auth.store";
import { usePathname } from "next/navigation";
import Icons from "@/components/ui/icons";
import Link from "next/link";
import Image from "next/image";
import {
  Sidebar as ShellSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

/**
 * Check if a user has a required permission.
 * Supports canonical format: iam:resource:action (e.g., iam:users:read)
 */
function hasPermission(required: string, userPermissions: string[]): boolean {
  // Direct match
  if (userPermissions.includes(required)) return true;

  // Normalize required permission for comparison
  const normalizedRequired = normalizeToCanonical(required);
  if (userPermissions.includes(normalizedRequired)) return true;

  // Check if any user permission matches after normalization
  for (const userPerm of userPermissions) {
    if (normalizeToCanonical(userPerm) === normalizedRequired) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a permission to canonical format (iam:resource:action)
 */
function normalizeToCanonical(permission: string): string {
  // Already canonical
  if ((permission.match(/:/g) || []).length === 2) {
    return permission;
  }

  // Handle legacy constant format: USER_READ -> iam:users:read
  const legacyConstantMap: Record<string, string> = {
    USER_CREATE: "iam:users:create",
    USER_READ: "iam:users:read",
    USER_UPDATE: "iam:users:update",
    USER_DELETE: "iam:users:delete",
    ROLE_CREATE: "iam:roles:create",
    ROLE_READ: "iam:roles:read",
    ROLE_UPDATE: "iam:roles:update",
    ROLE_DELETE: "iam:roles:delete",
    ROLE_ASSIGN: "iam:roles:assign",
    AUDIT_READ: "iam:audit:read",
  };

  if (legacyConstantMap[permission]) {
    return legacyConstantMap[permission];
  }

  // Handle two-part format: users:read -> iam:users:read
  const parts = permission
    .split(":")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 2) {
    return `iam:${parts[0]}:${parts[1]}`;
  }

  // Fallback
  return permission;
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname() ?? "/";

  // Determine whether we're in the admin area
  const isAdminRoute = useMemo(() => {
    return (
      typeof pathname === "string" &&
      (pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        pathname === "/admin")
    );
  }, [pathname]);

  // Build a stable string key for permissions so we can use it safely in deps
  const permissionsKey = useMemo(() => {
    const userPerms = user?.roles?.flatMap((r) => r.permissions ?? []) ?? [];
    return userPerms.join("|");
  }, [user?.roles]);

  // Compute the visible navigation items based on route and permissions
  const filtered = useMemo<NavItem[]>(() => {
    const userPermissions = permissionsKey
      ? permissionsKey.split("|").filter(Boolean)
      : [];

    if (isAdminRoute) {
      // Use the dedicated admin navigation items
      // Check permissions for each item
      return ADMIN_NAV_ITEMS.filter((item) => {
        if (!item.permission) return true;
        if (Array.isArray(item.permission)) {
          return item.permission.some((p) => hasPermission(p, userPermissions));
        }
        return hasPermission(item.permission, userPermissions);
      });
    }

    // Default: show all NAV_ITEMS that the user has permission to see
    return NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;
      if (Array.isArray(item.permission)) {
        return item.permission.some((p) => hasPermission(p, userPermissions));
      }
      return hasPermission(item.permission, userPermissions);
    });
  }, [permissionsKey, isAdminRoute]);

  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function onClick(e: MouseEvent) {
      if (!drawerRef.current) return;
      if (!drawerRef.current.contains(e.target as Node)) onClose();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  return (
    <ShellSidebar
      ref={drawerRef}
      className={`fixed inset-y-0 left-0 z-30 transform lg:transform-none transition-all duration-200 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${collapsed ? "w-[72px] lg:w-[72px]" : "w-[280px] lg:w-[280px]"}`}
    >
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <Image
              src="/brand/assets/logo.png"
              alt="GradeLoop logo"
              fill
              className="object-contain"
            />
          </div>
          <span
            className={`font-semibold text-sidebar-foreground hidden lg:block ${collapsed ? "lg:hidden" : ""}`}
          >
            GradeLoop
          </span>
        </div>

        <div className="ml-auto lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <Icons.x size={18} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="p-3 space-y-1">
          {filtered.map((item) => {
            const linkClass = `flex items-center ${collapsed ? "justify-center" : "gap-3"} truncate w-full`;
            const labelClass = `hidden md:inline-block truncate ${collapsed ? "md:hidden" : ""}`;
            return (
              <SidebarMenuButton key={item.href} asChild>
                <Link href={item.href} className={linkClass}>
                  <span className="shrink-0 text-lg">
                    {item.icon && Icons[item.icon] ? (
                      React.createElement(Icons[item.icon], { size: 18 })
                    ) : (
                      <Icons.dashboard size={18} />
                    )}
                  </span>
                  <span className={labelClass}>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            );
          })}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 w-full">
          <Button
            aria-label="Collapse sidebar"
            variant="ghost"
            onClick={onToggleCollapse}
            className="p-2"
          >
            <Icons.chevronLeft size={18} />
          </Button>
          <div className="ml-2 text-sm text-sidebar-foreground truncate">
            {/* user name optional */}
          </div>
        </div>
      </SidebarFooter>
    </ShellSidebar>
  );
}

export default Sidebar;
