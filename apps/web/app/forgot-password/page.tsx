import type { Metadata } from "next"
import { AuthLayout } from "@/features/auth/components/auth-layout"
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = {
    title: "Forgot Password | GradeLoop",
    description: "Reset your password to regain access to your GradeLoop account.",
}

export default function ForgotPasswordPage() {
    return (
        <AuthLayout>
            <ForgotPasswordForm />
        </AuthLayout>
    )
}
