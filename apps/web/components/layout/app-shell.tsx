"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebarPrimary } from "./app-sidebar-primary";
import { AppSidebarSecondary } from "./app-sidebar-secondary";
import { AppHeader } from "./app-header";
import { AppFooter } from "./app-footer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-body tracking-tight">
        
        {/* Main Workspace Area (Sidebars + Header + Stage) */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Dual Sidebars */}
          <AppSidebarPrimary />
          <AppSidebarSecondary />
          
          {/* Main Content Stage (Header + Content) */}
          <div className="flex flex-col flex-1 min-w-0 relative bg-[hsl(var(--background))]">
            <AppHeader />
            
            <main className="flex-1 relative overflow-hidden">
              <ScrollArea className="h-full">
                <div className="container mx-auto p-10 max-w-[1400px]">
                  {children}
                </div>
              </ScrollArea>
              
              {/* Global Floating Action Button */}
              <Button 
                size="icon" 
                className="absolute bottom-10 right-10 h-16 w-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 z-50 transition-all hover:scale-110 active:scale-95 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus className="h-8 w-8" />
              </Button>
            </main>
          </div>
        </div>
        
        {/* Sticky Full-Width Footer */}
        <AppFooter />
      </div>
    </SidebarProvider>
  );
}
