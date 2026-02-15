import { z } from "zod";

// Base user creation schema
export const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
  role: z.enum(["staff", "instructor", "admin", "department_head"]),
  isActive: z.boolean(),
});

// Extended schema for instructor
export const instructorSchema = baseUserSchema.extend({
  assignedFaculty: z.array(z.string()).min(1, "At least one faculty must be selected"),
  primarySpecialization: z.string().min(1, "Primary specialization is required"),
  educationLevel: z.string().min(1, "Education level is required"),
  researcherId: z.string().optional(),
  aiAssistedGrading: z.boolean(),
});

export type BaseUser = z.infer<typeof baseUserSchema>;
export type InstructorUser = z.infer<typeof instructorSchema>;
export type CreateUserInput = BaseUser | InstructorUser;
