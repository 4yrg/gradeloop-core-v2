'use client';

import { motion } from 'motion/react';
import { HeroUIProvider } from '@heroui/react';
import React from 'react';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
            {/* Left Branding Section */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative hidden flex-1 items-center justify-center bg-zinc-950 p-12 lg:flex"
            >
                <div className="z-20 flex w-full max-w-xl flex-col gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                            {/* Logo Placeholder */}
                            <div className="h-5 w-5 bg-emerald-500 rotate-45 rounded-sm" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">GradeLoop.</span>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-5xl font-extrabold tracking-tight text-white leading-tight">
                            Master your <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">coding journey</span> with GradeLoop.
                        </h1>
                        <p className="text-lg text-zinc-400">
                            The ultimate AI-integrated learning management system designed for the next generation of developers.
                        </p>
                    </div>

                    {/* Featured Card Placeholder */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl"
                    >
                        <div className="flex gap-1.5 mb-6">
                            <div className="h-3 w-3 rounded-full bg-red-500/50" />
                            <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                            <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
                        </div>
                        <div className="space-y-3 font-mono text-sm">
                            <p className="text-pink-400">def <span className="text-blue-400">evaluate_code</span>(submission):</p>
                            <p className="pl-4 text-zinc-500"># Initializing AI code analysis...</p>
                            <p className="pl-4 text-zinc-300">score = ai_engine.analyze(submission)</p>
                            <p className="pl-4 text-zinc-400">return {"{"}</p>
                            <p className="pl-8 text-zinc-400">"grade": score.value,</p>
                            <p className="pl-8 text-zinc-400">"feedback": score.comments</p>
                            <p className="pl-4 text-zinc-400">{"}"}</p>
                        </div>
                    </motion.div>
                </div>

                {/* Background Decorative Elements */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-50" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
            </motion.div>

            {/* Right Form Section */}
            <main className="flex flex-1 items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md space-y-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
