import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(40, "Username is too long")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use only letters, numbers, and . _ -");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const INSTITUTE_TYPES = [
  "abacus", "coaching", "computer", "dance", "drawing", "spoken_english", "tuition", "other",
] as const;

export const registerSchema = z
  .object({
    instituteName: z.string().min(2, "Institute name is required"),
    type: z.enum(INSTITUTE_TYPES, { errorMap: () => ({ message: "Pick your center type" }) }),
    fullName: z.string().min(2, "Your name is required"),
    username: usernameSchema,
    email: z.string().email("Enter a valid email"),
    phone: z.string().trim().min(7, "Enter a valid phone number"),
    address: z.string().trim().optional().or(z.literal("")),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const otpRequestSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const otpVerifySchema = z.object({
  email: z.string().email("Enter a valid email"),
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
