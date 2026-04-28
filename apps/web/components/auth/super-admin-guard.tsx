"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { Loader2, ShieldX } from "lucide-react";

interface SuperAdminGuardProps {
    children: React.ReactNode;
}

/**
 * Protects routes under /super-admin.
 *
 * - Unauthenticated users → /login
 * - Admin → /admin (admins have their own dashboard)
 * - Instructor → /instructor
 * - Student → /student
 * - super_admin → render children
 * - Any other user type → access-denied screen
 */
export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
    const router = useRouter();
    const { user, isHydrated, isLoading, isAuthenticated } = useAuthStore();

    const userType = user?.user_type?.toLowerCase().trim() ?? "";
    const isSuperAdmin = userType === "super_admin";
    const isAdmin = userType === "admin";
    const isInstructor = userType === "instructor";
    const isStudent = userType === "student";

    useEffect(() => {
        if (!isHydrated || isLoading) return;

        if (!isAuthenticated) {
            router.replace("/login");
            return;
        }
        if (isStudent) {
            router.replace("/student");
            return;
        }
        if (isInstructor) {
            router.replace("/instructor");
            return;
        }
        if (isAdmin) {
            router.replace("/admin");
            return;
        }
    }, [isHydrated, isLoading, isAuthenticated, isAdmin, isInstructor, isStudent, router]);

    // Waiting for hydration
    if (!isHydrated || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifying access…</p>
                </div>
            </div>
        );
    }

    // Redirect in-flight
    if (!isAuthenticated || isStudent || isInstructor || isAdmin) return null;

    // Wrong user type (not super_admin)
    if (!isSuperAdmin) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-zinc-400">
                <ShieldX className="h-12 w-12 text-red-400" />
                <p className="text-base font-medium text-red-500">
                    You don&apos;t have permission to view the super admin dashboard.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
