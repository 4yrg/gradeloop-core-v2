"use client"

import { Bell, Search, User, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function Header() {
    return (
        <header className="h-16 px-6 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-96 group">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search courses, students, or assignments..."
                        className="pl-9 bg-secondary/50 border-transparent focus-visible:bg-secondary focus-visible:ring-primary/20 transition-all rounded-full h-9 text-sm"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background" />
                </Button>

                <div className="h-8 w-px bg-border mx-1" />

                <button className="flex items-center gap-3 pl-2 py-1 rounded-full hover:bg-secondary/50 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white ring-2 ring-background shadow-lg">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col items-start mr-2">
                        <span className="text-sm font-medium leading-none">Prof. Anderson</span>
                        <span className="text-xs text-muted-foreground">Admin</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground mr-2" />
                </button>
            </div>
        </header>
    )
}
