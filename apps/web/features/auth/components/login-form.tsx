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
import { apiClient } from "@/lib/api";
import { useAuth } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function LoginFormComponent() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const { login } = useAuth();
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
      // Call the login API
      const result = await apiClient.login({
        email,
        password
      });
      
      // Update auth state
      login(
        result.user,
        {
          id: result.session_id,
          user_id: result.user.id,
          device_name: "Web Browser",
          is_active: true,
          last_activity: new Date().toISOString(),
          expires_at: new Date(Date.now() + (result.expires_in * 1000)).toISOString(),
          created_at: new Date().toISOString()
        },
        Date.now() + (result.expires_in * 1000),
        result.session_id
      );
      
      toast.success("Login successful!");
      
      // Redirect to dashboard
      router.push("/");
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Extract error message
      let errorMessage = "Login failed. Please try again.";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      form.setError("root", { message: errorMessage });
    } finally {
      setIsLoading(false);
    }
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
                      "px-4 py-3 h-12 rounded-lg border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary transition-colors placeholder:text-slate-400",
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
                <FormLabel className="text-[#002333]">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isLoading}
                      {...field}
                      className={cn(
                        "px-4 py-3 h-12 pr-12 rounded-lg border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary transition-colors placeholder:text-slate-400",
                        form.formState.errors.password &&
                          "border-destructive focus:ring-destructive",
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

export { LoginFormComponent as LoginForm };
