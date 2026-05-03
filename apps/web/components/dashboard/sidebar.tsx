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
  UserCog,
  Mic2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";
import { useAssignmentCreateStore } from "@/lib/stores/assignmentCreateStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useLogoutMutation } from "@/lib/hooks/useAuthMutation";
import { CheckCircle2 } from "lucide-react";
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
      { title: "Roles & Permissions", href: "/admin/roles", icon: UserCog },
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

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { currentStep, steps, setStep, highestStepVisited } = useAssignmentCreateStore();
  const uiSecondarySidebar = useUIStore((s) => s.secondarySidebar);
  const { mutate: logout, isLoading: isLoggingOut } = useLogoutMutation();

  // Determine user role from user_type, not from pathname
  const userType = user?.user_type?.toLowerCase().trim() ?? "";
  const isInstructor = userType === "instructor";
  const isStudent = userType === "student";
  const isAdmin = userType === "admin";

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

  const roleLabel = isInstructor ? "Instructor" : isStudent ? "Student" : "Institute Admin";

  const displayName = user?.full_name || user?.email || "—";
  const initials = user?.full_name
    ? user.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

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

  const hasSubItems = !!(activeRoot?.subItems && activeRoot.subItems.length > 0);
  const isStudentInVivaSection = isStudent && pathname.startsWith("/student/assessments/");
  const hasSecondaryContent = hasSubItems || !!uiSecondarySidebar || isStudentInVivaSection;
  const isCreateAssignment = pathname.includes('/assignments/create');
  const [isHovered, setIsHovered] = React.useState(false);

  const isPrimaryCollapsed = hasSecondaryContent ? !isHovered : collapsed;

  return (
    <div className="relative flex h-screen text-sidebar-foreground transition-all duration-300 z-20">
      {/* Primary Sidebar */}
      <div
        className={cn(
          "relative z-20 flex flex-col items-center bg-sidebar text-sidebar-foreground py-4 transition-all duration-300",
          isPrimaryCollapsed ? "w-16" : "w-64 items-start",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
      {/* Secondary Sidebar Area — only for subItems (course/instructor) or student viva when no store-driven sidebar */}
      {(hasSubItems || (isStudentInVivaSection && !uiSecondarySidebar)) && (
        <div className={cn("relative transition-all duration-300 z-10 w-64")}>
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex flex-col bg-[#1e293b] transition-all duration-300 h-full w-64 items-start",
            )}
          >
            <div className={cn("flex h-16 items-center w-full px-6")}>
              <h2 className="text-lg font-semibold tracking-tight text-white font-heading">
                {isCreateAssignment ? "Create Assignment" : isStudentInVivaSection ? "Viva" : activeRoot?.title || "Overview"}
              </h2>
            </div>
            <ScrollArea className={cn("flex-1 w-full px-4")}>
              <div className="flex flex-col gap-3 py-2 w-full items-center">
                {isCreateAssignment ? (
                  <div className="w-full flex flex-col gap-4 mt-2 relative">
                    {/* Vertical Progress Line */}
                    <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-white/20 -z-10" />
                    <div
                      className="absolute left-[15px] top-6 w-0.5 bg-primary -z-10 transition-all duration-300"
                      style={{ height: `calc(${((currentStep - 1) / (steps.length - 1)) * 100}% - 12px)` }}
                    />

                    {steps.map((step, idx) => {
                      const stepNumber = idx + 1;
                      const isCompleted = stepNumber < currentStep;
                      const isCurrent = stepNumber === currentStep;
                      const isAccessible = stepNumber <= highestStepVisited || isCompleted;

                      return (
                        <button
                          key={step.id}
                          className={cn(
                            "flex items-start gap-3 w-full group text-left transition-all",
                            isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                          )}
                          onClick={() => {
                            if (isAccessible) setStep(stepNumber);
                          }}
                          disabled={!isAccessible}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-semibold transition-colors duration-200 shrink-0 bg-background",
                              isCompleted
                                ? "border-primary bg-primary text-primary-foreground"
                                : isCurrent
                                  ? "border-primary text-primary ring-4 ring-primary/20"
                                  : "border-white/20 text-white/50 group-hover:border-white/40"
                            )}
                          >
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNumber}
                          </div>
                          <div className="flex flex-col pt-1.5">
                            <span
                              className={cn(
                                "text-sm font-semibold transition-colors",
                                isCurrent || isCompleted ? "text-white" : "text-white/60 group-hover:text-white/80"
                              )}
                            >
                              {step.title}
                            </span>
                            {step.description && (
                              <span className="text-xs text-white/60 line-clamp-1">
                                {step.description}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
) : (
                    activeRoot.subItems!.map((subItem) => {
                      const isChildActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/");
                      return (
                        <Link key={subItem.title} href={subItem.href} className="w-full text-left">
                          <Button
                            variant="ghost"
                            className={cn(
                              "h-10 w-full flex items-center rounded-lg transition-colors justify-start px-3",
                              isChildActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <span className="truncate text-sm text-white">{subItem.title}</span>
                          </Button>
                        </Link>
                      );
                    })
                  )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
