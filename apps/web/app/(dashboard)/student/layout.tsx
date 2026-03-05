"use client";

import { StudentGuard } from "@/components/auth/student-guard";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <StudentGuard>{children}</StudentGuard>;
}
