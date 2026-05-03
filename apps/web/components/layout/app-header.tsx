"use client";

import * as React from "react";
import { Search, Bell, Grid, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/stores/authStore";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";

export function AppHeader() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-[var(--shell-header-height)] flex items-center justify-between px-8 border-b border-[hsl(var(--shell-border))] bg-[hsl(var(--shell-header-bg))] text-[hsl(var(--shell-header-fg))] sticky top-0 z-40 w-full backdrop-blur-md bg-opacity-80">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 min-w-[240px]">
          <SidebarTrigger className="h-10 w-10 text-[hsl(var(--shell-header-fg))]/60 hover:text-primary hover:bg-primary/10 rounded-xl" />
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
            <span className="font-bold text-xl tracking-tight">
              Gradeloop System
            </span>
          </div>
        </div>
        
        <nav className="hidden xl:flex items-center gap-8">
          <Button variant="link" className="text-[hsl(var(--shell-header-fg))]/60 hover:text-primary p-0 h-auto text-sm font-medium transition-colors">
            Support
          </Button>
          <Button variant="link" className="text-[hsl(var(--shell-header-fg))]/60 hover:text-primary p-0 h-auto text-sm font-medium transition-colors">
            Documentation
          </Button>
        </nav>
      </div>

      <div className="flex flex-1 max-w-2xl mx-12">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--shell-header-fg))]/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search analytics, courses, or students..." 
            className="w-full bg-[hsl(var(--shell-header-bg))]/50 border-[hsl(var(--shell-border))] pl-11 pr-12 h-10 rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary transition-all text-sm font-medium placeholder:text-[hsl(var(--shell-header-fg))]/30"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-10 rounded-md border border-[hsl(var(--shell-border))] bg-[hsl(var(--shell-header-bg))] flex items-center justify-center gap-0.5 opacity-40">
             <Command className="h-3 w-3" />
             <span className="text-[10px] font-bold">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl text-[hsl(var(--shell-header-fg))]/60 hover:text-primary hover:bg-primary/10 transition-all">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary border-2 border-[hsl(var(--shell-header-bg))]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all">
              <div className="h-full w-full flex items-center justify-center bg-primary/10">
                 <Grid className="h-5 w-5 text-primary" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 mt-2 rounded-2xl border-[hsl(var(--shell-border))] bg-[hsl(var(--shell-header-bg))] shadow-2xl p-2">
            <DropdownMenuLabel className="font-normal p-4">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-bold leading-none text-[hsl(var(--shell-header-fg))]">{user?.full_name || "User"}</p>
                <p className="text-xs leading-none text-[hsl(var(--shell-header-fg))]/50">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[hsl(var(--shell-border))]/50 mx-2" />
            <div className="p-1">
              <DropdownMenuItem className="cursor-pointer py-3 px-4 rounded-xl focus:bg-primary/10 focus:text-primary text-[hsl(var(--shell-header-fg))] font-medium mb-1">
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer py-3 px-4 rounded-xl focus:bg-primary/10 focus:text-primary text-[hsl(var(--shell-header-fg))] font-medium">
                System Preferences
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
