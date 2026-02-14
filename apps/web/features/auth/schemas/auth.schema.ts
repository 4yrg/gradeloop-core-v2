import { z } from "zod";

export const LoginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long"),
    rememberMe: z.boolean(),
});

export type LoginValues = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
});

export type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, "Password must be at least 8 characters long")
            .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
            .regex(/[0-9!@#$%^&*]/, "Password must contain at least one number or symbol"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;
