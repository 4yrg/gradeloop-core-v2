"use client";

/**
 * Auth layout – wraps /login, /forgot-password, /reset-password.
 *
 * Provides a clean, minimal layout for authentication pages with:
 * - Fixed header with Gradeloop System branding
 * - Surface-bright background
 * - Centered content area
 * - Footer with legal links
 */

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const getRedirectPath = useAuthStore((s) => s.getRedirectPath);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace(getRedirectPath());
    }
  }, [isHydrated, isAuthenticated, getRedirectPath, router]);

  if (!isHydrated || isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-bright">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-primary" />
          <p className="text-sm font-medium text-on-surface-variant animate-pulse">
            Securely initializing...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-auth-bg transition-colors duration-300 overflow-hidden">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-500 delay-300">
        <ThemeToggle />
      </div>

      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] dark:bg-primary/10" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] dark:bg-emerald-500/10" />
      </div>

      {/* Main Content Area */}
      <main className="w-full flex items-center justify-center p-6 relative z-10">
        {children}
      </main>
    </div>
  );
}