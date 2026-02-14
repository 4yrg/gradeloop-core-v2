"use client";

import React from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import Icons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

type TopBarProps = {
  onToggleSidebar: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function TopBar({ onToggleSidebar, isCollapsed, onToggleCollapse }: TopBarProps) {
  function handleToggle() {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) {
      onToggleCollapse();
    } else {
      onToggleSidebar();
    }
  }

  return (
    <header className="h-16 bg-[var(--card)] border-b border-neutral-gray/10 flex items-center justify-between px-4 lg:px-6 shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          aria-label="Toggle sidebar"
          aria-expanded={!isCollapsed}
          onClick={handleToggle}
          className="p-2 rounded-md text-[var(--foreground)] hover:bg-[var(--primary)]/10 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Icons.menu size={18} />
        </button>
        <div className="ml-2">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">{/* Dynamic title can be injected by pages */}</h1>
          <div className="mt-1">
            <Breadcrumbs />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Icons.bell size={18} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => {
            const ev = new CustomEvent("gradeloop:toggle-theme");
            window.dispatchEvent(ev);
          }}
        >
          <Icons.moon size={18} />
        </Button>

        <div className="relative">
          <Button variant="ghost" className="flex items-center gap-2 p-0" aria-label="Open user menu">
            <img src="/images/avatar-placeholder.png" alt="User avatar" className="w-8 h-8 rounded-full object-cover" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
