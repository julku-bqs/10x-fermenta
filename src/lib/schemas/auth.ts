import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().min(1, "Email is required").pipe(z.email("Invalid email format")),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  email: z.string().min(1, "Email is required").pipe(z.email("Invalid email format")),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
