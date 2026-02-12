"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginSchema, type LoginValues } from "../schemas/auth.schema"
import { cn } from "@/lib/utils"

export function LoginForm() {
    const [showPassword, setShowPassword] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginValues>({
        resolver: zodResolver(LoginSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    })

    async function onSubmit(data: LoginValues) {
        setIsLoading(true)
        // Simulate API call
        console.log("Login data:", data)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        setIsLoading(false)
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
                <p className="text-muted-foreground">
                    Enter your details to access your dashboard.
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                    <label
                        htmlFor="email"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Email Address
                    </label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="e.g. alex@example.com"
                        disabled={isLoading}
                        {...register("email")}
                        className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                    />
                    {errors.email && (
                        <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Password
                        </label>
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={isLoading}
                            {...register("password")}
                            className={cn(
                                "pr-10",
                                errors.password && "border-destructive focus-visible:ring-destructive"
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            {...register("rememberMe")}
                            className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all cursor-pointer accent-primary"
                        />
                        <label
                            htmlFor="rememberMe"
                            className="text-sm font-medium leading-none cursor-pointer"
                        >
                            Remember me
                        </label>
                    </div>
                    <button
                        type="button"
                        className="text-sm font-semibold text-primary hover:underline transition-all"
                    >
                        Forgot Password?
                    </button>
                </div>

                <Button type="submit" className="w-full h-11" disabled={isLoading} variant="ai" glow>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing In...
                        </>
                    ) : (
                        "Sign In"
                    )}
                </Button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground font-medium">
                        Or continue with
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-11 border-muted hover:bg-muted/50 transition-colors" type="button">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Google
                </Button>
                <Button variant="outline" className="h-11 border-muted hover:bg-muted/50 transition-colors" type="button">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path d="M1 1h10v10H1z" fill="#f25022" />
                        <path d="M13 1h10v10H13z" fill="#7dbb00" />
                        <path d="M1 13h10v10H1z" fill="#00a1f1" />
                        <path d="M13 13h10v10H13z" fill="#ffbb00" />
                    </svg>
                    Microsoft
                </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account yet?{" "}
                <button className="font-semibold text-primary hover:underline transition-all">
                    Sign up for free
                </button>
            </p>
        </div>
    )
}
