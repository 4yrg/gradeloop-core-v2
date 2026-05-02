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

const GRADELOOP_LOGO = "https://lh3.googleusercontent.com/aida/ADBb0ugP-d8dy1zHENxaDQSUeqpN4tKVRw5B7yneXKScqh04MJAais1yPb1ZVvJTYTbUC9qwaEkTr3KNGm5nNblhQHVQOr29l9hTkKd3J_4qPhKh13pmeqzjY5RFA9s8Y1lPZMup1lNZ80NWlPqz_ZE7jNhy0vijcXezOYx1gXcMQJfi4pDlgikaJSqQPu1c0loq-K-_0G4zk1J_XeNxUdxBmN5qRnz1UniV2wryZVt9Zlb7zyej31lRGvs-CllWLJ7g00vFDnj3PSfCdg";

function getPasswordStrength(password: string) {
  let score = 0;
  if (!password) return { score: 0, label: "WEAK", color: "bg-slate-200" };

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "WEAK", color: "bg-error" };
  if (score <= 4) return { score: 2, label: "MEDIUM", color: "bg-warning" };
  return { score: 3, label: "STRONG", color: "bg-primary-container" };
}

function ResetPasswordCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[440px] bg-white rounded-xl border border-slate-200/60 shadow-xl shadow-slate-200/40 p-10 relative overflow-hidden",
        className
      )}
    >
      {/* Glassmorphism Accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl" />
      {children}
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
        <div className="flex flex-col items-center mb-8">
          <img
            alt="Gradeloop System Logo"
            className="w-20 h-20 mb-6 object-contain"
            src={GRADELOOP_LOGO}
          />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-on-surface mt-6 mb-2">
            Invalid Link
          </h1>
          <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link href="/forgot-password" className="w-full">
            <Button className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary-container/20 hover:shadow-primary-container/30 transition-all bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)]">
              Request New Link
            </Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl font-semibold text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-space-grotesk)]"
            >
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
        <div className="flex flex-col items-center mb-8">
          <img
            alt="Gradeloop System Logo"
            className="w-20 h-20 mb-6 object-contain"
            src={GRADELOOP_LOGO}
          />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-on-surface mt-6 mb-2">
            Success!
          </h1>
          <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
            Your password has been successfully reset.
          </p>
        </div>

        <div className="rounded-xl border border-primary-container/20 bg-primary-container/5 p-4 flex items-center gap-3 text-primary-container mb-6">
          <ShieldCheck className="h-5 w-5" />
          <p className="text-sm font-medium font-[family-name:var(--font-inter)]">
            Security settings updated successfully.
          </p>
        </div>

        <Button
          onClick={() => router.push("/login")}
          className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary-container/20 bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)]"
        >
          Secure Sign In
        </Button>
      </ResetPasswordCard>
    );
  }

  return (
    <ResetPasswordCard>
      <div className="flex flex-col items-center mb-8">
        <img
          alt="Gradeloop System Logo"
          className="w-20 h-20 mb-6 object-contain"
          src={GRADELOOP_LOGO}
        />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-on-surface mb-2">
          Reset Password
        </h1>
        <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
          Please choose a strong new password.
        </p>
      </div>

      <form onSubmit={handleSubmit} id="reset-password-form">
        <div className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 p-4 text-error">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {validationError && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/5 p-4">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <p className="text-sm font-medium text-warning font-[family-name:var(--font-inter)]">
                {validationError}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-on-surface-variant ml-1 uppercase tracking-wider"
            >
              New Password
            </Label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-outline" />
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
                className="pl-12 pr-12 h-11 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none transition-all font-[family-name:var(--font-inter)]"
                autoComplete="new-password"
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

            {password && (
              <div className="space-y-2 pt-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest px-1">
                  <span className="text-on-surface-variant uppercase font-[family-name:var(--font-inter)]">
                    Strength
                  </span>
                  <span
                    className={cn(
                      strength.label === "STRONG"
                        ? "text-primary-container"
                        : strength.label === "MEDIUM"
                          ? "text-warning"
                          : "text-error"
                    )}
                  >
                    {strength.label}
                  </span>
                </div>
                <div className="flex gap-1.5 h-1.5 w-full px-1">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={cn(
                        "h-full flex-1 rounded-full transition-all duration-500",
                        step <= strength.score
                          ? strength.color
                          : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-on-surface-variant ml-1 uppercase tracking-wider"
            >
              Confirm New Password
            </Label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-outline" />
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
                className="pl-12 pr-12 h-11 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none transition-all font-[family-name:var(--font-inter)]"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors outline-none"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant/80 leading-relaxed px-1 font-[family-name:var(--font-inter)]">
            Use at least 8 characters with letters, numbers and symbols for
            better security.
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-8">
          <Button
            type="submit"
            form="reset-password-form"
            className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary-container/20 hover:shadow-primary-container/30 transition-all active:scale-[0.98] bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)]"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Resetting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Set New Password <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11 rounded-xl font-semibold text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-space-grotesk)]"
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-primary" />
          <p className="text-sm font-medium text-on-surface-variant font-[family-name:var(--font-inter)]">
            Initializing secure session...
          </p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}