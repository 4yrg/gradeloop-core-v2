"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function ResetPasswordFormComponent() {
  const [errorMsg, setErrorMsg] = React.useState("");
  const search = useSearchParams();
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const form = useForm({
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");

  const onSubmit = async (data: any) => {
    // Custom validation
    const password = data.password || "";
    const confirmPassword = data.confirmPassword || "";

    // Validate password
    if (!password || password.length < 8) {
      form.setError("password", { message: "Password must be at least 8 characters long" });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      form.setError("password", { message: "Password must contain at least one uppercase letter" });
      return;
    }
    if (!/[0-9!@#$%^&*]/.test(password)) {
      form.setError("password", { message: "Password must contain at least one number or symbol" });
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      form.setError("confirmPassword", { message: "Passwords do not match" });
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    try {
      const token = search.get("token") || "";
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";
      const res = await fetch(`${base}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: data.password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg((j && (j.error || j.message)) || "Failed to reset password");
        setIsLoading(false);
        return;
      }
      setIsSubmitted(true);
      // optionally redirect to login after short delay
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setErrorMsg("Network error, please try again");
    } finally {
      setIsLoading(false);
    }
  };

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

export { ResetPasswordFormComponent as ResetPasswordForm };
