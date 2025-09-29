import { z } from 'zod';

// Blood group enum validation
export const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

// User registration validation
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name can only contain letters and spaces" }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s\-()]{10,15}$/, { message: "Invalid phone number format" })
    .max(20, { message: "Phone number too long" }),
  district: z
    .string()
    .trim()
    .min(2, { message: "District must be at least 2 characters" })
    .max(50, { message: "District must be less than 50 characters" }),
  state: z
    .string()
    .trim()
    .min(2, { message: "State must be at least 2 characters" })
    .max(50, { message: "State must be less than 50 characters" }),
  blood_group: bloodGroupSchema
});

// User sign in validation
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password must be less than 128 characters" })
});

// Password reset validation
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
});

// Profile update validation
export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name can only contain letters and spaces" }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s\-()]{10,15}$/, { message: "Invalid phone number format" })
    .max(20, { message: "Phone number too long" }),
  district: z
    .string()
    .trim()
    .min(2, { message: "District must be at least 2 characters" })
    .max(50, { message: "District must be less than 50 characters" }),
  state: z
    .string()
    .trim()
    .min(2, { message: "State must be at least 2 characters" })
    .max(50, { message: "State must be less than 50 characters" }),
  blood_group: bloodGroupSchema
});

// Blood request validation
export const bloodRequestSchema = z.object({
  blood_group: bloodGroupSchema,
  location_description: z
    .string()
    .trim()
    .min(10, { message: "Location description must be at least 10 characters" })
    .max(500, { message: "Location description must be less than 500 characters" }),
  message: z
    .string()
    .trim()
    .max(1000, { message: "Message must be less than 1000 characters" })
    .optional()
});

// Contact request validation
export const contactRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, { message: "Message must be at least 10 characters" })
    .max(500, { message: "Message must be less than 500 characters" })
});

// Type exports
export type SignUpData = z.infer<typeof signUpSchema>;
export type SignInData = z.infer<typeof signInSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
export type BloodRequestData = z.infer<typeof bloodRequestSchema>;
export type ContactRequestData = z.infer<typeof contactRequestSchema>;