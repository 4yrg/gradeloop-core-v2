"use client"

import { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface DashboardLayoutProps {
    children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
                <Header />
                <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto overflow-x-hidden relative">
                    {children}
                </div>
            </main>
        </div>
    )
}
