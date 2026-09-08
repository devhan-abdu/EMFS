import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  fatherName: z.string().min(1),
  grandfatherName: z.string().optional(),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((input) => input.password === input.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
