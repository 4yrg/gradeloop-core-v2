"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Menu, LayoutGrid, Check, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
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
  assignment_graded: "📊",
  submission_received: "📝",
  deadline_approaching: "⏰",
  enrollment_confirmed: "✅",
  account_activated: "🔓",
  grade_published: "📈",
  email_failed: "⚠️",
};

interface TopbarProps {
  onMenuClick?: () => void;
  className?: string;
}

export function Topbar({ onMenuClick, className }: TopbarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const pageTitle = useUIStore((s) => s.pageTitle);

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

        <div className="hidden md:flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading">{currentPath}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Workspace Active
            </p>
          </div>
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
              <h4 className="font-semibold font-heading">Notifications</h4>
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
      </div>
    </header>
  );
}