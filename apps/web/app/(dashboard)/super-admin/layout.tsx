"use client";

import { SuperAdminGuard } from "@/components/auth/super-admin-guard";

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SuperAdminGuard>{children}</SuperAdminGuard>;
}
