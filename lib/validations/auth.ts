import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export type SignUpFormState = {
  values?: Partial<SignUpInput>;
  errors?: Partial<Record<keyof SignUpInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
};
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type SignInInput = z.infer<typeof signInSchema>;

export type SignInFormState = {
  values?: Partial<SignInInput>;
  errors?: Partial<Record<keyof SignInInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
  redirectTo?: string;
};

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ForgotPasswordFormState = {
  values?: Partial<ForgotPasswordInput>;
  errors?: Partial<Record<keyof ForgotPasswordInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
  message?: string | null;
};

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    token: z.string().min(1, 'Reset token is missing or invalid'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type ResetPasswordFormState = {
  values?: Partial<ResetPasswordInput>;
  errors?: Partial<Record<keyof ResetPasswordInput, string[]>> | null;
  formError?: string | null;
  success: boolean;
};
