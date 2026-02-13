import type { Metadata } from "next"
import { Suspense } from "react"
import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export const metadata: Metadata = {
    title: "Reset Password | GradeLoop",
    description: "Create a new password for your GradeLoop account.",
}

export default function ResetPasswordPage() {
    return (
        <AuthLayout>
            <Suspense fallback={<div>Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </AuthLayout>
    )
}
