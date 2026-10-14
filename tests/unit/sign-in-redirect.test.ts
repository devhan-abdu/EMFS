import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProfileLookup, mockSignInEmail, mockHasAdminAssignment } =
  vi.hoisted(() => ({
    mockProfileLookup: vi.fn(),
    mockSignInEmail: vi.fn(),
    mockHasAdminAssignment: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      profiles: {
        findFirst: (...args: unknown[]) => mockProfileLookup(...args),
      },
    },
  },
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: {
    api: {
      signInEmail: (...args: unknown[]) => mockSignInEmail(...args),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/authorize', () => ({
  hasAdminAssignment: (...args: unknown[]) => mockHasAdminAssignment(...args),
}));

vi.mock('@/lib/services/registration', () => ({
  registerMember: vi.fn(),
}));

import { signInAction } from '@/actions/auth';

function signInForm(next?: string) {
  const formData = new FormData();
  formData.set('email', 'person@example.com');
  formData.set('password', 'password');
  if (next) formData.set('next', next);
  return formData;
}

describe('sign-in redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInEmail.mockResolvedValue({ user: { id: 'auth-user-id' } });
    mockProfileLookup.mockResolvedValue({
      id: 'profile-id',
      isSuperAdmin: false,
      role: 'member',
    });
    mockHasAdminAssignment.mockResolvedValue(false);
  });

  it('sends super admins to the admin landing page', async () => {
    mockProfileLookup.mockResolvedValue({
      id: 'profile-id',
      isSuperAdmin: true,
      role: 'super_admin',
    });

    const result = await signInAction({ success: false }, signInForm());

    expect(result.redirectTo).toBe('/admin');
    expect(mockHasAdminAssignment).not.toHaveBeenCalled();
  });

  it('sends users with a batch or pace admin assignment to the admin landing page', async () => {
    mockHasAdminAssignment.mockResolvedValue(true);

    const result = await signInAction({ success: false }, signInForm());

    expect(result.redirectTo).toBe('/admin');
    expect(mockHasAdminAssignment).toHaveBeenCalledWith('profile-id');
  });

  it('sends members to the public home page instead of the admin page', async () => {
    const result = await signInAction({ success: false }, signInForm('/admin'));

    expect(result.redirectTo).toBe('/');
  });

  it('does not treat a batch-admin profile role as an assignment', async () => {
    mockProfileLookup.mockResolvedValue({
      id: 'profile-id',
      isSuperAdmin: false,
      role: 'batch_admin',
    });

    const result = await signInAction({ success: false }, signInForm());

    expect(result.redirectTo).toBe('/');
    expect(mockHasAdminAssignment).toHaveBeenCalledWith('profile-id');
  });

  it('preserves a safe non-admin destination for members', async () => {
    const result = await signInAction({ success: false }, signInForm('/me'));

    expect(result.redirectTo).toBe('/me');
  });
});
