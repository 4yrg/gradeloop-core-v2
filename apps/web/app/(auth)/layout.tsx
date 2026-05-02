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
    <div className="relative min-h-screen flex flex-col bg-surface-bright">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 font-[family-name:var(--font-space-grotesk)]">
              Gradeloop System
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-[family-name:var(--font-space-grotesk)] font-medium">
            <Link className="text-slate-600 hover:text-primary-container transition-colors duration-200" href="#">
              Support
            </Link>
            <Link className="text-slate-600 hover:text-primary-container transition-colors duration-200" href="#">
              Documentation
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)] font-medium active:scale-95 transition-transform">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-screen pt-32 pb-20 flex items-center justify-center px-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 border-t border-slate-200 font-[family-name:var(--font-space-grotesk)] text-sm">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-lg font-semibold text-slate-900">Gradeloop System</span>
            <p className="text-slate-500">© 2024 Gradeloop System. Precision in Learning.</p>
          </div>
          <div className="flex gap-8">
            <Link className="text-slate-500 hover:text-slate-900 underline transition-all duration-300" href="#">
              Privacy Policy
            </Link>
            <Link className="text-slate-500 hover:text-slate-900 underline transition-all duration-300" href="#">
              Terms of Service
            </Link>
            <Link className="text-slate-500 hover:text-slate-900 underline transition-all duration-300" href="#">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}