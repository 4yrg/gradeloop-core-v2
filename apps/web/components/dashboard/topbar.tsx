"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Menu, Plus, Upload, LayoutGrid, List } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/authStore";

interface TopbarProps {
  onMenuClick?: () => void;
  className?: string;
}

export function Topbar({ onMenuClick, className }: TopbarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  // Format pathname as Title
  const paths = pathname.split("/").filter(Boolean);
  const currentPath = paths[paths.length - 1]
    ? paths[paths.length - 1].charAt(0).toUpperCase() + paths[paths.length - 1].slice(1)
    : "Dashboard";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-[72px] items-center justify-between border-b bg-background/95 backdrop-blur-xl px-6 lg:px-8 transition-colors duration-300",
        className,
      )}
    >
      {/* Left section: Mobile menu & Contextual Title / Avatars */}
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

      {/* Middle section: Navigation Tabs (optional) */}
      <div className="hidden lg:flex items-center gap-6 px-8 text-sm font-medium text-muted-foreground">
        <span className="cursor-pointer hover:text-foreground transition-colors pb-1">Folder</span>
        <span className="cursor-pointer hover:text-foreground transition-colors pb-1">Page</span>
        <span className="cursor-pointer hover:text-foreground transition-colors pb-1">Course</span>
        <span className="cursor-pointer text-primary border-b-2 border-primary pb-1">Learning Path</span>
        <span className="cursor-pointer hover:text-foreground transition-colors pb-1">Wiki</span>
      </div>

      {/* Right section: Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Collaborative avatars (Mockup) */}
        <div className="hidden lg:flex -space-x-2 mr-4">
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="bg-amber-100 text-amber-700 text-xs text-primary">DS</AvatarFallback>
          </Avatar>
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">MK</AvatarFallback>
          </Avatar>
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">AJ</AvatarFallback>
          </Avatar>
        </div>

        <Button variant="outline" className="hidden sm:flex rounded-full h-9 px-4 shadow-sm border-border bg-background">
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>

        <Button className="hidden sm:flex rounded-full h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
          <Plus className="mr-2 h-4 w-4" />
          New Content
        </Button>

        <div className="h-6 w-px bg-border mx-1"></div>

        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="font-semibold font-heading">Notifications</h4>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:text-primary">
                Mark all as read
              </Button>
            </div>
            <div className="py-2">
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 mx-2 rounded-lg cursor-pointer">
                <div className="flex w-full items-start justify-between">
                  <p className="text-sm font-medium">New assignment submitted</p>
                  <span className="text-xs text-muted-foreground">5m ago</span>
                </div>
                <p className="text-xs text-muted-foreground">John Doe submitted Assignment #5</p>
              </DropdownMenuItem>
              {/* More items... */}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
