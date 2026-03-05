"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { Loader2, ShieldX } from "lucide-react";

interface StudentGuardProps {
    children: React.ReactNode;
}

/**
 * Protects routes under /student.
 *
 * - Unauthenticated users → /login
 * - Admin / super_admin  → /admin
 * - employee / instructor → /instructor
 * - student / learner    → render children
 * - Any other role       → access-denied screen
 */
export function StudentGuard({ children }: StudentGuardProps) {
    const router = useRouter();
    const { user, isHydrated, isLoading, isAuthenticated } = useAuthStore();

    const roleName = user?.role_name?.toLowerCase().trim() ?? "";

    const isStudent =
        roleName === "student" ||
        roleName === "learner";

    const isAdmin = roleName === "admin" || roleName === "super_admin";
    const isEmployee =
        roleName === "employee" ||
        roleName.includes("instructor");

    useEffect(() => {
        if (!isHydrated || isLoading) return;

        if (!isAuthenticated) {
            router.replace("/login");
            return;
        }
        if (isAdmin) {
            router.replace("/admin");
            return;
        }
        if (isEmployee) {
            router.replace("/instructor");
        }
    }, [isHydrated, isLoading, isAuthenticated, isAdmin, isEmployee, router]);

    // Waiting for hydration / token restore
    if (!isHydrated || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Verifying access…</p>
                </div>
            </div>
        );
    }

    // Redirect in-flight
    if (!isAuthenticated || isAdmin || isEmployee) return null;

    // Wrong role
    if (!isStudent) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
                <ShieldX className="h-12 w-12 text-destructive" />
                <p className="text-base font-medium text-destructive">
                    You don&apos;t have permission to view the student portal.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
