"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useNotificationStore } from "@/lib/stores/notificationStore";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useLogoutMutation } from "@/lib/hooks/useAuthMutation";
import type { Notification } from "@/types/notification.types";

interface SubNavLink {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  subItems?: SubNavLink[];
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", href: "/admin" },
  { title: "Users Management", href: "/admin/users", subItems: [
    { title: "Users", href: "/admin/users" },
    { title: "Groups & Batches", href: "/admin/academics/groups" },
  ]},
  { title: "Academics", href: "/admin/academics", subItems: [
    { title: "Faculties", href: "/admin/academics/faculties" },
    { title: "Departments", href: "/admin/academics/departments" },
    { title: "Degrees", href: "/admin/academics/degrees" },
    { title: "Specializations", href: "/admin/academics/specializations" },
    { title: "Courses", href: "/admin/academics/courses" },
    { title: "Semesters", href: "/admin/academics/semesters" },
  ]},
  { title: "Settings", href: "/admin/settings" },
];

const instructorNavItems: NavItem[] = [
  { title: "Dashboard", href: "/instructor" },
  { title: "My Courses", href: "/instructor/courses" },
  { title: "Settings", href: "/instructor/settings" },
];

const studentNavItems: NavItem[] = [
  { title: "Dashboard", href: "/student" },
  { title: "My Courses", href: "/student/courses" },
  { title: "Submissions", href: "/student/submissions" },
  { title: "Viva", href: "/student/assessments/my-sessions" },
];

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const TYPE_ICONS: Record<string, string> = {
  viva_result_ready: "🎤",
  viva_completed: "👨‍🏫",
  assignment_graded: "📊",
  submission_received: "📝",
  deadline_approaching: "⏰",
  enrollment_confirmed: "✅",
  account_activated: "🔓",
  grade_published: "📈",
  email_failed: "⚠️",
};

function getNotificationRoute(notification: Notification): string | null {
  const data = notification.data as Record<string, unknown> | null;
  if (!data) return null;

  const sessionId = data.session_id as string | undefined;
  const assignmentId = data.assignment_id as string | undefined;

  switch (notification.type) {
    case "viva_result_ready":
      if (sessionId) return `/student/assessments/viva/${sessionId}`;
      return null;
    case "viva_completed":
      if (assignmentId && sessionId)
        return `/instructor/courses/${data.instance_id || ""}/assignments/${assignmentId}/viva/${sessionId}`;
      return null;
    default:
      return null;
  }
}

interface TopbarProps {
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export function Topbar({ onMenuClick, sidebarCollapsed, onSidebarCollapsedChange, className }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const pageTitle = useUIStore((s) => s.pageTitle);
  const { mutate: logout, isLoading: isLoggingOut } = useLogoutMutation();

  // Determine user role and nav items
  const userType = user?.user_type?.toLowerCase().trim() ?? "";
  const isInstructor = userType === "instructor";
  const isStudent = userType === "student";
  const navItems = isInstructor ? instructorNavItems : isStudent ? studentNavItems : adminNavItems;

  // Find active parent nav item based on pathname
  const activeNavItem = navItems.find((item) => {
    if (pathname === item.href) return true;
    if (item.subItems?.some((sub) => pathname.startsWith(sub.href))) return true;
    return false;
  });

  const activeSubItems = activeNavItem?.subItems;

  useNotifications();

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);

  const paths = pathname.split("/").filter(Boolean);
  const pathDerivedTitle = paths[paths.length - 1]
    ? paths[paths.length - 1].charAt(0).toUpperCase() + paths[paths.length - 1].slice(1)
    : "Dashboard";

  const currentPath = pageTitle || pathDerivedTitle;

  const displayName = user?.full_name || user?.email || "—";
  const initials = user?.full_name
    ? user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-[72px] items-center justify-between border-b bg-background/95 backdrop-blur-xl px-6 lg:px-8 transition-colors duration-300",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSidebarCollapsedChange?.(!sidebarCollapsed)}
            className="h-10 w-10 rounded-xl hover:bg-accent transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
          <div>
            <h1 className="text-lg font-bold font-[family-name:var(--font-red-hat-display)]">{currentPath}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary"></span>
              Workspace Active
            </p>
          </div>
        </div>

        {/* Sub-navigation */}
        {activeSubItems && activeSubItems.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 ml-8">
            {activeSubItems.map((subItem) => {
              const isActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
              return (
                <Link key={subItem.href} href={subItem.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {subItem.title}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-full pl-10 bg-muted/50 border-0 rounded-xl font-[family-name:var(--font-red-hat-display)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="font-semibold font-[family-name:var(--font-red-hat-display)]">Notifications</h4>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary hover:text-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead();
                  }}
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 mx-2 rounded-lg cursor-pointer",
                      !notification.read && "bg-muted/50",
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification.id);
                      }
                      const route = getNotificationRoute(notification);
                      if (route) {
                        router.push(route);
                      }
                    }}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm shrink-0">
                          {TYPE_ICONS[notification.type] || "🔔"}
                        </span>
                        <p className={cn(
                          "text-sm truncate",
                          !notification.read && "font-medium",
                        )}>
                          {notification.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        <button
                          className="p-0.5 rounded hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                      {notification.message}
                    </p>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            {notifications.length > 10 && (
              <div className="border-t border-border px-4 py-2">
                <p className="text-xs text-center text-muted-foreground">
                  Showing latest 10 notifications
                </p>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors p-0"
            >
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Profile</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-border">
            <div className="px-3 py-2">
              <p className="text-sm font-medium font-[family-name:var(--font-red-hat-display)]">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex w-full cursor-pointer items-center">
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="text-red-600 gap-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
              {isLoggingOut ? "Logging out…" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}