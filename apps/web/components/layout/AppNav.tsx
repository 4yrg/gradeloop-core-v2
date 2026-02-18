/**
 * AppNav - Dynamic Navigation Component with Permission Filtering
 *
 * Renders navigation items based on user permissions.
 * Works with both Server and Client Components.
 *
 * @example
 * ```tsx
 * // Client Component
 * "use client";
 *
 * import { AppNav } from "@/components/layout/AppNav";
 * import { useAuth } from "@/lib/auth";
 *
 * function Layout() {
 *   const { user } = useAuth();
 *
 *   return (
 *     <div className="flex">
 *       <AppNav userPermissions={user?.permissions || []} />
 *       <main>{/* ... *\/}</main>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Server Component
 * import { AppNav } from "@/components/layout/AppNav";
 * import { getCurrentUser } from "@/lib/auth";
 *
 * async function Layout() {
 *   const { user } = await getCurrentUser();
 *
 *   return (
 *     <div className="flex">
 *       <AppNav userPermissions={user?.permissions || []} />
 *       <main>{/* ... *\/}</main>
 *     </div>
 *   );
 * }
 * ```
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  getVisibleNavItems,
  getVisibleAdminNavItems,
  type NavItem,
} from "@/config/navigation";
import { usePermission } from "@/hooks/use-permission";
import Icons from "@/components/ui/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";

// ============================================================================
// AppNav Component
// ============================================================================

export interface AppNavProps {
  /** User's permissions array (from auth context or server) */
  userPermissions: string[];
  /** Whether to show admin navigation */
  isAdminNav?: boolean;
  /** Current user for user menu */
  user?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  } | null;
  /** Logout handler */
  onLogout?: () => void;
}

/**
 * AppNav - Main navigation component with permission filtering
 */
export function AppNav({
  userPermissions,
  isAdminNav = false,
  user,
  onLogout,
}: AppNavProps): React.JSX.Element {
  const pathname = usePathname();

  // Get visible items based on permissions
  const visibleItems = isAdminNav
    ? getVisibleAdminNavItems(userPermissions)
    : getVisibleNavItems(userPermissions);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative h-8 w-8">
            <Image
              src="/brand/assets/logo.png"
              alt="GradeLoop logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            GradeLoop
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isAdminNav ? "Administration" : "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : ""
                        }`}
                        title={item.description}
                      >
                        {item.icon && Icons[item.icon] && (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                            {React.createElement(Icons[item.icon], {
                              size: 18,
                            })}
                          </span>
                        )}
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {item.badge && (
                          <Badge
                            variant={item.badgeVariant || "default"}
                            className="ml-auto"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors hover:bg-sidebar-accent">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">
                    {user.full_name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <Icons.chevronDown
                  size={16}
                  className="text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <Icons.profile className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Icons.settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Icons.logout className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// ============================================================================
// Mobile Navigation Component
// ============================================================================

/**
 * MobileNav - Mobile-friendly navigation with drawer
 */
export function MobileNav({
  userPermissions,
  isOpen,
  onClose,
  isAdminNav = false,
}: {
  userPermissions: string[];
  isOpen: boolean;
  onClose: () => void;
  isAdminNav?: boolean;
}): React.JSX.Element | null {
  const pathname = usePathname();
  const visibleItems = isAdminNav
    ? getVisibleAdminNavItems(userPermissions)
    : getVisibleNavItems(userPermissions);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-background shadow-lg">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6">
                <Image
                  src="/brand/assets/logo.png"
                  alt="GradeLoop logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-semibold">GradeLoop</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-accent"
              aria-label="Close navigation"
            >
              <Icons.x size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    pathname === item.href
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {item.icon && Icons[item.icon] && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                      {React.createElement(Icons[item.icon], { size: 18 })}
                    </span>
                  )}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge && (
                    <Badge variant={item.badgeVariant || "default"}>
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Navigation Hook
// ============================================================================

/**
 * useNavigation - Hook for navigation state and utilities
 */
export function useNavigation(userPermissions: string[]) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const navItems = React.useMemo(
    () => getVisibleNavItems(userPermissions),
    [userPermissions],
  );
  const adminNavItems = React.useMemo(
    () => getVisibleAdminNavItems(userPermissions),
    [userPermissions],
  );

  const openMobile = React.useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = React.useCallback(() => setIsMobileOpen(false), []);
  const toggleMobile = React.useCallback(
    () => setIsMobileOpen((prev) => !prev),
    [],
  );

  return {
    navItems,
    adminNavItems,
    isMobileOpen,
    openMobile,
    closeMobile,
    toggleMobile,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { AppNav as default };
