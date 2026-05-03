"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/axios";
import { cn } from "@/lib/utils";

function getPasswordStrength(password: string) {
  let score = 0;
  if (!password) return { score: 0, label: "WEAK", color: "bg-muted" };

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "WEAK", color: "bg-destructive" };
  if (score <= 4) return { score: 2, label: "MEDIUM", color: "bg-amber-500" };
  return { score: 3, label: "STRONG", color: "bg-auth-button" };
}

function ResetPasswordCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-500", className)}>
      <div className="bg-auth-card border border-auth-card-border/60 rounded-2xl shadow-2xl shadow-black/20 p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-auth-button to-transparent opacity-50" />
        {children}
      </div>
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    if (strength.score < 2) {
      setValidationError("Please choose a stronger password");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({
        token,
        new_password: password,
      });
      setIsSuccess(true);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <ResetPasswordCard>
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-20 h-20 mb-8 p-4 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
            <XCircle className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-4">
            Invalid Link
          </h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/forgot-password" className="block">
            <Button className="w-full h-12 bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-bold rounded-xl shadow-lg shadow-auth-button/20 transition-all">
              Request New Link
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground font-heading font-bold">
              Back to Login
            </Button>
          </Link>
        </div>
      </ResetPasswordCard>
    );
  }

  if (isSuccess) {
    return (
      <ResetPasswordCard>
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-20 h-20 mb-8 p-4 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-4">
            Success!
          </h1>
          <p className="text-sm text-muted-foreground">
            Your password has been successfully reset.
          </p>
        </div>

        <div className="bg-auth-bg/50 border border-auth-button/20 rounded-xl p-4 flex items-center gap-3 text-emerald-500 mb-8">
          <ShieldCheck className="h-5 w-5" />
          <p className="text-xs font-bold uppercase tracking-widest">
            Security settings updated.
          </p>
        </div>

        <Button
          onClick={() => router.push("/login")}
          className="w-full h-12 bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-bold rounded-xl shadow-lg shadow-auth-button/20 transition-all"
        >
          Secure Sign In
        </Button>
      </ResetPasswordCard>
    );
  }

  return (
    <ResetPasswordCard>
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="w-16 h-16 mb-6 p-3 bg-auth-bg rounded-xl border border-auth-card-border flex items-center justify-center">
          <img alt="Gradeloop Logo" src="/logo.png" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-3">
          Reset Password
        </h1>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Please choose a strong new password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive animate-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {validationError && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-500 animate-in slide-in-from-top-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-sm font-medium">{validationError}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
            New Password
          </Label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              required
              minLength={8}
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-12 pr-12 bg-auth-bg/50 border-auth-card-border focus:ring-auth-button/20 focus:border-auth-button transition-all rounded-xl"
              autoComplete="new-password"
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

          {password && (
            <div className="space-y-2 pt-2 px-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Strength</span>
                <span className={cn(
                  strength.label === "STRONG" ? "text-emerald-500" : 
                  strength.label === "MEDIUM" ? "text-amber-500" : "text-destructive"
                )}>
                  {strength.label}
                </span>
              </div>
              <div className="flex gap-2 h-1.5 w-full">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "h-full flex-1 rounded-full transition-all duration-500",
                      step <= strength.score ? strength.color : "bg-auth-bg"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
            Confirm New Password
          </Label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Repeat your password"
              required
              minLength={8}
              disabled={isLoading}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 pl-12 pr-12 bg-auth-bg/50 border-auth-card-border focus:ring-auth-button/20 focus:border-auth-button transition-all rounded-xl"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-bold rounded-xl shadow-lg shadow-auth-button/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>Set New Password <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground font-heading font-bold"
            onClick={() => router.push("/login")}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </ResetPasswordCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-auth-button border-t-transparent" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            Initializing session...
          </p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}