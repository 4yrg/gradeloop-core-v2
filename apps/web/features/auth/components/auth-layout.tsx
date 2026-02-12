"use client"

import * as React from "react"
import { motion } from "motion/react"
import { GraduationCap } from "lucide-react"

import { cn } from "@/lib/utils"

interface AuthLayoutProps {
    children: React.ReactNode
    className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-background overflow-hidden">
            {/* Left Panel - Branding & Illustration */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative hidden w-1/2 flex-col justify-between p-10 md:flex bg-muted/30"
            >
                {/* Background Overlay Effect */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-2 text-primary">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-ai-glow">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <span className="text-2xl font-bold tracking-tight">GradeLoop</span>
                </div>

                {/* Content / Tagline */}
                <div className="relative z-10 mt-auto max-w-lg space-y-6">
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition-colors">
                        EDUCATION FIRST
                    </div>
                    <h1 className="text-5xl font-bold leading-tight tracking-tighter text-foreground">
                        Empowering the next generation of learners.
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Join thousands of students and educators using GradeLoop to reach their academic milestones every day.
                    </p>
                </div>

                {/* Decorative Element */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background to-transparent opacity-40" />
            </motion.div>

            {/* Right Panel - Auth Content */}
            <div className="flex flex-1 items-center justify-center p-6 md:p-12 lg:p-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className={cn("w-full max-w-[400px] space-y-8", className)}
                >
                    {children}
                </motion.div>
            </div>

            {/* Mobile Branding (only visible on small screens) */}
            <div className="absolute top-6 left-6 flex items-center gap-2 md:hidden text-primary">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold">GradeLoop</span>
            </div>
        </div>
    )
}
