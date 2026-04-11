import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const TimestampSchema = z.string().datetime();

export const PaginationParams = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export const UserRole = z.enum(["admin", "instructor", "student", "guest"]);

export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: UserRole,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
  role: UserRole.optional(),
});

export const UpdateUserInput = CreateUserInput.partial();

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number(),
  tokenType: z.literal("Bearer").default("Bearer"),
});

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
});

export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiError.optional(),
  });