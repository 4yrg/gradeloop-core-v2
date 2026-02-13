"use client"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"

export default function LoginPage() {
    return (
        <AuthLayout>
            <LoginForm />
        </AuthLayout>
    )
}
