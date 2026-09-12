import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export type SignUpFormState = {
  values?: Partial<SignUpInput>;
  errors?: Partial<Record<keyof SignUpInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
};
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInFormState = {
  values?: Partial<SignInInput>;
  errors?: Partial<Record<keyof SignInInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
  redirectTo?: string;
};
