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
      <div className="w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-auth-card border border-auth-card-border/60 rounded-2xl shadow-2xl shadow-black/20 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-auth-button to-transparent opacity-50" />
          
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-20 h-20 mb-8 p-4 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-4">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent instructions to{" "}
              <span className="font-bold text-foreground">{email}</span>
            </p>
          </div>

          <div className="bg-auth-bg/50 border border-auth-card-border rounded-xl p-5 mb-8">
            <p className="text-xs text-center text-muted-foreground font-medium leading-relaxed uppercase tracking-wider">
              Click the link in the email to reset your password. If you don&apos;t
              see it, check your spam folder.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-auth-card-border bg-auth-bg/30 hover:bg-auth-bg/60 font-heading font-bold"
              onClick={handleResend}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Resend Email"}
            </Button>
            <Link href="/login" className="block">
              <Button
                variant="ghost"
                className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground font-heading font-bold gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-auth-card border border-auth-card-border/60 rounded-2xl shadow-2xl shadow-black/20 p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-auth-button to-transparent opacity-50" />
        
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 mb-6 p-3 bg-auth-bg rounded-xl border border-auth-card-border flex items-center justify-center">
            <img alt="Gradeloop Logo" src="/logo.png" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading mb-3">
            Forgot Password?
          </h1>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            Don&apos;t worry! It happens. Enter your email to receive a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-4 w-4" />
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

          <div className="bg-auth-bg/50 border border-auth-card-border rounded-xl p-4">
            <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest">
              You will receive instructions in a few minutes.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-auth-button text-auth-button-foreground hover:bg-auth-button-hover font-heading font-bold rounded-xl shadow-lg shadow-auth-button/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>Send Reset Link <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
            <Link href="/login" className="block">
              <Button
                variant="ghost"
                className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground font-heading font-bold gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}