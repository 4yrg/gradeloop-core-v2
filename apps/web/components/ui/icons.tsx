"use client";

import React from "react";
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
} from "lucide-react";

export const Icons = {
  menu: (props: any) => <Menu {...props} />,
  dashboard: (props: any) => <LayoutDashboard {...props} />,
  book: (props: any) => <BookOpen {...props} />,
  assignment: (props: any) => <FileText {...props} />,
  users: (props: any) => <Users {...props} />,
  chevronLeft: (props: any) => <ChevronLeft {...props} />,
  x: (props: any) => <X {...props} />,
  bell: (props: any) => <Bell {...props} />,
  user: (props: any) => <User {...props} />,
  sun: (props: any) => <Sun {...props} />,
  moon: (props: any) => <Moon {...props} />,
};

export default Icons;
