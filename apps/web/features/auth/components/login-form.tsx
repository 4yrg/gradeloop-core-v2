"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import { useAuthActions } from "../hooks/use-auth-actions";
import { useAuth } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function LoginFormComponent() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const { login } = useAuth();
  const { login: loginAction, isLoggingIn } = useAuthActions();
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(data: any) {
    // Custom validation
    const email = data.email || "";
    const password = data.password || "";

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.setError("email", { message: "Please enter a valid email address" });
      return;
    }

    // Validate password
    if (!password || password.length < 8) {
      form.setError("password", { message: "Password must be at least 8 characters long" });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("[LOGIN] Attempting login with email:", email);
      
      // Use the auth hook for login
      const result = await loginAction({
        email,
        password
      });
      
      // The hook handles auth state updates and redirects
      // Success message and redirect are handled in the hook
      
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Extract error message
      let errorMessage = "Login failed. Please try again.";
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Set form error for display
      form.setError("email", { message: errorMessage });
      form.setError("password", { message: " " }); // Empty space to trigger error display
      
      // Toast is handled by the hook
    } finally {
      setIsLoading(false);
    }
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
            disabled={isLoading || isLoggingIn}
          >
            {(isLoading || isLoggingIn) ? (
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

export { LoginFormComponent as LoginForm };
