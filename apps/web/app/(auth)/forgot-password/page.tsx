"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/axios";

const GRADELOOP_LOGO = "https://lh3.googleusercontent.com/aida/ADBb0ugP-d8dy1zHENxaDQSUeqpN4tKVRw5B7yneXKScqh04MJAais1yPb1ZVvJTYTbUC9qwaEkTr3KNGm5nNblhQHVQOr29l9hTkKd3J_4qPhKh13pmeqzjY5RFA9s8Y1lPZMup1lNZ80NWlPqz_ZE7jNhy0vijcXezOYx1gXcMQJfi4pDlgikaJSqQPu1c0loq-K-_0G4zk1J_XeNxUdxBmN5qRnz1UniV2wryZVt9Zlb7zyej31lRGvs-CllWLJ7g00vFDnj3PSfCdg";

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email") as string;
    setEmail(emailValue);

    try {
      await authApi.forgotPassword({ email: emailValue });
      setIsSubmitted(true);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setError(null);
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-[440px] bg-white rounded-xl border border-slate-200/60 shadow-xl shadow-slate-200/40 p-10 relative overflow-hidden">
        {/* Glassmorphism Accent */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl" />

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
            Check your email
          </h1>
          <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
            We&apos;ve sent instructions to{" "}
            <span className="font-bold text-on-surface">{email}</span>
          </p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 mb-6">
          <p className="text-xs text-center text-primary/80 font-medium leading-relaxed uppercase tracking-wider font-[family-name:var(--font-inter)]">
            Click the link in the email to reset your password. If you don&apos;t
            see it, check your spam folder.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 p-4 text-error mb-6">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl font-semibold border-2 border-outline-variant hover:bg-slate-50 transition-colors font-[family-name:var(--font-space-grotesk)]"
            onClick={handleResend}
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Resend Email"}
          </Button>
          <Link href="/login" className="w-full">
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl font-semibold gap-2 text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-space-grotesk)]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px] bg-white rounded-xl border border-slate-200/60 shadow-xl shadow-slate-200/40 p-10 relative overflow-hidden">
      {/* Glassmorphism Accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl" />

      <div className="flex flex-col items-center mb-8">
        <img
          alt="Gradeloop System Logo"
          className="w-20 h-20 mb-6 object-contain"
          src={GRADELOOP_LOGO}
        />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold text-on-surface mb-2">
          Forgot Password?
        </h1>
        <p className="text-on-surface-variant font-[family-name:var(--font-inter)] text-center">
          Don&apos;t worry! It happens. Enter your email to receive a reset
          link.
        </p>
      </div>

      <form onSubmit={handleSubmit} id="forgot-password-form">
        <div className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 p-4 text-error">
              <AlertCircle className="h-4 w-4" />
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
                placeholder="name@example.com"
                required
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none transition-all font-[family-name:var(--font-inter)]"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs text-center text-primary/80 font-medium leading-relaxed uppercase tracking-wider font-[family-name:var(--font-inter)]">
              You will receive instructions in a few minutes.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-8">
          <Button
            type="submit"
            form="forgot-password-form"
            className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary-container/20 hover:shadow-primary-container/30 transition-all active:scale-[0.98] bg-primary-container text-on-primary-container font-[family-name:var(--font-space-grotesk)]"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Send Reset Link <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
          <Link href="/login" className="w-full">
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl font-semibold gap-2 text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-space-grotesk)]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Login
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}