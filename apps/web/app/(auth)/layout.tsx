'use client';

/**
 * Auth layout – wraps /login, /forgot-password, /reset-password.
 *
 * Redirects already-authenticated users to their role-based dashboard so they
 * don't land on the login screen unnecessarily.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

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

  // Prevent flash of login content while we're waiting for the session to hydrate
  // or if we're authenticated and about to be redirected.
  if (!isHydrated || isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800 dark:border-zinc-700 dark:border-t-zinc-200" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

