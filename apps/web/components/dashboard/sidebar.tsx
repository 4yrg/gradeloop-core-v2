"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    Upload,
    ShieldAlert,
    Mic,
    BarChart2,
    Settings,
    GraduationCap
} from "lucide-react"

const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Courses", href: "/courses", icon: BookOpen },
    { name: "Assignments", href: "/assignments", icon: FileText },
    { name: "Submissions", href: "/submissions", icon: Upload },
    { name: "Plagiarism Review", href: "/plagiarism", icon: ShieldAlert },
    { name: "Viva Sessions", href: "/viva", icon: Mic },
    { name: "Analytics", href: "/analytics", icon: BarChart2 },
    { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
            <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                        <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">GradeLoop</span>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-inset ring-sidebar-border/10 border-l-2 border-l-primary"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                            {item.name}
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(76,91,212,0.6)]" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-sidebar-border">
                <div className="rounded-lg bg-sidebar-accent/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">GradeLoop AI</p>
                    <p>v2.0.4 • Stable</p>
                </div>
            </div>
        </aside>
    )
}
