"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { LoginSchema, type LoginValues } from "../schemas/auth.schema"
import { cn } from "@/lib/utils"

export function LoginForm() {
    const [showPassword, setShowPassword] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)

    const form = useForm<LoginValues>({
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
        <div className="w-full">
            <div className="mb-10">
                <h2 className="text-3xl font-bold text-[#002333] mb-2">Welcome back</h2>
                <p className="text-slate-500">
                    Enter your details to access your dashboard.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[#002333] mb-2">
                                    Email Address
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="e.g. alex@example.com"
                                        type="email"
                                        disabled={isLoading}
                                        {...field}
                                        className={cn(
                                            "px-4 py-3 h-12 rounded-lg border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors",
                                            form.formState.errors.email &&
                                            "border-destructive focus:ring-destructive"
                                        )}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[#002333]">Password</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            disabled={isLoading}
                                            {...field}
                                            className={cn(
                                                "px-4 py-3 h-12 pr-12 rounded-lg border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary transition-colors",
                                                form.formState.errors.password &&
                                                "border-destructive focus:ring-destructive"
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex items-center justify-between">
                        <FormField
                            control={form.control}
                            name="rememberMe"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={field.onChange}
                                            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                        />
                                    </FormControl>
                                    <FormLabel className="text-sm font-medium text-slate-600 cursor-pointer">
                                        Remember me
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                        <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline transition-all"
                        >
                            Forgot Password?
                        </button>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        disabled={isLoading}
                    >
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
            </Form>

            {/* Divider */}
            <div className="relative py-8">
                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500 uppercase tracking-wider text-xs font-semibold">
                        Or continue with
                    </span>
                </div>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#002333] hover:bg-slate-50 transition-colors"
                    type="button"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Google
                </button>
                <button
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#002333] hover:bg-slate-50 transition-colors"
                    type="button"
                >
                    <svg className="h-5 w-5" viewBox="0 0 23 23">
                        <path d="M0 0h23v23H0z" fill="#f3f3f3" />
                        <path d="M1 1h10v10H1z" fill="#f35325" />
                        <path d="M12 1h10v10H12z" fill="#81bc06" />
                        <path d="M1 12h10v10H1z" fill="#05a6f0" />
                        <path d="M12 12h10v10H12z" fill="#ffba08" />
                    </svg>
                    Microsoft
                </button>
            </div>

            <p className="mt-10 text-center text-sm text-slate-500">
                Don&apos;t have an account yet?{" "}
                <button className="font-semibold text-primary hover:text-primary/80 transition-colors">
                    Sign up for free
                </button>
            </p>
        </div>
    )
}
