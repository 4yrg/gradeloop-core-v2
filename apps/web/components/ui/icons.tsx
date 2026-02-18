"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Menu,
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  ChevronLeft,
  X,
  Bell,
  User,
  Sun,
  Moon,
  GraduationCap,
  BarChart3,
  Download,
  Shield,
  FileCheck,
  Settings,
  Building,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface IconsType {
  menu: LucideIcon;
  dashboard: LucideIcon;
  book: LucideIcon;
  assignment: LucideIcon;
  users: LucideIcon;
  chevronLeft: LucideIcon;
  x: LucideIcon;
  bell: LucideIcon;
  user: LucideIcon;
  sun: LucideIcon;
  moon: LucideIcon;
  grade: LucideIcon;
  analytics: LucideIcon;
  import: LucideIcon;
  roles: LucideIcon;
  audit: LucideIcon;
  settings: LucideIcon;
  institution: LucideIcon;
  help: LucideIcon;
  logout: LucideIcon;
  chevronDown: LucideIcon;
  profile: LucideIcon;
}

export const Icons: IconsType = {
  menu: Menu,
  dashboard: LayoutDashboard,
  book: BookOpen,
  assignment: FileText,
  users: Users,
  chevronLeft: ChevronLeft,
  x: X,
  bell: Bell,
  user: User,
  sun: Sun,
  moon: Moon,
  grade: GraduationCap,
  analytics: BarChart3,
  import: Download,
  roles: Shield,
  audit: FileCheck,
  settings: Settings,
  institution: Building,
  help: HelpCircle,
  logout: LogOut,
  chevronDown: ChevronDown,
  profile: User,
};

export default Icons;
