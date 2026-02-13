"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
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
  ForgotPasswordSchema,
  type ForgotPasswordValues,
} from "../schemas/auth.schema";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordValues) {
    setIsLoading(true);
    console.log("Forgot password data:", data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="w-full">
        <div className="mb-10">
          <Link
            href="/login"
            className="flex items-center text-sm font-medium text-primary hover:underline mb-6 transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Link>
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Check Your Email
            </h2>
            <p className="text-muted-foreground">
              We&apos;ve sent a password reset link to your email address.
              Please check your inbox and follow the instructions.
            </p>
          </div>
        </div>
        <Link href="/login">
          <Button
            variant="outline"
            className="w-full h-12 border-input text-foreground"
          >
            Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-10">
        <Link
          href="/login"
          className="flex items-center text-sm font-medium text-primary hover:underline mb-6 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Link>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Forgot Password
        </h2>
        <p className="text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
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

          <Button
            type="submit"
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
