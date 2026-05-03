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
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/authStore";
import { Button } from "@/components/ui/button";

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
    <div className="relative min-h-screen flex flex-col bg-auth-bg transition-colors duration-300">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] dark:bg-primary/10" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] dark:bg-emerald-500/10" />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-50 flex justify-center px-6 py-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-foreground font-heading">
              Gradeloop System
            </span>
          </Link>
          
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-8 font-medium">
              <Link className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#">
                Support
              </Link>
              <Link className="text-sm text-muted-foreground hover:text-foreground transition-colors" href="#">
                Documentation
              </Link>
            </nav>
            <Link href="/register">
              <Button className="px-6 h-10 rounded-lg bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-semibold transition-all active:scale-95">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-6 py-32 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full py-10 px-6 border-t border-auth-card-border/50 relative z-10">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-base font-bold text-foreground font-heading tracking-tight">Gradeloop System</span>
            <p className="text-xs text-muted-foreground">© 2024 Gradeloop System. Precision in Learning.</p>
          </div>
          <div className="flex gap-10">
            <Link className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
              Privacy Policy
            </Link>
            <Link className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
              Terms of Service
            </Link>
            <Link className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}