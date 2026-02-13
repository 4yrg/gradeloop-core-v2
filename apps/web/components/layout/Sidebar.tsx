"use client";

import React, { useEffect, useRef } from "react";
import { NAV_ITEMS, type NavItem } from "@/config/navigation";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import Icons from "@/components/ui/icons";
import Link from "next/link";
import Image from "next/image";
import {
  Sidebar as ShellSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const userPermissions = user?.permissions ?? [];

  const filtered = useMemo(() => {
    return NAV_ITEMS.filter((item: NavItem) => {
      if (!item.requiredPermissions || item.requiredPermissions.length === 0) return true;
      return item.requiredPermissions.some((p) => userPermissions.includes(p));
    });
  }, [userPermissions]);

  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function onClick(e: MouseEvent) {
      if (!drawerRef.current) return;
      if (!drawerRef.current.contains(e.target as Node)) onClose();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  return (
    <ShellSidebar
      ref={drawerRef}
      className={`fixed inset-y-0 left-0 z-30 transform lg:transform-none transition-all duration-200 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${collapsed ? 'w-[72px]' : 'w-[280px]'}`}
    >
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <Image src="/brand/assets/logo.png" alt="GradeLoop logo" fill className="object-contain" />
          </div>
          <span className={`font-semibold text-sidebar-foreground hidden lg:block ${collapsed ? 'lg:hidden' : ''}`}>GradeLoop</span>
        </div>

        <div className="ml-auto lg:hidden">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <Icons.x size={18} />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="p-3 space-y-1">
          {filtered.map((item) => {
            const linkClass = `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} truncate w-full`;
            const labelClass = `hidden md:inline-block truncate ${collapsed ? 'md:hidden' : ''}`;
            return (
              <SidebarMenuButton key={item.href} asChild>
                <Link href={item.href} className={linkClass}>
                  <span className="shrink-0 text-lg">{item.icon ?? <Icons.dashboard size={18} />}</span>
                  <span className={labelClass}>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            );
          })}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 w-full">
          <Button aria-label="Collapse sidebar" variant="ghost" onClick={onToggleCollapse} className="p-2">
            <Icons.chevronLeft size={18} />
          </Button>
          <div className="ml-2 text-sm text-sidebar-foreground truncate">{/* user name optional */}</div>
        </div>
      </SidebarFooter>
    </ShellSidebar>
  );
}

export default Sidebar;
