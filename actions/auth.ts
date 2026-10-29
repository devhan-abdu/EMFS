'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { db } from '@/db';
import { profiles } from '@/db/schema';
import { hasAdminAssignment } from '@/lib/auth/authorize';
import { auth } from '@/lib/auth/auth';
import { registerMember } from '@/lib/services/registration';
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  SignUpFormState,
  SignInFormState,
  ForgotPasswordFormState,
  ResetPasswordFormState,
} from '@/lib/validations/auth';

function safeNext(next: FormDataEntryValue | null | undefined): string | null {
  if (typeof next !== 'string' || !next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function isPublicDestination(next: string | null): next is string {
  return Boolean(next && next !== '/admin' && !next.startsWith('/admin/'));
}

export async function signUpAction(
  _prevState: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const values = {
    email: (formData.get('email') as string) ?? '',
    password: (formData.get('password') as string) ?? '',
    confirmPassword: (formData.get('confirmPassword') as string) ?? '',
  };

  const parsed = signUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  try {
    await registerMember(parsed.data);

    return {
      values: {},
      errors: null,
      formError: null,
      success: true,
    };
  } catch (e) {
    return {
      values,
      errors: null,
      formError:
        (e as Error).message || 'An unexpected error occurred during signup.',
      success: false,
    };
  }
}

export async function signInAction(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const next = safeNext(formData.get('next'));

  const values = {
    email: (formData.get('email') as string) ?? '',
    password: (formData.get('password') as string) ?? '',
  };

  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  let signInResult;
  try {
    signInResult = await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
  } catch {
    return {
      values,
      errors: null,
      formError: 'Invalid email or password.',
      success: false,
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, signInResult.user.id),
  });

  const hasAdminAccess = profile
    ? profile.isSuperAdmin || (await hasAdminAssignment(profile.id))
    : false;
  const targetUrl = hasAdminAccess
    ? (next ?? '/admin')
    : isPublicDestination(next)
      ? next
      : '/';

  return {
    values: {},
    errors: null,
    formError: null,
    success: true,
    redirectTo: targetUrl,
  };
}
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect('/signin');
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const values = {
    email: (formData.get('email') as string) ?? '',
  };

  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  try {
    const reqHeaders = await headers();
    const host = reqHeaders.get('host') || 'localhost:3000';
    const proto = reqHeaders.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;
    const baseURL = process.env.BETTER_AUTH_URL || origin;
    const redirectTo = `${baseURL}/reset-password`;

    const outgoingHeaders = new Headers(reqHeaders);
    outgoingHeaders.set('content-type', 'application/json');

    const req = new Request(`${baseURL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: outgoingHeaders,
      body: JSON.stringify({
        email: parsed.data.email,
        redirectTo,
      }),
    });

    const res = await auth.handler(req);

    if (res.status === 429) {
      return {
        values,
        errors: null,
        formError:
          'Too many password reset requests. Please wait before trying again.',
        success: false,
      };
    }

    if (!res.ok) {
      const errorData = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return {
        values,
        errors: null,
        formError:
          errorData?.message ||
          'Unable to request password reset at this time.',
        success: false,
      };
    }

    return {
      values: {},
      errors: null,
      formError: null,
      success: true,
      message:
        'If an account exists for that email, we have sent a link to reset your password.',
    };
  } catch {
    return {
      values,
      errors: null,
      formError: 'An unexpected error occurred. Please try again later.',
      success: false,
    };
  }
}

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const values = {
    password: (formData.get('password') as string) ?? '',
    confirmPassword: (formData.get('confirmPassword') as string) ?? '',
    token: (formData.get('token') as string) ?? '',
  };

  const parsed = resetPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      values,
      errors: parsed.error.flatten().fieldErrors,
      formError: null,
      success: false,
    };
  }

  try {
    const result = await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.password,
        token: parsed.data.token,
      },
      headers: await headers(),
    });

    if (result?.status) {
      return {
        values: {},
        errors: null,
        formError: null,
        success: true,
      };
    }

    return {
      values,
      errors: null,
      formError:
        'Failed to reset password. The link may be expired or invalid.',
      success: false,
    };
  } catch {
    return {
      values,
      errors: null,
      formError:
        'This reset link is invalid or has expired. Please request a new one.',
      success: false,
    };
  }
}
