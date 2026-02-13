"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LoginSchema, type LoginValues } from "../schemas/auth.schema";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(data: LoginValues) {
    setIsLoading(true);
    // Simulate API call
    console.log("Login data:", data);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Welcome back
        </h2>
        <p className="text-muted-foreground">
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
                <FormLabel className="text-foreground mb-2">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. alex@example.com"
                    type="email"
                    disabled={isLoading}
                    {...field}
                    className={cn(
                      "px-4 py-3 h-12 rounded-lg border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors placeholder:text-muted-foreground",
                      form.formState.errors.email &&
                        "border-destructive focus:ring-destructive",
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
                <FormLabel className="text-foreground">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isLoading}
                      {...field}
                      className={cn(
                        "px-4 py-3 h-12 pr-12 rounded-lg border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors placeholder:text-muted-foreground",
                        form.formState.errors.password &&
                          "border-destructive focus:ring-destructive",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
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
                      className="h-4 w-4 text-primary focus:ring-primary border-input rounded cursor-pointer accent-primary"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-medium text-muted-foreground cursor-pointer">
                    Remember me
                  </FormLabel>
                </FormItem>
              )}
            />
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline transition-all"
            >
              Forgot Password?
            </Link>
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
    </div>
  );
}
