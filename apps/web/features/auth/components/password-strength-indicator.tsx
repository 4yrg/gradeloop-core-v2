"use client"

import * as React from "react"
import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PasswordStrengthIndicatorProps {
    password?: string
    confirmPassword?: string
    className?: string
}

export function PasswordStrengthIndicator({
    password = "",
    confirmPassword = "",
    className
}: PasswordStrengthIndicatorProps) {
    const requirements = [
        {
            label: "At least 8 characters",
            met: password.length >= 8,
        },
        {
            label: "One uppercase letter",
            met: /[A-Z]/.test(password),
        },
        {
            label: "One number or symbol",
            met: /[0-9!@#$%^&*]/.test(password),
        },
        {
            label: "Passwords match",
            met: password.length > 0 && password === confirmPassword,
        },
    ]

    const metCount = requirements.filter((req) => req.met).length
    const progress = (metCount / requirements.length) * 100

    return (
        <div className={cn("space-y-4", className)}>
            {/* Progress Bars */}
            <div className="grid grid-cols-4 gap-2 h-1.5 w-full">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "rounded-full transition-all duration-300",
                            i < metCount
                                ? "bg-[#159999]"
                                : "bg-slate-100"
                        )}
                    />
                ))}
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                {requirements.map((req, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex items-center space-x-2 text-xs font-medium transition-colors",
                            req.met ? "text-[#159999]" : "text-slate-400"
                        )}
                    >
                        {req.met ? (
                            <div className="flex-shrink-0 w-4 h-4 rounded-full border border-[#159999]/20 flex items-center justify-center bg-[#159999]/10">
                                <Check className="h-2.5 w-2.5" />
                            </div>
                        ) : (
                            <Circle className="h-4 w-4 text-slate-200" />
                        )}
                        <span>{req.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
