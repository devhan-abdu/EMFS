import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  authHandler: vi.fn(),
  resetPassword: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/db', () => ({
  db: {
    query: {
      profiles: { findFirst: vi.fn() },
    },
  },
}));
vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));
vi.mock('@/lib/auth/auth', () => ({
  auth: {
    handler: mocks.authHandler,
    api: {
      resetPassword: mocks.resetPassword,
    },
  },
}));

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth';
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from '@/actions/auth';
import { sendPasswordResetEmail } from '@/lib/services/email';

describe('Password Reset Validations', () => {
  it('validates email format in forgotPasswordSchema', () => {
    const valid = forgotPasswordSchema.safeParse({ email: 'sister@emfs.app' });
    expect(valid.success).toBe(true);

    const invalid = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it('validates password requirements in resetPasswordSchema', () => {
    // Too short (< 8 chars)
    const tooShort = resetPasswordSchema.safeParse({
      password: 'short',
      confirmPassword: 'short',
      token: 'valid-token',
    });
    expect(tooShort.success).toBe(false);

    // Passwords do not match
    const mismatch = resetPasswordSchema.safeParse({
      password: 'validpassword123',
      confirmPassword: 'differentpassword123',
      token: 'valid-token',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.flatten().fieldErrors.confirmPassword?.[0]).toBe(
        'Passwords do not match',
      );
    }

    // Missing token
    const missingToken = resetPasswordSchema.safeParse({
      password: 'validpassword123',
      confirmPassword: 'validpassword123',
      token: '',
    });
    expect(missingToken.success).toBe(false);

    // Valid
    const valid = resetPasswordSchema.safeParse({
      password: 'validpassword123',
      confirmPassword: 'validpassword123',
      token: 'valid-token-123',
    });
    expect(valid.success).toBe(true);
  });
});

describe('requestPasswordResetAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ host: 'localhost:3000' }));
  });

  it('rejects invalid email inputs without calling auth handler', async () => {
    const formData = new FormData();
    formData.set('email', 'invalid-email');

    const result = await requestPasswordResetAction(
      { success: false },
      formData,
    );
    expect(result.success).toBe(false);
    expect(result.errors?.email).toBeDefined();
    expect(mocks.authHandler).not.toHaveBeenCalled();
  });

  it('handles successful reset request and returns generic confirmation', async () => {
    mocks.authHandler.mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const formData = new FormData();
    formData.set('email', 'reader@emfs.app');

    const result = await requestPasswordResetAction(
      { success: false },
      formData,
    );
    expect(result.success).toBe(true);
    expect(result.formError).toBeNull();
    expect(result.message).toContain('If an account exists');
    expect(mocks.authHandler).toHaveBeenCalledOnce();
  });

  it('handles rate-limited (429) requests gracefully without exposing account existence', async () => {
    mocks.authHandler.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: { 'X-Retry-After': '60' },
      }),
    );

    const formData = new FormData();
    formData.set('email', 'reader@emfs.app');

    const result = await requestPasswordResetAction(
      { success: false },
      formData,
    );
    expect(result.success).toBe(false);
    expect(result.formError).toContain('Too many password reset requests');
  });
});

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
  });

  it('rejects mismatched passwords before invoking auth API', async () => {
    const formData = new FormData();
    formData.set('password', 'secret1234');
    formData.set('confirmPassword', 'secret9999');
    formData.set('token', 'token-123');

    const result = await resetPasswordAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.errors?.confirmPassword).toBeDefined();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('successfully resets password with valid token and matching password', async () => {
    mocks.resetPassword.mockResolvedValue({ status: true });

    const formData = new FormData();
    formData.set('password', 'newsecret123');
    formData.set('confirmPassword', 'newsecret123');
    formData.set('token', 'valid-reset-token');

    const result = await resetPasswordAction({ success: false }, formData);
    expect(result.success).toBe(true);
    expect(result.formError).toBeNull();
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      body: {
        newPassword: 'newsecret123',
        token: 'valid-reset-token',
      },
      headers: expect.anything(),
    });
  });

  it('returns clean error message when token is invalid or expired', async () => {
    mocks.resetPassword.mockRejectedValue(new Error('INVALID_TOKEN'));

    const formData = new FormData();
    formData.set('password', 'newsecret123');
    formData.set('confirmPassword', 'newsecret123');
    formData.set('token', 'expired-or-invalid-token');

    const result = await resetPasswordAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.formError).toContain('invalid or has expired');
  });
});

describe('sendPasswordResetEmail', () => {
  it('formats subject and includes single-use reset URL in email text', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await sendPasswordResetEmail({
      to: 'sister@emfs.app',
      url: 'http://localhost:3000/api/auth/reset-password/sample-token?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password',
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedText = consoleSpy.mock.calls[0][0];
    expect(loggedText).toContain('To: sister@emfs.app');
    expect(loggedText).toContain('Reset your EMFSC Book Shelf password');
    expect(loggedText).toContain('sample-token');
    consoleSpy.mockRestore();
  });
});
