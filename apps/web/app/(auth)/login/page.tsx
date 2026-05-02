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
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { authApi } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/axios";
import { useAuthStore } from "@/lib/stores/authStore";

const GRADELOOP_LOGO = "https://lh3.googleusercontent.com/aida/ADBb0ugP-d8dy1zHENxaDQSUeqpN4tKVRw5B7yneXKScqh04MJAais1yPb1ZVvJTYTbUC9qwaEkTr3KNGm5nNblhQHVQOr29l9hTkKd3J_4qPhKh13pmeqzjY5RFA9s8Y1lPZMup1lNZ80NWlPqz_ZE7jNhy0vijcXezOYx1gXcMQJfi4pDlgikaJSqQPu1c0loq-K-_0G4zk1J_XeNxUdxBmN5qRnz1UniV2wryZVt9Zlb7zyej31lRGvs-CllWLJ7g00vFDnj3PSfCdg";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      console.log("[Login] Starting request for:", email);

      const response = await authApi.login({
        email,
        password,
      });

      console.log("[Login] Response received:", response);

      if (!response.access_token) {
        throw new Error("No access token received from server");
      }

      setSession(response.access_token);
      console.log("[Login] Session updated in store");

      const path = useAuthStore.getState().getRedirectPath();
      console.log("[Login] Redirecting to:", path);

      router.push(path);
      toast.success("Successfully signed in!");
    } catch (err) {
      console.error("[Login] Exception:", err);
      const errorMessage = handleApiError(err);
      toast.error(errorMessage);
    } finally {
      console.log("[Login] Process ended");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] bg-white rounded-xl border border-slate-200/60 shadow-xl shadow-slate-200/40 p-10 relative overflow-hidden">
      {/* Glassmorphism Accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl" />

      <div className="flex flex-col items-center mb-10">
        <img
          alt="Gradeloop System Logo"
          className="w-20 h-20 mb-6 object-contain"
          src={GRADELOOP_LOGO}
        />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-on-surface mb-2">
          Welcome Back
        </h1>
        <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
          Continue your journey toward technical mastery.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 p-4 text-error">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div>
          <Label
            htmlFor="email"
            className="block text-xs font-semibold text-on-surface-variant mb-2 ml-1 uppercase tracking-wider"
          >
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-outline" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none transition-all font-[family-name:var(--font-inter)]"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-on-surface-variant ml-1 uppercase tracking-wider"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-secondary hover:underline"
            >
              FORGOT?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-outline" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className="w-full pl-12 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none transition-all font-[family-name:var(--font-inter)]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors outline-none"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 py-2">
          <Checkbox
            id="remember"
            className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container"
          />
          <label
            htmlFor="remember"
            className="text-sm text-on-surface-variant select-none cursor-pointer font-[family-name:var(--font-inter)]"
          >
            Keep me logged in
          </label>
        </div>

        <Button
          type="submit"
          className="w-full py-4 bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)] font-semibold rounded-lg shadow-lg shadow-primary-container/20 active:scale-[0.98] transition-all duration-200"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Sign In to Dashboard <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center">
        <p className="text-sm text-on-surface-variant mb-4 font-[family-name:var(--font-inter)]">
          Or sign in with
        </p>
        <div className="flex gap-4 w-full">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-outline-variant rounded-lg hover:bg-slate-50 transition-colors font-[family-name:var(--font-space-grotesk)] text-sm"
          >
            <Terminal className="h-5 w-5 text-on-surface" />
            <span>Github</span>
          </button>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-outline-variant rounded-lg hover:bg-slate-50 transition-colors font-[family-name:var(--font-space-grotesk)] text-sm"
          >
            <Code className="h-5 w-5 text-on-surface" />
            <span>Stack</span>
          </button>
        </div>
      </div>
    </div>
  );
}