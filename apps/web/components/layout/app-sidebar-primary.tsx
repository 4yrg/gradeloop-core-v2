"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  BookOpen,
  BarChart3,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/authStore";
import { useLogoutMutation } from "@/lib/hooks/useAuthMutation";

const navItems = [
  { title: "Home", href: "/dashboard", icon: LayoutGrid },
  { title: "Courses", href: "/courses", icon: BookOpen },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Assignments", href: "/assignments", icon: FileText },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebarPrimary() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { mutate: logout } = useLogoutMutation();
  
  const userType = user?.user_type?.toLowerCase().trim() ?? "";
  const homeHref = userType === "instructor" ? "/instructor" : userType === "student" ? "/student" : "/admin";

  const items = navItems.map(item => {
    if (item.title === "Home") return { ...item, href: homeHref };
    if (item.title === "Courses") return { ...item, href: `${homeHref}/courses` };
    if (item.title === "Settings") return { ...item, href: `${homeHref}/settings` };
    return item;
  });

  return (
    <Sidebar 
      collapsible="none"
      className="w-[var(--shell-sidebar-width)] border-r border-[hsl(var(--shell-border))] bg-[hsl(var(--shell-sidebar-bg))] text-[hsl(var(--shell-sidebar-fg))] z-30"
    >
      <SidebarContent className="px-3 py-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-3">
              {items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "relative h-12 px-4 transition-all duration-300 rounded-xl group",
                        isActive 
                          ? "bg-primary/15 text-primary font-bold shadow-[0_0_20px_rgba(38,208,124,0.1)]" 
                          : "text-[hsl(var(--shell-sidebar-fg))]/60 hover:bg-white/5 hover:text-[hsl(var(--shell-sidebar-fg))]"
                      )}
                    >
                      <Link href={item.href}>
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-[0_0_10px_#26d07c]" />
                        )}
                        <item.icon className={cn("h-5 w-5 mr-4 transition-transform group-hover:scale-110", isActive ? "text-primary" : "group-hover:text-[hsl(var(--shell-sidebar-fg))]")} />
                        <span className="text-[15px] tracking-tight">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-b from-white/10 to-transparent border border-white/5 p-5 space-y-4 shadow-xl backdrop-blur-sm mx-2">
          <div className="space-y-1">
            <h4 className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">PRO PLAN</h4>
            <p className="text-[11px] text-[hsl(var(--shell-sidebar-fg))]/50 leading-relaxed font-medium">Get advanced analytics & 24/7 AI tutor access.</p>
          </div>
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] h-9 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] tracking-wider">
            UPGRADE
          </Button>
        </div>

        <div className="px-2 pb-2">
          <Button 
            variant="ghost" 
            onClick={() => logout()}
            className="w-full h-12 justify-start px-4 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all group"
          >
            <LogOut className="h-5 w-5 mr-4 group-hover:translate-x-1 transition-transform" />
            <span className="text-[15px] font-bold">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
