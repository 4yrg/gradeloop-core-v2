"use client";

import * as React from "react";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="h-10 flex items-center justify-between px-8 bg-[hsl(var(--shell-header-bg))] border-t border-[hsl(var(--shell-border))] text-[hsl(var(--shell-header-fg))]/30 text-[10px] font-bold tracking-widest uppercase z-40 w-full">
      <div className="flex items-center gap-8">
        <span>© 2024 Gradeloop System. Precision in Learning.</span>
      </div>

      <div className="flex items-center gap-8">
        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(38,208,124,0.5)] animate-pulse" />
          <span>System Status: Optimal</span>
        </div>
      </div>
    </footer>
  );
}
