'use client';

import * as React from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { requestPasswordResetAction } from '@/actions/auth';
import type { ForgotPasswordFormState } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

export function ForgotPasswordForm() {
  const initialState: ForgotPasswordFormState = {
    values: { email: '' },
    errors: null,
    formError: null,
    success: false,
    message: null,
  };

  const [formState, formAction, pending] = React.useActionState<
    ForgotPasswordFormState,
    FormData
  >(requestPasswordResetAction, initialState);

  const [submittedEmail, setSubmittedEmail] = React.useState('');

  React.useEffect(() => {
    if (formState.formError) {
      toast.error(formState.formError);
    }
  }, [formState.formError]);

  if (formState.success) {
    return (
      <div className="mt-8 space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formState.message ||
              'If an account exists for that email, we have sent a link to reset your password.'}
          </p>
          {submittedEmail && (
            <p className="mt-2 text-xs font-medium text-foreground">
              {submittedEmail}
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder or try again in
            a few minutes.
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Form
      action={(formData) => {
        setSubmittedEmail((formData.get('email') as string) || '');
        return formAction(formData);
      }}
      className="mt-8 space-y-6"
    >
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.email?.length}>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <div className="relative">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={pending}
              required
            />
          </div>
          {formState.errors?.email && (
            <FieldError>{formState.errors.email[0]}</FieldError>
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
          'Sending reset link...'
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Mail className="size-4" />
            Send reset link
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
