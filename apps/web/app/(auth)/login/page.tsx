"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  ArrowRight,
  Terminal,
  Code,
  Eye,
  EyeOff,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { authApi } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/axios";
import { useAuthStore } from "@/lib/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubLogin = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/auth/github`, {
        credentials: "include",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error("Failed to initiate GitHub login");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const response = await authApi.login({ email, password });
      if (!response.access_token) throw new Error("No access token received from server");
      setSession(response.access_token);
      router.push(useAuthStore.getState().getRedirectPath());
      toast.success("Successfully signed in!");
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-auth-card border border-auth-card-border/60 rounded-2xl shadow-2xl shadow-black/20 p-8 md:p-12 relative overflow-hidden">
        {/* Subtle Gradient Overlay */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-auth-button to-transparent opacity-50" />
        
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 mb-6 p-3 bg-auth-bg rounded-xl border border-auth-card-border flex items-center justify-center">
            <img alt="Gradeloop Logo" src="/logo.png" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-3">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            Enter your credentials to access your workspace.
          </p>
        </div>

        {/* GitHub Login Option */}
        <div className="mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGitHubLogin}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive animate-in slide-in-from-top-2">
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                required
                disabled={isLoading}
                className="h-12 pl-12 bg-auth-bg/50 border-auth-card-border focus:ring-auth-button/20 focus:border-auth-button transition-all rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Password
              </Label>
              <Link href="/forgot-password" className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="h-12 pl-12 pr-12 bg-auth-bg/50 border-auth-card-border focus:ring-auth-button/20 focus:border-auth-button transition-all rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 py-1">
            <Checkbox id="remember" className="border-auth-card-border data-[state=checked]:bg-auth-button data-[state=checked]:text-auth-button-foreground" />
            <label htmlFor="remember" className="text-sm text-muted-foreground font-medium cursor-pointer select-none">
              Keep me logged in
            </label>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-bold rounded-xl shadow-lg shadow-auth-button/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>Sign In to Dashboard <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-10">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-full h-[1px] bg-auth-card-border" />
            <span className="relative px-4 bg-auth-card text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Or continue with
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-11 rounded-xl border-auth-card-border bg-auth-bg/30 hover:bg-auth-bg/60 text-xs font-bold font-heading gap-2">
              <Terminal className="h-4 w-4" /> GITHUB
            </Button>
            <Button variant="outline" className="h-11 rounded-xl border-auth-card-border bg-auth-bg/30 hover:bg-auth-bg/60 text-xs font-bold font-heading gap-2">
              <Code className="h-4 w-4" /> SSO
            </Button>
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-emerald-500 font-bold hover:underline transition-all">
              Start for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}