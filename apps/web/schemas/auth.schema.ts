import { z } from "zod";
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "../features/auth/schemas/auth.schema";

// Re-export form schemas for compatibility
export { LoginSchema, ForgotPasswordSchema, ResetPasswordSchema };

export type LoginValues = z.infer<typeof LoginSchema>;
export type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;

// Core domain types used across the frontend
export type User = {
  id: string;
  email: string;
  name?: string;
  permissions?: string[];
  role?: string;
};

export type Session = {
  id: string;
  device?: string;
  ip?: string;
  createdAt: string;
  expiresAt?: string;
};

export type ActiveSession = Session;

export type AccessTokenPayload = {
  sub: string;
  permissions: string[];
  iat?: number;
  exp?: number;
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
};

export type CookieConfig = {
  name: string;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

// Other auth-related request/response types (minimal)
export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: User;
};

export default {};
