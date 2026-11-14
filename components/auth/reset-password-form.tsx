'use client';

import * as React from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { resetPasswordAction } from '@/actions/auth';
import type { ResetPasswordFormState } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

export function ResetPasswordForm({
  token,
  error,
}: {
  token?: string;
  error?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const initialState: ResetPasswordFormState = {
    values: {
      password: '',
      confirmPassword: '',
      token: token || '',
    },
    errors: null,
    formError: null,
    success: false,
  };

  const [formState, formAction, pending] = React.useActionState<
    ResetPasswordFormState,
    FormData
  >(resetPasswordAction, initialState);

  React.useEffect(() => {
    if (formState.success) {
      toast.success('Password updated successfully!');
    } else if (formState.formError) {
      toast.error(formState.formError);
    }
  }, [formState.success, formState.formError]);

  // Invalid or expired token from redirect query
  if (error || !token) {
    return (
      <div className="mt-8 space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Invalid or expired link
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This password reset link is invalid or has already expired. Password
            reset links are single-use and expire after 1 hour.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Remembered your password?{' '}
          <Link
            href="/signin"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Password successfully reset
  if (formState.success) {
    return (
      <div className="mt-8 space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Password reset complete
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been reset successfully. You can now sign in using
            your new password.
          </p>
        </div>

        <Button
          onClick={() => {
            router.push('/signin');
            router.refresh();
          }}
          className="w-full"
        >
          Sign in now
        </Button>
      </div>
    );
  }

  return (
    <Form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="token" value={token} />

      <FieldGroup>
        {/* New Password */}
        <Field data-invalid={!!formState.errors?.password?.length}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="pr-10"
              disabled={pending}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {formState.errors?.password && (
            <FieldError>{formState.errors.password[0]}</FieldError>
          )}
        </Field>

        {/* Confirm Password */}
        <Field data-invalid={!!formState.errors?.confirmPassword?.length}>
          <FieldLabel htmlFor="confirmPassword">
            Confirm new password
          </FieldLabel>
          <div className="relative">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="pr-10"
              disabled={pending}
              required
            />
            <button
              type="button"
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {formState.errors?.confirmPassword && (
            <FieldError>{formState.errors.confirmPassword[0]}</FieldError>
          )}
        </Field>
      </FieldGroup>

      {formState.formError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {formState.formError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          'Updating password...'
        ) : (
          <span className="flex items-center justify-center gap-2">
            <KeyRound className="size-4" />
            Reset password
          </span>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link
          href="/signin"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </Form>
  );
}
