"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

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
import {
  ResetPasswordSchema,
  type ResetPasswordValues,
} from "../schemas/auth.schema";
import { PasswordStrengthIndicator } from "./password-strength-indicator";
import { cn } from "@/lib/utils";

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");

  async function onSubmit(data: ResetPasswordValues) {
    setIsLoading(true);
    console.log("Reset password data:", data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="w-full text-center">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Password Reset
          </h2>
          <p className="text-muted-foreground">
            Your password has been successfully reset. You can now log in with
            your new password.
          </p>
        </div>
        <Link href="/login">
          <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all">
            Proceed to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Set new password
        </h2>
        <p className="text-muted-foreground">
          Create a strong, unique password to secure your account.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">New Password</FormLabel>
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

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    disabled={isLoading}
                    {...field}
                    className={cn(
                      "px-4 py-3 h-12 rounded-lg border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors placeholder:text-muted-foreground",
                      form.formState.errors.confirmPassword &&
                        "border-destructive focus:ring-destructive",
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PasswordStrengthIndicator
            password={password}
            confirmPassword={confirmPassword}
            className="py-2"
          />

          <Button
            type="submit"
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
