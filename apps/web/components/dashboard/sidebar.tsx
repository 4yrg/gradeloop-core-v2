"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  LogOut,
  School,
  Users2,
  ClipboardList,
  Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import { useLogoutMutation } from "@/lib/hooks/useAuthMutation";
import { Button } from "@/components/ui/button";

interface SubNavLink {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: SubNavLink[];
  /** When true, the secondary panel is rendered dynamically instead of from subItems */
  hasDynamicSecondary?: boolean;
}

const adminNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users Management",
    href: "/admin/users",
    icon: Users,
    subItems: [
      { title: "Users", href: "/admin/users", icon: Users },
      {
        title: "Groups & Batches",
        href: "/admin/academics/groups",
        icon: Users2,
      },
    ],
  },
  {
    title: "Academics",
    href: "/admin/academics",
    icon: School,
    subItems: [
      { title: "Faculties", href: "/admin/academics/faculties" },
      { title: "Departments", href: "/admin/academics/departments" },
      { title: "Degrees", href: "/admin/academics/degrees" },
      { title: "Specializations", href: "/admin/academics/specializations" },
      { title: "Courses", href: "/admin/academics/courses" },
      { title: "Semesters", href: "/admin/academics/semesters" },
    ],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

const instructorNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/instructor",
    icon: LayoutDashboard,
  },
  {
    title: "My Courses",
    href: "/instructor/courses",
    icon: BookOpen,
  },
  {
    title: "Settings",
    href: "/instructor/settings",
    icon: Settings,
  },
];

const studentNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/student",
    icon: LayoutDashboard,
  },
  {
    title: "My Courses",
    href: "/student/courses",
    icon: BookOpen,
    hasDynamicSecondary: true,
  },
  {
    title: "Submissions",
    href: "/student/submissions",
    icon: ClipboardList,
  },
  {
    title: "Viva",
    href: "/student/assessments/my-sessions",
    icon: Mic2,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { mutate: logout, isLoading: isLoggingOut } = useLogoutMutation();

  // Determine user role from user_type, not from pathname
  const userType = user?.user_type?.toLowerCase().trim() ?? "";
  const isInstructor = userType === "instructor";
  const isStudent = userType === "student";

  const navItems = isInstructor
    ? instructorNavItems
    : isStudent
      ? studentNavItems
      : adminNavItems;

  const homeHref = isInstructor
    ? "/instructor"
    : isStudent
      ? "/student"
      : "/admin";

  // Determine active primary item
  const activeRoot =
    navItems.find((item) => {
      // Student viva: highlight Viva item for all /student/assessments/* routes
      if (isStudent && pathname.startsWith("/student/assessments"))
        return item.href === "/student/assessments/my-sessions";
      if (item.href === homeHref) return pathname === homeHref;
      // Check if pathname starts with item.href
      if (pathname.startsWith(item.href) && item.href !== homeHref) return true;
      // Check if any subItems match
      if (item.subItems?.some((sub) => pathname.startsWith(sub.href)))
        return true;
      return false;
    }) || navItems[0];

  const isPrimaryCollapsed = collapsed;

  return (
    <div className="relative flex h-screen text-sidebar-foreground transition-all duration-300 z-20">
      {/* Primary Sidebar */}
      <div
        className={cn(
          "relative z-20 flex flex-col items-center bg-sidebar text-sidebar-foreground py-4 transition-all duration-300",
          isPrimaryCollapsed ? "w-16" : "w-64 items-start",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex w-full mb-6",
            isPrimaryCollapsed ? "justify-center" : "justify-start px-4",
          )}
        >
          <Link
            href={homeHref}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a] text-white shadow-sm transition-transform hover:scale-105 overflow-hidden"
          >
            <Image
              src="/logo.png"
              alt="Gradeloop"
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          </Link>
          {!isPrimaryCollapsed && (
            <div className="ml-3 flex flex-col justify-center overflow-hidden">
              <span className="font-bold text-lg leading-tight truncate font-[family-name:var(--font-red-hat-display)] text-white">
                Gradeloop
              </span>
            </div>
          )}
        </div>

        {/* Primary Navigation Icons */}
        <nav
          className={cn(
            "flex flex-1 flex-col gap-3 w-full",
            isPrimaryCollapsed
              ? "px-2 items-center"
              : "px-4 items-stretch overflow-y-auto",
          )}
        >
          {navItems.map((item) => {
            const isActive = activeRoot.title === item.title;
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="w-full">
                <Button
                  variant="ghost"
                  className={cn(
                    "h-12 w-full flex items-center rounded-xl transition-colors",
                    isPrimaryCollapsed
                      ? "justify-center p-0"
                      : "justify-start px-4 gap-3",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                  title={isPrimaryCollapsed ? item.title : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isPrimaryCollapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Primary Actions - Logout only */}
        <div
          className={cn(
            "mt-auto w-full",
            isPrimaryCollapsed
              ? "px-2 flex flex-col items-center"
              : "px-4",
          )}
        >
          <Button
            variant="ghost"
            className={cn(
              "h-12 w-full rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10",
              isPrimaryCollapsed
                ? "w-12 p-0 justify-center"
                : "justify-start px-4 gap-3",
            )}
            onClick={() => logout()}
            disabled={isLoggingOut}
            title="Log out"
          >
            <LogOut className="h-5 w-5" />
            {!isPrimaryCollapsed && (
              <span className="truncate">{isLoggingOut ? "Logging out…" : "Log out"}</span>
            )}
          </Button>
</div>
      </div>
    </div>
  );
}
