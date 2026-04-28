"use client";

import { AdminGuard } from "@/components/auth/admin-guard";
import { InstituteProvider, InstituteBadge } from "@/components/institute-context/institute-context";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <InstituteProvider>
            <AdminGuard>
                <div className="flex flex-col min-h-screen">
                    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="container flex h-14 items-center justify-between px-4">
                            <InstituteBadge />
                        </div>
                    </header>
                    <main className="flex-1">{children}</main>
                </div>
            </AdminGuard>
        </InstituteProvider>
    );
}