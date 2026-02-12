import type { Metadata } from "next"
import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
    title: "Login | GradeLoop",
    description: "Access your GradeLoop dashboard to manage your academic journey.",
}

export default function LoginPage() {
    return (
        <AuthLayout>
            <LoginForm />
        </AuthLayout>
    )
}
