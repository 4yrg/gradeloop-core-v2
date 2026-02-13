import React from "react";
import type { ReactNode } from "react";
import Icons from "@/components/ui/icons";

export type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  requiredPermissions?: string[];
};

// Single source of truth for navigation. Only permission strings are used
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <Icons.dashboard size={18} />,
  },
  {
    label: "Courses",
    href: "/courses",
    icon: <Icons.book size={18} />,
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: <Icons.assignment size={18} />,
  },
  {
    label: "Grading",
    href: "/grading",
    icon: <Icons.assignment size={18} />,
  },
  {
    label: "User Management",
    href: "/users",
    icon: <Icons.users size={18} />,
    requiredPermissions: ["iam:users:read"],
  },
];

export default NAV_ITEMS;
