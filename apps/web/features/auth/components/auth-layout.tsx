"use client"

import * as React from "react"
import { motion } from "motion/react"
import { School, HelpCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface AuthLayoutProps {
    children: React.ReactNode
    className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen w-full bg-background font-sans overflow-hidden">
            {/* Left Side: Inspiring Imagery (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#002333]">
                <img
                    alt="Students collaborating"
                    className="absolute inset-0 w-full h-full object-cover"
                    src="/images/auth/auth1.jpg"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#002333]/40 to-[#159999]/60 flex flex-col justify-end p-16 text-white">
                    <div className="max-w-md">
                        <div className="mb-6">
                            <span className="bg-primary/30 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                Education First
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-4 leading-tight">
                            Empowering the next generation of learners.
                        </h1>
                        <p className="text-lg text-white/90">
                            Join thousands of students and educators using GradeLoop to reach
                            their academic milestones every day.
                        </p>
                    </div>
                </div>

                {/* Decorative Branding Element */}
                <div className="absolute top-12 left-12">
                    <div className="flex items-center space-x-2 text-white">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <School className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">GradeLoop</span>
                    </div>
                </div>
            </div>

            {/* Right Side: Login/Auth Content */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white">
                <div className="w-full max-w-md">
                    {/* Mobile Branding */}
                    <div className="flex lg:hidden items-center space-x-2 mb-10">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <School className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-[#002333] tracking-tight">
                            GradeLoop
                        </span>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className={className}
                    >
                        {children}
                    </motion.div>
                </div>
            </div>

            {/* Support Help Bubble */}
            <div className="fixed bottom-6 right-6">
                <button className="bg-[#002333] text-white p-4 rounded-full shadow-2xl hover:bg-primary transition-all group flex items-center space-x-2">
                    <HelpCircle className="h-5 w-5" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-medium">
                        Need help?
                    </span>
                </button>
            </div>
        </div>
    )
}
